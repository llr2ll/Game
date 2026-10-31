// Teste de fumaça: compila o jogo, sobe relay + página em portas próprias (não briga com o npm run dev/server),
// abre num navegador sem tela, entra 1 jogador no teclado (Atirador) e 1 celular simulado (troca para Bardo no menu),
// joga ~60 s e FALHA se aparecer erro no console. Capturas e log ficam em smoke/.
// Sem placa de vídeo o jogo roda a 1–2 FPS: 60 s reais ≈ 6 s de jogo. Serve para pegar erro de carregar/iniciar/botões.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'smoke')
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'game-smoke-'))
const VITE = path.join(ROOT, 'node_modules/vite/bin/vite.js')
const WS_PORT = 8099, WEB_PORT = 5199
const WEB = `http://localhost:${WEB_PORT}/`
const PLAY_SECONDS = 60
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const log = []
const problems = []
const T0 = Date.now()
const note = (s) => { s = `[${Math.round((Date.now() - T0) / 1000)}s] ${s}`; log.push(s); console.log(s) }
const fail = (s) => { problems.push(s); note(`✗ ${s}`) }
const children = []

// roda um processo e espera ele terminar (a compilação)
function run(args, env) {
  return new Promise((ok, no) => {
    const c = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    c.stdout.on('data', (d) => (out += d))
    c.stderr.on('data', (d) => (out += d))
    c.on('exit', (code) => (code === 0 ? ok(out) : no(new Error(`saiu com código ${code}\n${out}`))))
  })
}
// sobe um processo que fica rodando (relay, página) e espera a linha de "pronto"
function serve(args, env, ready) {
  return new Promise((ok, no) => {
    const c = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(c)
    let out = ''
    const t = setTimeout(() => no(new Error(`não ficou pronto em 30 s\n${out}`)), 30000)
    // espera meio segundo depois do "pronto": o relay avisa a porta antes de descobrir que ela está ocupada
    const read = (d) => { out += d; if (ready.test(out)) { clearTimeout(t); setTimeout(() => ok(c), 500) } }
    c.stdout.on('data', read)
    c.stderr.on('data', read)
    c.on('exit', (code) => { clearTimeout(t); no(new Error(`saiu com código ${code}\n${out}`)) })
  })
}
function stopAll() {
  for (const c of children) if (c.exitCode === null) c.kill()
  fs.rmSync(DIST, { recursive: true, force: true })
}
process.on('SIGINT', () => { stopAll(); process.exit(130) })

// registra tudo o que aparece no console; erro = teste falha
function watch(page, who) {
  page.on('console', (m) => {
    log.push(`[${who} ${m.type()}] ${m.text()}`)
    if (m.type() === 'error') fail(`${who}: erro no console: ${m.text()}`)
  })
  page.on('pageerror', (e) => fail(`${who}: erro na página: ${e.message}`))
}

async function play(page, phone) {
  const k = page.keyboard
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 70 }); note(`   captura ${name}`) }
  const hold = async (keys, ms) => { for (const x of keys) await k.down(x); await wait(ms); for (const x of keys) await k.up(x) }
  const fire = async (n) => { for (let i = 0; i < n; i++) { await page.mouse.down(); await wait(250); await page.mouse.up(); await wait(100) } }
  // celular: arrasta um stick (zona esquerda = mover, direita = mirar/atacar) e solta
  const stick = async (x, y, dx, dy, ms) => { await phone.mouse.move(x, y); await phone.mouse.down(); await phone.mouse.move(x + dx, y + dy, { steps: 4 }); await wait(ms); await phone.mouse.up() }
  const tap = async (sel) => { if (await phone.isVisible(sel)) await phone.click(sel) }

  const t0 = Date.now()
  await page.mouse.move(700, 160)
  await shot('02-inicio.jpg')
  // teclado: andar, correr, atirar, trocar arma, recarregar, granada, empurrar, pular, carro
  await hold(['w'], 2000)
  await hold(['Shift', 'd'], 2000)
  await fire(4)
  for (const key of ['2', 'r', '3', '1', 'q', 'g', 'v', ' ', 'e', 'e']) { await k.press(key); await wait(400) }
  // celular: mover, mirar/atacar, botões da classe, empurrar, pular, correr
  await stick(150, 250, 0, -60, 1500)
  await stick(650, 250, 60, 0, 1500)
  for (const sel of ['#b1', '#b2', '#b3', '#shove', '#jump', '#run', '#run']) { await tap(sel); await wait(300) }
  await shot('03-acao.jpg')
  // anoitecer (N = +1 hora)
  for (let i = 0; i < 12; i++) { await k.press('n'); await wait(150) }
  await wait(1500)
  await shot('04-noite.jpg')
  // resto do tempo: anda em volta atirando e empurrando
  const keys = ['a', 's', 'd', 'w']
  for (let i = 0; Date.now() - t0 < PLAY_SECONDS * 1000; i++) {
    await hold([keys[i % 4]], 800)
    await fire(2)
    await k.press('v')
  }
  await shot('05-fim.jpg')
  await phone.screenshot({ path: path.join(OUT, '06-celular.jpg'), type: 'jpeg', quality: 70 })
}

