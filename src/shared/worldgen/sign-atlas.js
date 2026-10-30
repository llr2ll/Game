import * as THREE from 'three'

// Atlas de placas: UM canvas/textura para todas as placas do mundo. Cada texto é desenhado uma única vez
// (na primeira vez que aparece) numa prateleira livre; as placas dos chunks só guardam o retângulo UV.
const W = 2048, H = 2048
let canvas = null, ctx = null, tex = null
const slots = new Map()
const cur = { a: { x: 0, y: 0, cap: 1024, h: 128 }, b: { x: 0, y: 1024, cap: 1024, h: 256 } } // faixa A: placas baixas; faixa B: painéis de direção

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
  Object.assign(cur.a, { x: 0, y: 0 }); Object.assign(cur.b, { x: 0, y: 1024 })
  if (ctx) { ctx.clearRect(0, 0, W, H); tex.needsUpdate = true }
}

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
// tamanho de cada tipo no atlas: [largura, altura, faixa]
const SIZE = { stop: [128, 128, 'a'], speed: [128, 128, 'a'], noentry: [128, 128, 'a'], deadend: [128, 128, 'a'], work: [128, 128, 'a'], xwalk: [128, 128, 'a'], park: [128, 128, 'a'], bus: [128, 128, 'a'], name: [512, 128, 'a'], city: [512, 128, 'a'], km: [256, 128, 'a'], dir: [512, 256, 'b'] }

// chave "tipo:argumento" -> {u0,v0,u1,v1}. Devolve UV vazio se não houver canvas (testes sem navegador).
export function SignUV(key) {
  if (slots.has(key)) return slots.get(key)
  init()
  const [kind, ...rest] = key.split(':'), arg = rest.join(':'), [w, h, band] = SIZE[kind]
  const c = cur[band]
  if (c.x + w > W) { c.x = 0; c.y += c.h; if (c.y + c.h > (band === 'a' ? 1024 : H)) c.y = band === 'a' ? 0 : 1024 } // acabou o espaço: recomeça (placas antigas já saíram da tela)
  const x = c.x, y = c.y
  c.x += w
  const uv = { u0: x / W, u1: (x + w) / W, v0: 1 - (y + h) / H, v1: 1 - y / H, w, h }
  if (ctx) {
    ctx.clearRect(x, y, w, h)
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
    DRAW[kind](ctx, x, y, arg)
    ctx.restore()
    tex.needsUpdate = true
  }
  slots.set(key, uv)
  return uv
}
