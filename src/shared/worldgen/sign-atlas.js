import * as THREE from 'three'

// Atlas de placas: UM canvas/textura para todas as placas do mundo. Cada texto é desenhado numa célula fixa do seu tamanho;
// as placas dos chunks só guardam o retângulo UV. Cada chunk segura os textos que usa (SignUV) e devolve quando sai
// (ReleaseSignUV): uma célula só recebe outro texto quando nenhum chunk carregado usa mais o texto antigo.
// Sem célula livre (ex.: tela dividida em 4 numa cidade), a placa fica sem texto em vez de mostrar o de outra.
const W = 2048, H = 2048
let canvas = null, ctx = null, tex = null
// células por tamanho: largura × altura, linha inicial (y) e quantas linhas (medido: 1 grupo usa até 6/8/13/12 ao mesmo tempo)
const POOLS = {
  small: { w: 128, h: 128, y: 0, rows: 1 }, // PARE, velocidade, sem saída… (16 células; a última fica sempre em branco)
  km: { w: 256, h: 128, y: 128, rows: 3 }, // marcos de km (24)
  name: { w: 512, h: 128, y: 512, rows: 4 }, // nomes de rua e de povoado (16)
  dir: { w: 512, h: 256, y: 1024, rows: 4 }, // painéis de direção (16)
}
const POOL_OF = { name: 'name', city: 'name', km: 'km', dir: 'dir' } // os outros tipos: small
const uvOf = (x, y, w, h) => ({ u0: x / W, u1: (x + w) / W, v0: 1 - (y + h) / H, v1: 1 - y / H, w, h })
for (const p of Object.values(POOLS)) {
  p.cells = []
  for (let r = 0; r < p.rows; r++) for (let x = 0; x + p.w <= W; x += p.w) p.cells.push({ x, y: p.y + r * p.h, uv: uvOf(x, p.y + r * p.h, p.w, p.h), key: null, users: 0, freed: 0 })
}
const BLANK = { ...POOLS.small.cells.pop().uv, blank: true } // célula nunca desenhada (transparente): quando falta lugar; não precisa devolver
const slots = new Map() // texto -> célula
let clock = 0, overflow = 0

function init() {
  if (ctx || typeof document === 'undefined') return
  try {
    canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    ctx = canvas.getContext('2d')
    if (!ctx) { canvas = null; return }
    tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
  } catch { canvas = ctx = tex = null }
}
export const AtlasTexture = () => { init(); return tex }
// esquece todas as placas desenhadas (só depois de descarregar todos os chunks: as placas na tela apontam para o atlas)
export function ResetSignAtlas() {
  slots.clear()
  for (const p of Object.values(POOLS)) for (const c of p.cells) Object.assign(c, { key: null, users: 0, freed: 0 })
  if (ctx) { ctx.clearRect(0, 0, W, H); tex.needsUpdate = true }
}
// para testes: quantas células estão em uso em cada tamanho e quantas placas ficaram sem lugar
export const SignAtlasStats = () => ({ overflow, used: Object.fromEntries(Object.entries(POOLS).map(([k, p]) => [k, p.cells.filter((c) => c.users > 0).length])) })