let browser
try {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })

  note('1/4 compilando o jogo…')
  await run([VITE, 'build', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], { VITE_WS_URL: `ws://localhost:${WS_PORT}` })
  note('2/4 subindo relay e página…')
  await serve(['server/server.js'], { PORT: WS_PORT }, /porta/)
  await serve([VITE, 'preview', '--outDir', DIST, '--port', WEB_PORT, '--strictPort'], {}, /localhost/)

  note('3/4 abrindo o jogo no navegador sem tela…')
  browser = await chromium.launch({ args: GL_ARGS })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  page.setDefaultTimeout(120000) // sem placa de vídeo um quadro pode levar segundos
  watch(page, 'jogo')
  let frames = 0
  await page.exposeFunction('__smokeFps', () => frames++)
  await page.addInitScript(() => addEventListener('fps', () => window.__smokeFps()))
  await page.goto(WEB)
  await page.waitForFunction(() => /^[A-Z]{4}$/.test(document.querySelector('#code2')?.textContent || ''), null, { timeout: 60000 })
  const code = await page.textContent('#code2')
  note(`   sala ${code} aberta no relay`)

  // vaga 1 = teclado (Atirador); o celular entra na primeira vaga livre (2 = Samurai)
  await page.click('button[data-a="kb"][data-i="0"]')
  const phone = await browser.newPage({ viewport: { width: 800, height: 400 }, hasTouch: true })
  phone.setDefaultTimeout(60000)
  watch(phone, 'celular')
  await phone.goto(`${WEB}controller.html?room=${code}`)
  await phone.fill('#name', 'Celular')
  await phone.click('#go')
  await phone.waitForSelector('#pad', { state: 'visible', timeout: 15000 })
  await page.waitForFunction(() => /Celular conectado/.test(document.querySelector('#slots')?.textContent || ''), null, { timeout: 15000 })
  // escolha de classe: teclado D e A (volta ao Atirador); celular ▶ duas vezes (Samurai → Mago → Bardo)
  await page.keyboard.press('d'); await page.keyboard.press('a')
  await phone.waitForSelector('#pick', { state: 'visible', timeout: 15000 })
  for (let i = 0; i < 2; i++) { await phone.click('#next'); await wait(400) }
  await page.waitForFunction(() => (document.querySelector('#slots')?.textContent || '').includes('Bardo'), null, { timeout: 15000 }).catch(() => fail('o celular não conseguiu trocar a classe no menu'))
  await page.screenshot({ path: path.join(OUT, '01-lobby.jpg'), type: 'jpeg', quality: 70 })

  note(`4/4 jogando ${PLAY_SECONDS} s…`)
  await page.click('#start')
  await page.waitForFunction(() => document.querySelectorAll('#plist .pl').length === 2, null, { timeout: 30000 })
  const cls = await page.textContent('#plist')
  if (!cls.includes('🔫 Jogador 1') || !cls.includes('🪕 Celular')) fail(`classes erradas na partida: ${cls.replace(/\s+/g, ' ').slice(0, 120)}`)
  await play(page, phone)

  const hud = await page.evaluate(() => ({ topo: document.querySelector('#top')?.innerText, jogadores: document.querySelector('#plist')?.innerText }))
  note(`   HUD: ${JSON.stringify(hud)}`)
  if (frames < 3) fail(`o jogo quase não desenhou quadros (${frames} medições de FPS)`)
  // Esc volta ao menu
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('#lobby').classList.contains('hidden'), null, { timeout: 20000 }).catch(() => fail('Esc não voltou ao menu'))
} catch (e) {
  fail(`o teste parou: ${e.message.split('\n')[0]}`)
  log.push(e.stack || String(e))
} finally {
  if (browser) await browser.close()
  stopAll()
}

log.push('', problems.length ? `FALHOU (${problems.length} problema(s))` : 'PASSOU')
fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\n')
if (problems.length) {
  console.log(`\n✗ FALHOU: ${problems.length} problema(s). Detalhes em smoke/log.txt`)
  process.exitCode = 1
} else console.log('\n✓ PASSOU: nenhum erro no console. Capturas em smoke/')
