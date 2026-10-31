import { A, voice, now, gate, tone, hiss, click, metal, vocal, pluck, midi, rnd } from '../../engine/audio/engine'

// =====================================================================================
//  Biblioteca de efeitos sonoros (um disparo cada). sfx(nome, { x, z, vol, ... }) — sem x/z = som "de tela".
//  Cada receita: [alcance em metros (0 = não posicional), duração, (saída, instante, opções) => monta o som, barramento?]
//  barramento 'amb' = natureza/clima (abafado quando todos estão dentro de casa)
// =====================================================================================

const LUTE = [62, 64, 66, 69, 71, 74, 76, 78, 81] // ré maior pentatônica (alaúde do bardo)
const pick = (a) => a[(Math.random() * a.length) | 0]

// passos por superfície: grama/terra · asfalto/calçada · madeira (píer, ponte, casa) · água
function step(out, t, o) {
  const run = o.run ? 1.35 : 1
  switch (o.surf) {
    case 'hard':
      hiss(out, t, { dur: 0.05, vol: 0.5 * run, f: rnd(1800, 2600), q: 1.4 })
      tone(out, t, { f: rnd(90, 120), f1: 60, dur: 0.06, vol: 0.35 * run })
      break
    case 'wood':
      tone(out, t, { type: 'triangle', f: rnd(170, 210), f1: 120, dur: 0.1, vol: 0.45 * run })
      tone(out, t, { f: rnd(330, 380), dur: 0.06, vol: 0.15 * run })
      hiss(out, t, { dur: 0.05, vol: 0.25 * run, f: 1100, q: 1 })
      break
    case 'water':
      hiss(out, t, { dur: 0.28, a: 0.02, vol: 0.55 * run, f: 1400, f1: 500, q: 0.9 })
      tone(out, t + 0.03, { f: rnd(500, 700), f1: rnd(1100, 1500), dur: 0.07, vol: 0.12 })
      break
    default: // grama, terra, mato
      hiss(out, t, { dur: 0.09, vol: 0.4 * run, f: rnd(1300, 2000), q: 0.7 })
      hiss(out, t + 0.01, { dur: 0.06, vol: 0.18 * run, type: 'highpass', f: 4000 })
  }
  if (o.wet && o.surf !== 'water') hiss(out, t + 0.01, { dur: 0.12, vol: 0.2 * run, f: 900, f1: 1800, q: 1.2 }) // chão molhado
}

