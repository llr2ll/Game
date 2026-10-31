// npm run check — duas verificações rápidas (~3 s), sem navegador:
// 1. Camadas: os imports só descem. games/<jogo> → shared → engine.
//    engine não importa shared nem games; shared não importa games; um jogo não importa outro jogo.
//    Também falha se um import aponta para arquivo que não existe.
// 2. Mundo: gera ~500 pedaços do mapa sem desenhar e compara a "impressão digital" com scripts/world-fingerprint.txt.
//    Mudou sem querer = mesmo lugar, outro mundo. Se a mudança foi de propósito: npm run check -- --update-world
//    Também gera um trecho de novo forçando os caches (engine/core/memo.js) a esquecer tudo antes de cada chunk:
//    tem de dar igual (esquecer só pode custar tempo, nunca mudar o mundo).
// 3. Jogo: replay de 100 s com 4 jogadores, sorteio e relógio fixos (scripts/sim.mjs), comparado com scripts/sim-fingerprint.txt.
//    PR de organização tem de dar igual. PR que muda a jogabilidade de propósito: npm run check -- --update-sim
//    (e dizer isso na descrição do PR).
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC = path.join(ROOT, 'src')
const FP_FILE = path.join(ROOT, 'scripts/world-fingerprint.txt')
const SIM_FILE = path.join(ROOT, 'scripts/sim-fingerprint.txt')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const PACKAGES = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
const problems = []

// ---------------------------------------------------------------- 1. camadas
const files = []
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') && files.push(path.join(d, e.name)) }
walk(SRC)

// camada de um arquivo: 'engine' | 'shared' | 'games/<nome>' | null (fora das camadas)
function layerOf(file) {
  const [a, b] = path.relative(SRC, file).split(path.sep)
  if (a === 'engine' || a === 'shared') return a
  if (a === 'games' && b && !b.endsWith('.js')) return `games/${b}`
  return null
}
const allowed = (from, to) => from === to || to === 'engine' || (to === 'shared' && from !== 'engine')
const resolveImport = (file, spec) => {
  const base = path.resolve(path.dirname(file), spec)
  return [base, base + '.js', path.join(base, 'index.js')].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
}
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

for (const file of files) {
  const rel = path.relative(ROOT, file)
  const from = layerOf(file)
  if (!from) { problems.push(`${rel}: arquivo fora de src/engine, src/shared ou src/games/<jogo>`); continue }
  const code = fs.readFileSync(file, 'utf8')
  for (const m of code.matchAll(IMPORT)) {
    const spec = m[1] || m[2] || m[3]
    if (!spec.startsWith('.')) {
      if (!PACKAGES.some((p) => spec === p || spec.startsWith(p + '/'))) problems.push(`${rel}: importa o pacote "${spec}", que não está no package.json`)
      continue
    }
    const target = resolveImport(file, spec)
    if (!target) { problems.push(`${rel}: importa "${spec}", que não existe`); continue }
    const to = layerOf(target)
    if (!allowed(from, to)) problems.push(`${rel}: ${from} não pode importar ${to} ("${spec}")`)
  }
}
// as páginas apontam para scripts que existem?
for (const html of ['index.html', 'controller.html']) {
  const code = fs.readFileSync(path.join(ROOT, html), 'utf8')
  for (const m of code.matchAll(/(?:src="|from ')\.?(\/src\/[^"']+)["']/g)) if (!fs.existsSync(path.join(ROOT, m[1]))) problems.push(`${html}: aponta para ${m[1]}, que não existe`)
}
console.log(`camadas: ${files.length} arquivos verificados`)

// ---------------------------------------------------------------- 2. mundo
// só os geradores puros (descritores de casas, estradas, placas, nomes); nada é desenhado
async function worldFingerprint() {
  const vite = await createServer({ root: ROOT, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    const { Seed } = await vite.ssrLoadModule('/src/shared/worldgen/map.js')
    const { NodeName, Destination } = await vite.ssrLoadModule('/src/shared/worldgen/names.js')
    const { NodeType } = await vite.ssrLoadModule('/src/shared/worldgen/layout.js')
    const h = createHash('sha256')
    // largada, um trecho longe ao norte e outro a leste
    const areas = [[-10, 10, -10, 10], [-3, 3, 290, 296], [38, 42, -52, -48]]
    let n = 0
    for (const [x0, x1, z0, z1] of areas) for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { h.update(JSON.stringify(Seed(cx, cz))); n++ }
    for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) h.update(JSON.stringify([NodeType(i, j), NodeName(i, j), [0, 1, 2, 3].map((k) => Destination(i, j, k))]))
    const fp = `${n} chunks · ${h.digest('hex')}`

    // esquecimento forçado: largada + primeira cidade + um trecho longe
    const { SetCacheScale, TrimCaches } = await vite.ssrLoadModule('/src/engine/core/memo.js')
    const part = (trim) => {
      const g = createHash('sha256')
      for (const [x0, x1, z0, z1] of [[-6, 6, -4, 8], [38, 40, -52, -50]]) for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { if (trim) TrimCaches(); g.update(JSON.stringify(Seed(cx, cz))) }
      return g.digest('hex')
    }
    // limites pequenos (esquece quase tudo / só parte): pega cache que guarda estado ou caches ligados esquecidos separados
    const warm = part(false)
    for (const scale of [0, 0.004, 0.02]) {
      SetCacheScale(scale)
      const cold = part(true)
      SetCacheScale(1)
      if (warm !== cold) { problems.push(`esquecer os caches mudou o mundo (limite x${scale}): algum cache guarda estado (veja engine/core/memo.js)`); break }
    }
    if (!problems.length) console.log('caches: esquecer não muda o mundo')
    return fp
  } finally { await vite.close() }
}
try {
  const fp = await worldFingerprint()
  if (process.argv.includes('--update-world')) { fs.writeFileSync(FP_FILE, fp + '\n'); console.log(`mundo: impressão digital atualizada (${fp})`) }
  else {
    const saved = fs.existsSync(FP_FILE) ? fs.readFileSync(FP_FILE, 'utf8').trim() : ''
    if (fp !== saved) problems.push(`o mundo mudou: ${fp} (esperado ${saved || 'nada salvo'}). Se foi de propósito: npm run check -- --update-world`)
    else console.log(`mundo: igual (${fp.slice(0, 26)}…)`)
  }
} catch (e) { problems.push(`não consegui gerar o mundo: ${e.message}`) }

// ---------------------------------------------------------------- 3. jogo (replay)
try {
  // processo novo: o replay precisa começar do zero (ver scripts/sim.mjs)
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts/sim.mjs'), '--json'], { cwd: ROOT, encoding: 'utf8' })
  const sim = JSON.parse(out.trim().split('\n').pop())
  if (process.argv.includes('--update-sim')) { fs.writeFileSync(SIM_FILE, sim.hash + '\n'); console.log(`jogo: replay atualizado (${sim.summary})`) }
  else {
    const saved = fs.existsSync(SIM_FILE) ? fs.readFileSync(SIM_FILE, 'utf8').trim() : ''
    if (sim.hash !== saved) problems.push(`a jogabilidade mudou no replay (${sim.summary}). Se foi de propósito: npm run check -- --update-sim`)
    else console.log(`jogo: replay igual (${sim.summary})`)
  }
} catch (e) { problems.push(`não consegui rodar o replay: ${e.message}`) }

if (problems.length) {
  console.log(`\n✗ FALHOU: ${problems.length} problema(s)`)
  for (const p of problems) console.log(`  - ${p}`)
  process.exitCode = 1
} else console.log('\n✓ PASSOU')
