import { PointInBuilding } from '../world/buildings-registry'

// =====================================================================================
//  Motor de áudio procedural (Web Audio): nenhum arquivo de som — tudo é sintetizado na hora com osciladores,
//  ruído, filtros e cordas dedilhadas (Karplus-Strong calculado uma vez por nota).
//  Barramentos: master ← compressor ← { sfx, amb (abafa dentro de casa), ui }.
//  Sons posicionais: volume, pan e "abafado" pela distância até o ouvinte mais perto (os jogadores; no menu, o centro
//  da cena) — com split screen todos dividem as mesmas caixas de som, então vale o jogador mais perto da fonte.
//  O navegador só libera o áudio depois de um clique/tecla: até lá, tudo vira no-op. Tecla M liga/desliga o som.
// =====================================================================================

export const A = { ctx: null, sfx: null, amb: null, ui: null, ambLP: null, white: null, brown: null, master: null, muted: false }
const MAX_VOICES = 56
let live = 0
const ears = [{ x: 8, z: -6 }]
const last = new Map()

function unlock() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return }
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  const ctx = (A.ctx = new AC())
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25
  A.master = ctx.createGain(); A.master.gain.value = A.muted ? 0 : 0.85
  comp.connect(A.master).connect(ctx.destination)
  const bus = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(comp); return g }
  A.sfx = bus(1); A.ui = bus(0.6)
  A.amb = ctx.createGain()
  A.ambLP = ctx.createBiquadFilter(); A.ambLP.type = 'lowpass'; A.ambLP.frequency.value = 20000
  A.amb.connect(A.ambLP).connect(bus(0.9))
  A.white = noiseBuf(false); A.brown = noiseBuf(true)
}
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, unlock, { capture: true })
addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'm' || (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) return
  A.muted = !A.muted
  if (A.master) A.master.gain.setTargetAtTime(A.muted ? 0 : 0.85, A.ctx.currentTime, 0.05)
})

function noiseBuf(brown) {
  const n = A.ctx.sampleRate * 2, b = A.ctx.createBuffer(1, n, A.ctx.sampleRate), d = b.getChannelData(0)
  let l = 0
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5 } else d[i] = w }
  return b
}

export const ready = () => !!A.ctx && A.ctx.state === 'running' && !A.muted
export const now = () => A.ctx.currentTime
// limita a repetição de um som (ex.: 7 chumbos da espingarda acertando juntos viram 1-2 sons)
export function gate(key, gap) {
  const t = performance.now(), l = last.get(key) || 0
  if (t - l < gap * 1000) return false
  last.set(key, t)
  return true
}

// ouvintes: jogadores vivos (ou o centro do menu)
export function SetEars(list) {
  ears.length = 0
  for (const p of list) ears.push({ x: p.x, z: p.z, inside: PointInBuilding(p.x, p.z) })
}
export const Ears = () => ears

// volume/pan/abafado de uma fonte em (x, z); null = longe demais. Sem x: som "de tela" (centro, volume cheio)
export function where(x, z, range = 40) {
  if (x === undefined) return { g: 1, pan: 0, lp: 20000, d: 0 }
  let best = ears[0], bd = Infinity
  for (const e of ears) { const d = (e.x - x) ** 2 + (e.z - z) ** 2; if (d < bd) { bd = d; best = e } }
  const d = Math.sqrt(bd)
  if (!best || d > range) return null
  const k = d / range
  let lp = 20000 * (1 - k) ** 2.2 + 700
  // parede no meio: quem está dentro de casa ouve a rua abafada (e vice-versa)
  if (d > 2 && !!best.inside !== PointInBuilding(x, z)) lp = Math.min(lp, 1100)
  return { g: (1 - k * k) * (7 / (7 + d)), pan: Math.max(-0.85, Math.min(0.85, (x - best.x) / 14)), lp, d }
}

// uma "voz": ganho → pan → (passa-baixa pela distância) → barramento. Some sozinha depois de dur segundos.
export function voice(o, range, dur, bus = A.sfx) {
  if (!ready() || (live >= MAX_VOICES && o.x !== undefined)) return null // sons de tela (fim de jogo, início) nunca ficam de fora
  const w = where(o.x, o.z, range)
  if (!w || w.g * (o.vol ?? 1) < 0.004) return null
  const ctx = A.ctx, g = ctx.createGain(), pan = ctx.createStereoPanner()
  g.gain.value = w.g * (o.vol ?? 1)
  pan.pan.value = w.pan
  g.connect(pan)
  let tail = pan
  if (w.lp < 16000) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = w.lp; pan.connect(f); tail = f }
  tail.connect(bus)
  live++
  setTimeout(() => { live--; tail.disconnect() }, (dur + (o.delay || 0) + 0.3) * 1000)
  return g
}