// tiro: estalo + corpo + baque grave + cauda (o "eco" que ainda soa depois)
function shot(out, t, { body, len, low, tail, crack }) {
  hiss(out, t, { dur: 0.012, vol: crack, type: 'highpass', f: 3500 })
  hiss(out, t, { dur: len, a: 0.001, vol: 1, f: body, f1: body * 0.4, q: 0.7 })
  tone(out, t, { f: low, f1: 40, dur: len * 0.8, vol: 0.9 })
  hiss(out, t + 0.02, { dur: tail, a: 0.02, vol: 0.28, type: 'lowpass', f: 900, f1: 200, brown: true })
}
// explosão: estrondo grave + varredura de ruído + estalos de destroços
function boom(out, t, big = 1) {
  tone(out, t, { f: 90, f1: 28, dur: 0.9 * big, vol: 1.2 })
  hiss(out, t, { dur: 1.8 * big, a: 0.005, vol: 1.3, type: 'lowpass', f: 2600, f1: 90, q: 0.5, brown: true })
  hiss(out, t, { dur: 0.35, vol: 0.9, f: 1800, f1: 400, q: 0.5 })
  for (let i = 0; i < 7; i++) hiss(out, t + rnd(0.15, 0.9), { dur: 0.03, vol: rnd(0.08, 0.2), type: 'highpass', f: rnd(2500, 5000) })
}
// corpo caindo no chão
const thud = (out, t, vol = 0.8) => { tone(out, t, { f: 95, f1: 38, dur: 0.22, vol }); hiss(out, t, { dur: 0.16, vol: vol * 0.6, type: 'lowpass', f: 500, brown: true }) }
// carne: pancada abafada + "squish" molhado
const flesh = (out, t, vol = 0.7) => { tone(out, t, { f: 140, f1: 60, dur: 0.09, vol }); hiss(out, t, { dur: 0.12, vol: vol * 0.7, f: 500, f1: 1400, q: 3 }); hiss(out, t + 0.02, { dur: 0.08, vol: vol * 0.4, type: 'lowpass', f: 900 }) }
// whoosh: ruído com o filtro varrendo
const whoosh = (out, t, f0, f1, dur, vol) => hiss(out, t, { dur, a: dur * 0.4, vol, f: f0, f1, q: 1.6 })
// rangido de dobradiça: dente-de-serra lento passando por um filtro ressonante que treme
function creak(out, t, dur, vol) {
  const o = A.ctx.createOscillator(), b = A.ctx.createBiquadFilter(), g = A.ctx.createGain(), l = A.ctx.createOscillator(), lg = A.ctx.createGain()
  o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(55, 75), t); o.frequency.linearRampToValueAtTime(rnd(90, 130), t + dur)
  l.type = 'square'; l.frequency.value = rnd(18, 30); lg.gain.value = 25
  l.connect(lg).connect(o.frequency)
  b.type = 'bandpass'; b.frequency.value = rnd(900, 1400); b.Q.value = 9
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(b).connect(g).connect(out)
  o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05)
}
// arpejo de alaúde
const arp = (out, t, notes, gap, vol = 0.5) => notes.forEach((m, i) => pluck(out, t + i * gap, midi(m), vol))
// sininho (cura, revive, coleta)
const bell = (out, t, f, vol = 0.3, dur = 0.9) => { tone(out, t, { f, dur, vol, a: 0.002 }); tone(out, t, { f: f * 2.76, dur: dur * 0.4, vol: vol * 0.3, a: 0.002 }) }

const HUMAN = { gunner: 135, samurai: 110, mage: 165, bard: 150 } // altura da voz de cada classe