// ---------- desenhos ----------
function fitText(c, text, maxW, size, font = 'system-ui, Arial, sans-serif', weight = 'bold') {
  let s = size
  do { c.font = `${weight} ${s}px ${font}`; if (c.measureText(text).width <= maxW) break; s -= 2 } while (s > 14)
  return s
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
function plate(c, x, y, w, h, bg, fg, border, lines, size) {
  c.fillStyle = bg; roundRect(c, x + 2, y + 2, w - 4, h - 4, 12); c.fill()
  c.strokeStyle = border; c.lineWidth = 6; roundRect(c, x + 8, y + 8, w - 16, h - 16, 8); c.stroke()
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'
  const lh = (h - 24) / lines.length
  lines.forEach((t, i) => { const s = fitText(c, t, w - 44, Math.min(size, lh * 0.8)); c.fillText(t, x + w / 2, y + 12 + lh * (i + 0.5)) })
}
const DRAW = {
  stop(c, x, y) {
    c.beginPath()
    for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; c[k ? 'lineTo' : 'moveTo'](x + 64 + Math.cos(a) * 62, y + 64 + Math.sin(a) * 62) }
    c.closePath(); c.fillStyle = '#fff'; c.fill()
    c.beginPath()
    for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + k * Math.PI / 4; c[k ? 'lineTo' : 'moveTo'](x + 64 + Math.cos(a) * 55, y + 64 + Math.sin(a) * 55) }
    c.closePath(); c.fillStyle = '#d72a2a'; c.fill()
    c.fillStyle = '#fff'; c.font = 'bold 36px system-ui, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('STOP', x + 64, y + 66)
  },
  speed(c, x, y, v) {
    c.fillStyle = '#d72a2a'; c.beginPath(); c.arc(x + 64, y + 64, 62, 0, 7); c.fill()
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 64, y + 64, 47, 0, 7); c.fill()
    c.fillStyle = '#111'; c.font = 'bold 54px system-ui, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(v, x + 64, y + 68)
  },
  noentry(c, x, y) {
    c.fillStyle = '#d72a2a'; c.beginPath(); c.arc(x + 64, y + 64, 62, 0, 7); c.fill()
    c.fillStyle = '#fff'; c.fillRect(x + 22, y + 54, 84, 20)
  },
  deadend(c, x, y) { // quadrado azul com um "T" (rua sem saída)
    c.fillStyle = '#fff'; roundRect(c, x + 2, y + 2, 124, 124, 10); c.fill()
    c.fillStyle = '#1b5fb8'; roundRect(c, x + 8, y + 8, 112, 112, 8); c.fill()
    c.fillStyle = '#fff'; c.fillRect(x + 62, y + 26, 14, 56); c.fillStyle = '#d72a2a'; c.fillRect(x + 28, y + 80, 72, 14); c.fillStyle = '#fff'; c.fillRect(x + 28, y + 94, 72, 6)
  },
  work(c, x, y) { // triângulo amarelo de obra
    c.fillStyle = '#d72a2a'; c.beginPath(); c.moveTo(x + 64, y + 4); c.lineTo(x + 124, y + 116); c.lineTo(x + 4, y + 116); c.closePath(); c.fill()
    c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(x + 64, y + 24); c.lineTo(x + 106, y + 104); c.lineTo(x + 22, y + 104); c.closePath(); c.fill()
    c.fillStyle = '#111'; c.beginPath(); c.arc(x + 64, y + 58, 7, 0, 7); c.fill(); c.fillRect(x + 59, y + 66, 10, 20); c.beginPath(); c.moveTo(x + 40, y + 96); c.lineTo(x + 88, y + 96); c.lineTo(x + 76, y + 82); c.lineTo(x + 52, y + 82); c.fill()
  },
  xwalk(c, x, y) { // passagem de pedestres: quadrado azul com triângulo
    c.fillStyle = '#fff'; roundRect(c, x + 2, y + 2, 124, 124, 10); c.fill()
    c.fillStyle = '#1b5fb8'; roundRect(c, x + 8, y + 8, 112, 112, 8); c.fill()
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x + 64, y + 20); c.lineTo(x + 108, y + 100); c.lineTo(x + 20, y + 100); c.closePath(); c.fill()
    c.fillStyle = '#111'; c.beginPath(); c.arc(x + 62, y + 50, 6, 0, 7); c.fill(); c.fillRect(x + 58, y + 57, 9, 18); c.fillRect(x + 54, y + 74, 6, 14); c.fillRect(x + 64, y + 74, 6, 14)
  },
  park(c, x, y) { // estacionamento "P"
    c.fillStyle = '#fff'; roundRect(c, x + 2, y + 2, 124, 124, 10); c.fill()
    c.fillStyle = '#1b5fb8'; roundRect(c, x + 8, y + 8, 112, 112, 8); c.fill()
    c.fillStyle = '#fff'; c.font = 'bold 84px system-ui, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', x + 64, y + 68)
  },
  bus(c, x, y) { // ponto de ônibus: quadrado azul com um ônibus branco de frente
    c.fillStyle = '#fff'; roundRect(c, x + 2, y + 2, 124, 124, 10); c.fill()
    c.fillStyle = '#1b5fb8'; roundRect(c, x + 8, y + 8, 112, 112, 8); c.fill()
    c.fillStyle = '#fff'; roundRect(c, x + 30, y + 22, 68, 76, 12); c.fill()
    c.fillStyle = '#1b5fb8'; c.fillRect(x + 38, y + 32, 52, 28); c.fillRect(x + 38, y + 84, 14, 8); c.fillRect(x + 76, y + 84, 14, 8)
    c.fillStyle = '#fff'; c.fillRect(x + 34, y + 98, 14, 12); c.fillRect(x + 80, y + 98, 14, 12)
  },
  name(c, x, y, t) { plate(c, x, y, 512, 128, '#1c6b4a', '#fff', '#fff', t.split('|'), 62) }, // placa de rua: verde com texto branco
  city(c, x, y, t) { // entrada de povoado: branca, borda preta
    c.fillStyle = '#fff'; roundRect(c, x + 2, y + 2, 508, 124, 14); c.fill()
    c.strokeStyle = '#111'; c.lineWidth = 8; roundRect(c, x + 10, y + 10, 492, 108, 8); c.stroke()
    c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; fitText(c, t, 440, 62); c.fillText(t, x + 256, y + 66)
  },
  km(c, x, y, t) { // marco de quilômetro: placa branca com código da estrada e km
    const [code, km] = t.split('|')
    c.fillStyle = '#fff'; roundRect(c, x + 2, y + 2, 252, 124, 10); c.fill()
    c.fillStyle = '#c0252a'; c.fillRect(x + 8, y + 8, 240, 40)
    c.fillStyle = '#fff'; c.font = 'bold 32px system-ui, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(code, x + 128, y + 30)
    c.fillStyle = '#111'; c.font = 'bold 58px system-ui, Arial'; c.fillText('km ' + km, x + 128, y + 90)
  },
  dir(c, x, y, t) { // painel de direção: verde, até 3 linhas "seta  nome  km"
    const lines = t.split('|')
    c.fillStyle = '#fff'; roundRect(c, x + 2, y + 2, 508, 252, 16); c.fill()
    c.fillStyle = '#176a3c'; roundRect(c, x + 8, y + 8, 496, 240, 12); c.fill()
    const lh = 224 / Math.max(3, lines.length)
    lines.forEach((ln, i) => {
      const [arrow, name, km] = ln.split('~')
      const cy = y + 20 + lh * (i + 0.5)
      c.fillStyle = '#fff'; c.textBaseline = 'middle'
      c.textAlign = 'left'; c.font = 'bold 60px system-ui, Arial'; c.fillText(arrow, x + 26, cy)
      c.textAlign = 'right'; c.font = 'bold 44px system-ui, Arial'; if (km) c.fillText(km, x + 486, cy)
      c.textAlign = 'left'; const s = fitText(c, name, km ? 290 : 380, 50); c.fillText(name, x + 96, cy)
      if (i < lines.length - 1) { c.fillStyle = '#ffffff55'; c.fillRect(x + 20, y + 20 + lh * (i + 1), 472, 2) }
    })
  },
}
// célula para um texto novo: uma nunca usada, senão a que ficou livre há mais tempo; null = todas em uso
function take(pool) {
  let best = null
  for (const c of pool.cells) {
    if (!c.key) return c
    if (!c.users && (!best || c.freed < best.freed)) best = c
  }
  return best
}