// ---------------------------------------------------------------- primitivas (t = instante absoluto do contexto)
// envelope: sobe em a, decai exponencialmente até t + dur
export function env(param, t, a, dur, peak = 1) {
  param.setValueAtTime(0.0001, t)
  param.linearRampToValueAtTime(peak, t + a)
  param.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01))
}
// oscilador com envelope; f1 = glissando até o fim
export function tone(out, t, { type = 'sine', f, f1, dur = 0.2, a = 0.005, vol = 1, glide }) {
  const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + (glide || dur))
  env(g.gain, t, a, dur, vol)
  o.connect(g).connect(out)
  o.start(t); o.stop(t + dur + 0.05)
  return o
}
// ruído filtrado com envelope (f1 = varredura do filtro)
export function hiss(out, t, { dur = 0.2, a = 0.003, vol = 1, type = 'bandpass', f = 1000, f1, q = 0.8, brown = false, rate = 1 }) {
  const ctx = A.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain()
  s.buffer = brown ? A.brown : A.white
  s.loop = true
  s.playbackRate.value = rate
  fl.type = type; fl.Q.value = q
  fl.frequency.setValueAtTime(f, t)
  if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur)
  env(g.gain, t, a, dur, vol)
  s.connect(fl).connect(g).connect(out)
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05)
  return fl
}
// estalo metálico curto (gatilho, ferrolho, trinco)
export function click(out, t, f = 2400, vol = 0.5) {
  hiss(out, t, { dur: 0.018, vol, type: 'highpass', f: 3000, q: 0.5 })
  tone(out, t, { type: 'square', f, f1: f * 0.7, dur: 0.03, vol: vol * 0.25 })
}
// parciais inarmônicas = metal (lataria, katana, sino)
export function metal(out, t, { f = 400, dur = 0.5, vol = 0.4, ratios = [1, 1.52, 2.31, 3.17, 4.43] }) {
  ratios.forEach((r, i) => tone(out, t, { f: f * r * (0.98 + Math.random() * 0.04), dur: dur / (1 + i * 0.35), vol: vol / (1 + i * 0.6), a: 0.001 }))
}
const curves = new Map()
export function shaper(k) {
  if (!curves.has(k)) {
    const n = 1024, c = new Float32Array(n)
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)) }
    curves.set(k, c)
  }
  const s = A.ctx.createWaveShaper()
  s.curve = curves.get(k)
  return s
}
// voz (zumbi gemendo, jogador gemendo): dente-de-serra com tremor → distorção → formantes (bandpass em paralelo)
// f → f1 = contorno de altura · form = [F1, F2] · rough = distorção · breath = ruído soprado
export function vocal(out, t, { f = 90, f1, dur = 1, a = 0.08, vol = 1, form = [500, 900], rough = 4, breath = 0.3, wob = 9, depth = 0.08 }) {
  const ctx = A.ctx, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), sh = shaper(rough)
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(f, t)
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  lfo.frequency.value = wob * (0.8 + Math.random() * 0.4)
  lg.gain.value = f * depth
  lfo.connect(lg).connect(o.frequency)
  o.connect(sh)
  const mix = ctx.createGain()
  form.forEach((F, i) => {
    const b = ctx.createBiquadFilter()
    b.type = 'bandpass'; b.frequency.value = F; b.Q.value = 5 + i * 3
    const bg = ctx.createGain(); bg.gain.value = i ? 0.55 : 1
    sh.connect(b).connect(bg).connect(mix)
  })
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(vol, t + a)
  g.gain.setValueAtTime(vol, t + dur * 0.6)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  mix.connect(g).connect(out)
  if (breath) hiss(out, t, { dur, a, vol: vol * breath, f: form[0] * 1.6, q: 1.2 })
  o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05)
}

// corda dedilhada (Karplus-Strong): buffer calculado uma vez por nota e reaproveitado
const plucks = new Map()
export function pluckBuf(freq, decay = 0.996) {
  const key = `${Math.round(freq)}:${decay}`
  if (plucks.has(key)) return plucks.get(key)
  const sr = A.ctx.sampleRate, n = Math.floor(sr * 1.8), N = Math.max(2, Math.round(sr / freq))
  const b = A.ctx.createBuffer(1, n, sr), d = b.getChannelData(0), ring = new Float32Array(N)
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1
  let p = 0
  for (let i = 0; i < n; i++) {
    const q = (p + 1) % N
    d[i] = ring[p]
    ring[p] = (ring[p] + ring[q]) * 0.5 * decay
    p = q
  }
  plucks.set(key, b)
  return b
}
export function pluck(out, t, freq, vol = 0.6, decay) {
  const s = A.ctx.createBufferSource(), g = A.ctx.createGain()
  s.buffer = pluckBuf(freq, decay)
  g.gain.value = vol
  s.connect(g).connect(out)
  s.start(t)
}
export const midi = (m) => 440 * 2 ** ((m - 69) / 12)
export const rnd = (a, b) => a + Math.random() * (b - a)