const S = {
  // ---------------------------------------------------------------- armas
  pistol: [60, 0.6, (o, t) => shot(o, t, { body: 1700, len: 0.12, low: 160, tail: 0.45, crack: 0.8 })],
  carbine: [70, 0.5, (o, t) => shot(o, t, { body: 2300, len: 0.08, low: 140, tail: 0.38, crack: 1 })],
  shotgun: [75, 1.1, (o, t) => { shot(o, t, { body: 1100, len: 0.22, low: 110, tail: 0.8, crack: 0.9 }); click(o, t + 0.42, 1500, 0.35); hiss(o, t + 0.45, { dur: 0.08, vol: 0.3, f: 1200 }); click(o, t + 0.55, 1100, 0.4) }],
  casing: [14, 0.5, (o, t) => { for (let i = 0; i < 3; i++) tone(o, t + i * rnd(0.06, 0.1), { f: rnd(3800, 5200), dur: 0.05, vol: 0.12 / (i + 1) }) }],
  dryfire: [12, 0.1, (o, t) => click(o, t, 1800, 0.5)],
  swap: [12, 0.4, (o, t) => { hiss(o, t, { dur: 0.15, a: 0.04, vol: 0.3, f: 900, q: 0.6 }); click(o, t + 0.18, 2200, 0.4) }],
  // recarga: tira o pente · bate no chão · encaixa · puxa o ferrolho (espingarda: cartucho por cartucho + bombeia)
  reload: [14, 2.4, (o, t, p) => {
    const T = p.time || 1.5
    if (p.weapon === 'shotgun') {
      for (let i = 0; i < 5; i++) { click(o, t + 0.2 + i * (T - 0.6) / 5, 1300, 0.35); hiss(o, t + 0.22 + i * (T - 0.6) / 5, { dur: 0.05, vol: 0.15, f: 2000 }) }
      click(o, t + T - 0.25, 1500, 0.4); hiss(o, t + T - 0.22, { dur: 0.08, vol: 0.3, f: 1200 }); click(o, t + T - 0.1, 1100, 0.45)
      return
    }
    click(o, t + 0.08, 1600, 0.4)
    tone(o, t + 0.3, { type: 'triangle', f: 420, f1: 300, dur: 0.06, vol: 0.15 })
    hiss(o, t + T * 0.5, { dur: 0.06, vol: 0.2, f: 1500 })
    click(o, t + T * 0.58, 1200, 0.55)
    click(o, t + T * 0.85, 2000, 0.4); click(o, t + T * 0.85 + 0.09, 1500, 0.5)
  }],
  ricochet: [30, 0.4, (o, t) => { tone(o, t, { f: rnd(2400, 3600), f1: rnd(900, 1400), dur: 0.25, vol: 0.18 }); hiss(o, t, { dur: 0.03, vol: 0.25, type: 'highpass', f: 3000 }) }],
  impact: [26, 0.2, (o, t) => { hiss(o, t, { dur: 0.05, vol: 0.4, f: 1200, q: 1 }); tone(o, t, { f: 200, f1: 90, dur: 0.05, vol: 0.2 }) }],
  pin: [12, 0.3, (o, t) => { click(o, t, 3000, 0.3); tone(o, t + 0.02, { f: 4200, dur: 0.15, vol: 0.08 }) }],
  throw: [14, 0.4, (o, t) => whoosh(o, t, 500, 1800, 0.3, 0.5)],
  explosion: [120, 2.2, (o, t) => boom(o, t, 1)],

  // ---------------------------------------------------------------- samurai
  // golpe de katana: assobio do ar cortado; o 3º é mais grave e pesado
  swing: [20, 0.5, (o, t, p) => {
    const h = p.heavy
    whoosh(o, t, h ? 400 : 700, h ? 2400 : 3800, h ? 0.3 : 0.2, h ? 0.9 : 0.7)
    if (h) vocal(o, t, { f: HUMAN.samurai * 1.2, f1: HUMAN.samurai, dur: 0.25, vol: 0.25, form: [700, 1200], rough: 2, breath: 0.5 })
  }],
  slice: [24, 0.4, (o, t) => { flesh(o, t, 0.6); hiss(o, t, { dur: 0.07, vol: 0.35, type: 'highpass', f: 2500 }) }],
  dash: [24, 0.8, (o, t) => { whoosh(o, t, 300, 3000, 0.35, 0.9); metal(o, t + 0.05, { f: 1250, dur: 0.6, vol: 0.12 }) }],
  spin: [24, 0.8, (o, t) => { whoosh(o, t, 500, 3000, 0.22, 0.7); whoosh(o, t + 0.16, 600, 3200, 0.22, 0.7); metal(o, t, { f: 1500, dur: 0.5, vol: 0.08 }) }],

  // ---------------------------------------------------------------- mago
  bolt: [30, 0.4, (o, t) => { tone(o, t, { type: 'triangle', f: rnd(700, 900), f1: 1800, dur: 0.18, vol: 0.35 }); tone(o, t, { f: 2600, f1: 3600, dur: 0.12, vol: 0.1 }); whoosh(o, t, 1500, 4000, 0.15, 0.2) }],
  zap: [26, 0.4, (o, t) => { tone(o, t, { type: 'square', f: 1500, f1: 260, dur: 0.18, vol: 0.12 }); hiss(o, t, { dur: 0.15, vol: 0.4, type: 'highpass', f: 2500 }); bell(o, t, 2100, 0.08, 0.3) }],
  charge: [30, 1.1, (o, t) => { tone(o, t, { type: 'sawtooth', f: 110, f1: 440, dur: 0.85, a: 0.4, vol: 0.12 }); tone(o, t, { f: 220, f1: 880, dur: 0.85, a: 0.4, vol: 0.2 }); hiss(o, t, { dur: 0.85, a: 0.5, vol: 0.25, f: 400, f1: 2400, q: 3 }) }],
  // meteoro caindo: assobio descendo + rugido de fogo até o impacto
  meteorfall: [70, 1.2, (o, t, p) => { const T = p.time || 1; tone(o, t, { f: 2200, f1: 260, dur: T, a: 0.2, vol: 0.18, glide: T }); hiss(o, t, { dur: T, a: T * 0.9, vol: 0.6, type: 'lowpass', f: 300, f1: 1800, brown: true }) }],
  fireboom: [120, 2.4, (o, t) => { boom(o, t, 1.15); hiss(o, t + 0.1, { dur: 1.4, a: 0.1, vol: 0.35, f: 3000, q: 0.4 }) }],
  // gelo: cristais tilintando + estalo de congelar
  nova: [34, 1, (o, t) => {
    whoosh(o, t, 3000, 600, 0.45, 0.6)
    for (let i = 0; i < 14; i++) tone(o, t + rnd(0, 0.5), { f: rnd(2400, 6400), dur: rnd(0.08, 0.3), vol: rnd(0.04, 0.1), a: 0.001 })
    for (let i = 0; i < 6; i++) hiss(o, t + rnd(0.05, 0.4), { dur: 0.03, vol: 0.18, type: 'highpass', f: 4500 })
  }],
  freeze: [24, 0.4, (o, t) => { tone(o, t, { f: rnd(3000, 4500), dur: 0.2, vol: 0.06 }); hiss(o, t, { dur: 0.06, vol: 0.12, type: 'highpass', f: 5000 }) }],

  // ---------------------------------------------------------------- bardo
  // onda sonora: acorde dedilhado + "wump" grave do empurrão
  strum: [34, 1.6, (o, t) => {
    const base = (Math.random() * 4) | 0
    arp(o, t, [LUTE[base], LUTE[base + 2], LUTE[base + 4]], 0.025, 0.45)
    tone(o, t, { f: 120, f1: 55, dur: 0.3, vol: 0.5 })
    whoosh(o, t, 300, 900, 0.3, 0.2)
  }],
  song: [40, 2.2, (o, t) => { arp(o, t, [62, 66, 69, 74, 78, 81, 86], 0.11, 0.42); for (const m of [62, 69, 74]) tone(o, t + 0.1, { type: 'triangle', f: midi(m), dur: 1.6, a: 0.3, vol: 0.06 }) }],
  courage: [40, 2, (o, t) => {
    const seq = [[50, 57], [50, 57], [55, 62], [57, 64], [62, 69]]
    seq.forEach((c, i) => { arp(o, t + i * 0.16, c, 0.012, 0.5); tone(o, t + i * 0.16, { f: 90, f1: 45, dur: 0.12, vol: i === 4 ? 0.7 : 0.4 }) })
    for (const m of [62, 66, 69]) tone(o, t + 0.64, { type: 'sawtooth', f: midi(m), dur: 0.8, a: 0.05, vol: 0.03 })
  }],
  heal: [30, 1, (o, t) => { bell(o, t, midi(86), 0.18); bell(o, t + 0.08, midi(90), 0.14); bell(o, t + 0.16, midi(93), 0.12) }],
  buff: [30, 0.8, (o, t) => { bell(o, t, midi(81), 0.15, 0.5); tone(o, t, { type: 'sawtooth', f: midi(69), dur: 0.4, vol: 0.04 }) }],

  // ---------------------------------------------------------------- jogadores
  step: [22, 0.35, step],
  jump: [16, 0.3, (o, t, p) => { whoosh(o, t, 600, 1400, 0.18, 0.35); vocal(o, t, { f: (HUMAN[p.cls] || 140) * 1.1, dur: 0.12, vol: 0.2, form: [650, 1100], breath: 0.8, rough: 1 }) }],
  land: [18, 0.35, (o, t, p) => { step(o, t, { ...p, run: true }); tone(o, t, { f: 80, f1: 45, dur: 0.12, vol: 0.4 }) }],
  swim: [18, 0.6, (o, t) => { hiss(o, t, { dur: 0.45, a: 0.12, vol: 0.45, f: 700, f1: 1400, q: 0.8 }); for (let i = 0; i < 3; i++) tone(o, t + rnd(0.05, 0.3), { f: rnd(400, 700), f1: rnd(900, 1500), dur: 0.05, vol: 0.06 }) }],
  hurt: [26, 0.5, (o, t, p) => { const f = (HUMAN[p.cls] || 140) * rnd(0.95, 1.1); vocal(o, t, { f: f * 1.25, f1: f, dur: 0.28, a: 0.02, vol: 0.7, form: [650, 1150], rough: 3, breath: 0.4 }) }],
  death: [40, 1.6, (o, t, p) => { const f = HUMAN[p.cls] || 140; vocal(o, t, { f: f * 1.3, f1: f * 0.6, dur: 0.9, a: 0.03, vol: 0.5, form: [700, 1100], rough: 3, breath: 0.5 }); thud(o, t + 0.9, 0.7) }],
  grunt: [18, 0.3, (o, t, p) => vocal(o, t, { f: (HUMAN[p.cls] || 140) * rnd(0.95, 1.1), dur: 0.16, a: 0.015, vol: 0.35, form: [600, 1000], rough: 2, breath: 0.6 })],
  breath: [10, 0.6, (o, t, p) => hiss(o, t, { dur: p.in ? 0.32 : 0.4, a: p.in ? 0.2 : 0.04, vol: 0.32, f: p.in ? 1500 : 900, q: 1.4 })],
  heart: [12, 0.5, (o, t) => { tone(o, t, { f: 60, f1: 40, dur: 0.12, vol: 0.6 }); tone(o, t + 0.17, { f: 52, f1: 36, dur: 0.14, vol: 0.45 }) }],
  gurgle: [16, 0.8, (o, t) => { for (let i = 0; i < 6; i++) tone(o, t + i * rnd(0.05, 0.1), { f: rnd(200, 400), f1: rnd(500, 900), dur: 0.06, vol: 0.15 }) }],
  // empurrão: esforço + ar + (se pegou alguém) o tranco no corpo
  shove: [20, 0.5, (o, t, p) => { vocal(o, t, { f: (HUMAN[p.cls] || 140) * 1.05, dur: 0.18, a: 0.01, vol: 0.28, form: [600, 1050], rough: 2, breath: 0.6 }); whoosh(o, t, 400, 1200, 0.18, 0.3); if (p.hit) thud(o, t + 0.07, 0.45 + 0.15 * p.hit) }],
  stomp: [20, 0.5, (o, t) => { thud(o, t, 0.6); hiss(o, t, { dur: 0.05, vol: 0.5, type: 'highpass', f: 1800 }); flesh(o, t + 0.01, 0.6) }],
  revive: [40, 1.2, (o, t) => { [74, 78, 81, 86].forEach((m, i) => bell(o, t + i * 0.09, midi(m), 0.2)) }],
  escape: [18, 0.4, (o, t, p) => { vocal(o, t, { f: (HUMAN[p.cls] || 140) * 1.2, dur: 0.25, a: 0.01, vol: 0.35, form: [700, 1200], rough: 3, breath: 0.5 }); whoosh(o, t, 300, 900, 0.2, 0.3) }],

  // ---------------------------------------------------------------- zumbis
  // gemido de quem vaga · rosnado de quem persegue · grito do bote · gorgolejo da morte
  moan: [30, 2.2, (o, t, p) => { const f = rnd(62, 95) * (p.fast ? 1.25 : 1); vocal(o, t, { f, f1: f * rnd(0.7, 0.9), dur: rnd(1.1, 2), a: 0.3, vol: 0.5, form: [rnd(380, 480), rnd(700, 900)], rough: 6, breath: 0.35, wob: 5, depth: 0.06 }) }],
  growl: [34, 1.2, (o, t, p) => { const f = rnd(85, 130) * (p.fast ? 1.3 : 1); vocal(o, t, { f, f1: f * rnd(0.75, 1.1), dur: rnd(0.5, 0.95), a: 0.06, vol: 0.6, form: [rnd(600, 750), rnd(1000, 1300)], rough: 10, breath: 0.5, wob: 13, depth: 0.12 }) }],
  snarl: [30, 0.6, (o, t, p) => { const f = rnd(150, 210) * (p.fast ? 1.25 : 1); vocal(o, t, { f, f1: f * 1.3, dur: 0.38, a: 0.02, vol: 0.55, form: [800, 1500], rough: 14, breath: 0.6, wob: 22, depth: 0.15 }) }],
  bite: [24, 0.5, (o, t) => { for (let i = 0; i < 4; i++) hiss(o, t + i * 0.035, { dur: 0.03, vol: 0.45, f: rnd(1500, 3000), q: 2 }); flesh(o, t + 0.05, 0.8); vocal(o, t, { f: 120, dur: 0.3, a: 0.01, vol: 0.25, form: [500, 900], rough: 8 }) }],
  grab: [22, 0.5, (o, t) => { hiss(o, t, { dur: 0.15, vol: 0.4, f: 1200, q: 0.6 }); vocal(o, t, { f: 140, f1: 180, dur: 0.3, a: 0.01, vol: 0.4, form: [700, 1300], rough: 12, wob: 18 }) }],
  zhit: [28, 0.3, (o, t, p) => flesh(o, t, 0.4 + Math.min(p.dmg || 2, 10) * 0.05)],
  zdeath: [32, 1.6, (o, t) => { const f = rnd(85, 115); vocal(o, t, { f, f1: f * 0.45, dur: 0.85, a: 0.02, vol: 0.4, form: [500, 850], rough: 12, breath: 0.4, wob: 7 }); thud(o, t + rnd(0.45, 0.7), 0.7) }],
  bodyfall: [24, 0.4, (o, t) => thud(o, t, 0.75)],
  zstagger: [22, 0.4, (o, t) => vocal(o, t, { f: rnd(90, 120), f1: 70, dur: 0.25, a: 0.01, vol: 0.25, form: [550, 900], rough: 8 })],
  shuffle: [14, 0.3, (o, t) => hiss(o, t, { dur: rnd(0.14, 0.22), a: 0.05, vol: 0.22, f: rnd(500, 800), f1: 300, q: 0.6 })],
  chew: [16, 0.4, (o, t) => { hiss(o, t, { dur: 0.08, vol: 0.3, f: rnd(400, 800), f1: 1600, q: 3 }); for (let i = 0; i < 2; i++) hiss(o, t + rnd(0.02, 0.15), { dur: 0.02, vol: 0.25, f: 2500, q: 2 }) }],
  bang: [30, 0.6, (o, t) => { metal(o, t, { f: rnd(170, 230), dur: 0.35, vol: 0.4 }); thud(o, t, 0.5) }],

  // ---------------------------------------------------------------- veículos
  door: [20, 0.6, (o, t, p) => p.open
    ? (click(o, t, 1400, 0.45), hiss(o, t + 0.04, { dur: 0.15, vol: 0.15, f: 700 }))
    : (tone(o, t, { f: 110, f1: 60, dur: 0.12, vol: 0.6 }), hiss(o, t, { dur: 0.08, vol: 0.4, type: 'lowpass', f: 1200 }), click(o, t + 0.02, 1200, 0.3))],
  ignition: [36, 1.1, (o, t, p) => {
    // motor de partida: "rrr-rrr-rrr" até pegar
    const n = 3 + ((Math.random() * 2) | 0)
    for (let i = 0; i < n; i++) { tone(o, t + i * 0.13, { type: 'sawtooth', f: 48, f1: 38, dur: 0.11, vol: 0.18 }); hiss(o, t + i * 0.13, { dur: 0.1, vol: 0.12, f: 400, q: 1 }) }
    tone(o, t + n * 0.13, { type: 'sawtooth', f: (p.base || 34) * 3, f1: (p.base || 34) * 1.2, dur: 0.5, a: 0.02, vol: 0.25 })
  }],
  engineoff: [36, 0.8, (o, t, p) => { tone(o, t, { type: 'sawtooth', f: (p.base || 34) * 1.2, f1: 14, dur: 0.6, vol: 0.2 }); click(o, t + 0.55, 900, 0.15) }],
  crash: [60, 1.2, (o, t, p) => {
    const k = Math.min(1, p.power || 0.5)
    thud(o, t, 0.6 + k * 0.6)
    metal(o, t, { f: rnd(140, 220), dur: 0.5 + k * 0.6, vol: 0.25 + k * 0.3 })
    hiss(o, t, { dur: 0.3 + k * 0.4, vol: 0.5 * k, f: 900, f1: 300, q: 0.6 })
    if (k > 0.6) for (let i = 0; i < 8; i++) tone(o, t + rnd(0.02, 0.35), { f: rnd(3500, 7000), dur: rnd(0.05, 0.15), vol: 0.08 }) // vidro
  }],
  runover: [40, 0.5, (o, t) => { thud(o, t, 0.9); flesh(o, t + 0.02, 0.8); metal(o, t, { f: 260, dur: 0.2, vol: 0.12 }) }],
  wreck: [130, 2.6, (o, t) => { boom(o, t, 1.2); metal(o, t + 0.05, { f: 120, dur: 1.4, vol: 0.4 }); for (let i = 0; i < 10; i++) tone(o, t + rnd(0.05, 0.5), { f: rnd(3500, 7000), dur: 0.1, vol: 0.07 }) }],

  // ---------------------------------------------------------------- mundo
  dooropen: [22, 0.9, (o, t) => { click(o, t, 1100, 0.3); creak(o, t + 0.05, rnd(0.35, 0.6), 0.22) }],
  doorclose: [22, 0.5, (o, t) => { tone(o, t, { type: 'triangle', f: 130, f1: 80, dur: 0.16, vol: 0.55 }); hiss(o, t, { dur: 0.1, vol: 0.35, type: 'lowpass', f: 900, brown: true }); click(o, t + 0.03, 1300, 0.35) }],
  // respingo: tamanho pela força (passo, pulo, tiro, explosão)
  splash: [30, 1.2, (o, t, p) => {
    const k = Math.min(1.6, p.power || 0.6)
    hiss(o, t, { dur: 0.25 + k * 0.4, a: 0.01, vol: 0.35 + k * 0.35, f: 2200 - k * 600, f1: 500, q: 0.7 })
    tone(o, t, { f: 260 - k * 80, f1: 70, dur: 0.12 + k * 0.1, vol: 0.2 * k })
    for (let i = 0; i < 3 + k * 6; i++) tone(o, t + rnd(0.05, 0.25 + k * 0.4), { f: rnd(500, 900), f1: rnd(1200, 2200), dur: 0.05, vol: 0.06 })
  }],
  plop: [26, 0.4, (o, t) => { tone(o, t, { f: rnd(400, 650), f1: rnd(1100, 1600), dur: 0.08, vol: 0.25 }); hiss(o, t + 0.02, { dur: 0.15, vol: 0.15, f: 1600, f1: 700 }) }, 'amb'],
  quack: [34, 0.6, (o, t) => { for (let i = 0; i < 1 + ((Math.random() * 3) | 0); i++) vocal(o, t + i * 0.2, { f: rnd(380, 460), f1: 300, dur: 0.14, a: 0.01, vol: 0.28, form: [1000, 2200], rough: 3, breath: 0.2, wob: 30, depth: 0.03 }) }, 'amb'],
  bird: [60, 1, (o, t) => {
    const f = rnd(2200, 4200), n = 2 + ((Math.random() * 5) | 0), gap = rnd(0.06, 0.13)
    for (let i = 0; i < n; i++) tone(o, t + i * gap, { f: f * rnd(0.9, 1.15), f1: f * rnd(1.2, 1.6), dur: gap * 0.8, vol: 0.12, a: 0.004 })
  }, 'amb'],
  cricket: [60, 0.6, (o, t) => { const f = rnd(4200, 5200); for (let i = 0; i < 4; i++) tone(o, t + i * 0.045, { f, dur: 0.03, vol: 0.06, a: 0.003 }) }, 'amb'],
  owl: [70, 1.6, (o, t) => { const f = rnd(330, 400); tone(o, t, { f: f * 1.05, f1: f, dur: 0.35, a: 0.08, vol: 0.18 }); tone(o, t + 0.55, { f, f1: f * 0.92, dur: 0.6, a: 0.1, vol: 0.2 }) }, 'amb'],
  thunder: [0, 5, (o, t, p) => {
    const k = p.near ? 1 : 0.6
    if (p.near) hiss(o, t, { dur: 0.25, vol: 0.9, type: 'highpass', f: 1200 }) // estalo do raio perto
    hiss(o, t, { dur: 4.2, a: 0.08, vol: 1.3 * k, type: 'lowpass', f: 700, f1: 60, q: 0.4, brown: true })
    for (let i = 0; i < 4; i++) hiss(o, t + rnd(0.2, 2.2), { dur: rnd(0.8, 1.6), a: 0.15, vol: 0.6 * k, type: 'lowpass', f: rnd(150, 350), brown: true })
  }, 'amb'],
  drip: [12, 0.2, (o, t) => tone(o, t, { f: rnd(1500, 2600), f1: rnd(2800, 3600), dur: 0.04, vol: 0.06 }), 'amb'],

  // ---------------------------------------------------------------- interface
  ui: [0, 0.1, (o, t, p) => tone(o, t, { type: 'triangle', f: p.f || 880, dur: 0.06, vol: 0.3 })],
  join: [0, 0.6, (o, t) => { bell(o, t, midi(76), 0.25, 0.5); bell(o, t + 0.1, midi(83), 0.25, 0.6) }],
  start: [0, 1.6, (o, t) => { arp(o, t, [50, 57, 62, 66, 69, 74], 0.07, 0.5); tone(o, t, { f: 80, f1: 40, dur: 0.6, vol: 0.6 }); hiss(o, t + 0.4, { dur: 1, a: 0.05, vol: 0.2, type: 'lowpass', f: 600, brown: true }) }],
  gameover: [0, 3.2, (o, t) => { [69, 65, 62, 57].forEach((m, i) => { pluck(o, t + i * 0.42, midi(m), 0.55, 0.998); tone(o, t + i * 0.42, { type: 'triangle', f: midi(m - 12), dur: 0.5, vol: 0.08 }) }); tone(o, t + 1.6, { f: 55, f1: 35, dur: 1.6, a: 0.1, vol: 0.5 }) }],
  levelup: [0, 1.6, (o, t) => { [67, 72, 76, 79, 84].forEach((m, i) => bell(o, t + i * 0.08, midi(m), 0.22, 0.7)) }], // subir de nível
  supply: [0, 1, (o, t) => { thud(o, t, 0.6); [74, 79, 83].forEach((m, i) => bell(o, t + 0.12 + i * 0.08, midi(m), 0.18, 0.5)) }],
}

// toca um efeito. o: { x, z, vol, delay, ...parâmetros da receita }
export function sfx(name, o = {}) {
  const r = S[name]
  if (!r || !A.ctx) return
  const [range, dur, build, bus] = r
  const out = voice(o, range || 1e9, dur, bus ? A[bus] : range ? A.sfx : A.ui)
  if (!out) return
  build(out, now() + 0.005 + (o.delay || 0), o)
}
export { gate }