// chave "tipo:argumento" -> {u0,v0,u1,v1}. Quem chama passa a segurar o texto até chamar ReleaseSignUV(chave)
// (exceto se voltar uv.blank: faltou lugar, a placa fica sem texto e não segura nada).
// Sem canvas (testes sem navegador) só reserva a célula, sem desenhar.
export function SignUV(key) {
  let cell = slots.get(key)
  if (!cell) {
    init()
    const [kind, ...rest] = key.split(':'), arg = rest.join(':'), pool = POOLS[POOL_OF[kind] || 'small']
    cell = take(pool)
    if (!cell) { overflow++; return BLANK }
    if (cell.key) slots.delete(cell.key) // o texto antigo não está em nenhum chunk carregado
    cell.key = key
    slots.set(key, cell)
    if (ctx) {
      const { x, y } = cell, { w, h } = pool
      ctx.clearRect(x, y, w, h)
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
      DRAW[kind](ctx, x, y, arg)
      ctx.restore()
      tex.needsUpdate = true
    }
  }
  cell.users++
  return cell.uv
}
// o chunk saiu: devolve o texto (a célula pode ser redesenhada quando ninguém mais usar)
export function ReleaseSignUV(key) {
  const cell = slots.get(key)
  if (cell && cell.users > 0 && !--cell.users) cell.freed = ++clock
}
