import { A, ready, now, where, SetEars, Ears, shaper, rnd, gate } from './engine'
import { sfx } from './sfx'
import { WaterDepth, SidewalkLift } from '../world/sidewalk'
import { DeckAt } from '../world/water-life'
import { WaterSD } from '../world/water'
import { FloorAt } from '../world/buildings-registry'
import { RoadDist, Paved, InZone, ROAD_HALF } from '../world/layout'

// =====================================================================================
//  Paisagem sonora: tudo que soa continuamente ou que é "observado" a cada quadro em vez de disparado por um evento.
//  - laços: vento (com rajadas e assobio), chuva, água perto de rios/lagos, zumbido dos postes à noite
//  - por veículo com motorista: motor (marchas pela velocidade, carga pela aceleração) e pneu cantando na derrapagem
//  - jogadores: passos pela superfície (grama, asfalto, madeira, água, chão molhado), aterrissagem, nado,
//    respiração cansada, coração com pouca vida, esforço quando agarrado, afogando
//  - zumbis: gemidos (vagando), rosnados (perseguindo), mastigando (comendo), pés arrastando
//  - natureza: pássaros de dia, grilos e coruja à noite, patos e peixes na água, pingos na chuva
// =====================================================================================

const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const ENGINE = { sedan: { base: 36, rough: 3, bright: 1.15 }, pickup: { base: 28, rough: 6, bright: 0.85 }, jeep: { base: 32, rough: 9, bright: 1 } }

// superfície onde o jogador pisa
function surface(p) {
  if (WaterDepth(p.x, p.z) > 0.05) return 'water'
  if (FloorAt(p.x, p.z, p.gy ?? 0) || DeckAt(p.x, p.z) > (p.gy ?? 0) - 0.3) return 'wood'
  if (RoadDist(p.x, p.z) < ROAD_HALF || Paved(p.x, p.z) > 0.5 || SidewalkLift(p.x, p.z) > 0) return 'hard'
  return 'grass'
}

export function CreateSoundscape() {
  let L = null // laços de ambiente (criados quando o áudio é liberado)
  const engines = new Map() // veículo -> nós do motor
  const ps = new WeakMap() // estado sonoro por jogador
  const ev = { bird: 2, cricket: 1, owl: 25, water: 4, quack: 12, drip: 0.2 }
  let t = 0

  function noiseLoop(brown, type, f, q, out = A.amb) {
    const s = A.ctx.createBufferSource(), fl = A.ctx.createBiquadFilter(), g = A.ctx.createGain()
    s.buffer = brown ? A.brown : A.white
    s.loop = true
    fl.type = type; fl.frequency.value = f; fl.Q.value = q
    g.gain.value = 0
    s.connect(fl).connect(g).connect(out)
    s.start(0, Math.random() * 1.5)
    return { fl, g }
  }
  function makeLoops() {
    const ctx = A.ctx
    const hum = ctx.createGain(); hum.gain.value = 0; hum.connect(A.amb)
    for (const [f, type, v] of [[120, 'sine', 1], [240, 'square', 0.12], [360, 'sine', 0.3]]) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = type; o.frequency.value = f; g.gain.value = v
      o.connect(g).connect(hum); o.start()
    }
    return {
      wind: noiseLoop(true, 'bandpass', 400, 0.6),
      whistle: noiseLoop(false, 'bandpass', 1000, 14),
      rain: noiseLoop(false, 'bandpass', 3500, 0.35),
      rainLow: noiseLoop(true, 'lowpass', 500, 0.5),
      water: noiseLoop(true, 'bandpass', 520, 0.8),
      hum,
    }
  }

  // ---------------------------------------------------------------- motor + derrapagem de um veículo
  function makeEngine(v) {
    const ctx = A.ctx, k = ENGINE[v.kind] || ENGINE.sedan
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), sub = ctx.createOscillator()
    const sh = shaper(k.rough), lp = ctx.createBiquadFilter(), g = ctx.createGain(), pan = ctx.createStereoPanner(), sg = ctx.createGain()
    o1.type = 'sawtooth'; o2.type = 'square'; sub.type = 'sine'
    o2.detune.value = 9
    const og = ctx.createGain(); og.gain.value = 0.5
    lp.type = 'lowpass'; lp.Q.value = 2
    g.gain.value = 0; sg.gain.value = 0
    o1.connect(sh); o2.connect(og).connect(sh)
    sh.connect(lp).connect(g)
    sub.connect(g)
    g.connect(pan); sg.connect(pan); pan.connect(A.sfx)
    // pneu cantando: ruído em faixa estreita
    const s = ctx.createBufferSource(), sf = ctx.createBiquadFilter()
    s.buffer = A.white; s.loop = true
    sf.type = 'bandpass'; sf.frequency.value = 1700; sf.Q.value = 3
    s.connect(sf).connect(sg)
    for (const o of [o1, o2, sub]) o.start()
    s.start(0, Math.random())
    sfx('ignition', { x: v.x, z: v.z, base: k.base })
    return { k, o1, o2, sub, lp, g, pan, sg, nodes: [o1, o2, sub, s], warm: -0.6, rpm: 0.2 }
  }
  function killEngine(v, e, off) {
    const t0 = now()
    e.g.gain.setTargetAtTime(0, t0, 0.08); e.sg.gain.setTargetAtTime(0, t0, 0.05)
    for (const n of e.nodes) n.stop(t0 + 0.6)
    setTimeout(() => e.pan.disconnect(), 800)
    if (off) sfx('engineoff', { x: v.x, z: v.z, base: e.k.base })
    engines.delete(v)
  }
  function updateEngine(v, e, dt) {
    const t0 = now(), d = v.d
    const w = where(v.x, v.z, 70)
    e.warm += dt
    const spd = Math.hypot(v.vx, v.vz), s = clamp(Math.abs(v.fwd) / d.max, 0, 1)
    // marchas: o giro sobe dentro de cada marcha e cai ao trocar
    const G = 4, gx = s * G, gi = Math.min(G - 1, Math.floor(gx)), r = gi === G - 1 ? Math.min(1, gx - gi) : gx - gi
    const load = clamp((v.acc * Math.sign(v.fwd || 1)) / d.accel, 0, 1)
    const rpmT = s < 0.02 ? 0.12 + load * 0.25 : 0.25 + (gi ? 0.3 + 0.7 * r : r) * 0.75 + load * 0.08
    e.rpm += (rpmT - e.rpm) * (1 - Math.exp(-6 * dt))
    const f = e.k.base * (1 + e.rpm * 2.8) * (v.hp < d.hp * 0.3 ? 1 + Math.sin(t * 23) * 0.05 : 1) // motor estragado engasga
    e.o1.frequency.setTargetAtTime(f, t0, 0.04)
    e.o2.frequency.setTargetAtTime(f * 0.5, t0, 0.04)
    e.sub.frequency.setTargetAtTime(f * 0.5, t0, 0.04)
    e.lp.frequency.setTargetAtTime((350 + 1600 * load + 900 * e.rpm) * e.k.bright, t0, 0.05)
    const on = clamp(e.warm * 2.5, 0, 1)
    e.g.gain.setTargetAtTime(w ? w.g * on * (0.1 + 0.1 * load + 0.07 * e.rpm) : 0, t0, 0.05)
    // derrapagem: velocidade de lado + freada forte
    const lat = Math.abs(v.vx * Math.cos(v.yaw) - v.vz * Math.sin(v.yaw))
    const skid = clamp((lat - 2.5) / 5, 0, 1) + (v.brake.visible && spd > 7 ? clamp((spd - 7) / 10, 0, 0.6) : 0)
    e.sg.gain.setTargetAtTime(w ? w.g * Math.min(skid, 1) * 0.22 : 0, t0, 0.04)
    if (w) e.pan.pan.setTargetAtTime(w.pan, t0, 0.05)
  }

  // ---------------------------------------------------------------- um quadro
  // game, climate, lamps = postes; menu = true no lobby (ouvinte no centro da cena)
  function update(dt, game, climate, lamps, menu) {
    t += dt
    const players = [...game.players.values()]
    const alive = players.filter((p) => !p.dead)
    SetEars(menu || !players.length ? [{ x: 8, z: -6 }] : alive.length ? alive : players)
    if (!ready()) return
    if (!L) L = makeLoops()
    const t0 = now(), ears = Ears()

    // ---- clima ----
    const ws = climate.wind, rain = climate.rain
    L.wind.g.gain.setTargetAtTime(0.03 + ws * 0.07, t0, 0.3)
    L.wind.fl.frequency.setTargetAtTime(260 + ws * 140 + Math.sin(t * 0.4) * 80, t0, 0.3)
    L.whistle.g.gain.setTargetAtTime(Math.max(0, ws - 1.3) * 0.012, t0, 0.4)
    L.whistle.fl.frequency.setTargetAtTime(800 + Math.sin(t * 0.23) * 300 + ws * 120, t0, 0.5)
    L.rain.g.gain.setTargetAtTime(rain * 0.32, t0, 0.5)
    L.rainLow.g.gain.setTargetAtTime(rain * rain * 0.25, t0, 0.5)
    // todos dentro de casa: lá fora fica abafado
    const inside = ears.every((e) => e.inside)
    A.ambLP.frequency.setTargetAtTime(inside ? 650 : 20000, t0, 0.25)

    // ---- água: o mais perto que algum ouvinte está de um rio/lago ----
    let wd = 99
    for (const e of ears) wd = Math.min(wd, WaterSD(e.x, e.z))
    const water = 1 - smooth(0, 16, wd)
    L.water.g.gain.setTargetAtTime(water * (0.1 + 0.05 * Math.sin(t * 1.3) * Math.sin(t * 0.37 + 1)), t0, 0.2)
    L.water.fl.frequency.setTargetAtTime(480 + Math.sin(t * 0.9) * 120, t0, 0.3)

    // ---- postes: zumbido elétrico perto de um poste aceso ----
    L.hum.gain.setTargetAtTime(lamps ? lamps.lit * (1 - smooth(1.5, 7, lamps.near)) * 0.018 : 0, t0, 0.3)

    // ---- natureza (eventos soltos em volta dos ouvintes) ----
    const h = climate.time, day = h > 0.26 && h < 0.74, night = h < 0.22 || h > 0.79
    const around = (r0, r1) => { const e = ears[(Math.random() * ears.length) | 0], a = Math.random() * Math.PI * 2, d = rnd(r0, r1); return { x: e.x + Math.sin(a) * d, z: e.z + Math.cos(a) * d } }
    const calm = rain < 0.2 && climate.fog < 0.6
    if ((ev.bird -= dt) <= 0) {
      ev.bird = rnd(1.2, 4.5) * (InZone(ears[0].x, ears[0].z) === 'city' ? 2.5 : 1)
      if (day && calm) sfx('bird', { ...around(8, 26), vol: rnd(0.4, 1) })
    }
    if ((ev.cricket -= dt) <= 0) {
      ev.cricket = rnd(0.25, 1.1)
      if (night && rain < 0.3) sfx('cricket', { ...around(4, 18), vol: rnd(0.4, 1) })
    }
    if ((ev.owl -= dt) <= 0) { ev.owl = rnd(25, 60); if (night && calm) sfx('owl', around(15, 30)) }
    if ((ev.water -= dt) <= 0) { ev.water = rnd(2.5, 8); if (water > 0.4) sfx('plop', { ...around(4, 12), vol: water }) }
    if ((ev.quack -= dt) <= 0) { ev.quack = rnd(8, 22); if (water > 0.3 && day) sfx('quack', { ...around(6, 16), vol: water }) }
    if ((ev.drip -= dt) <= 0) { ev.drip = rnd(0.04, 0.25) / Math.max(rain, 0.05); if (rain > 0.3 && !inside) sfx('drip', { ...around(1, 8), vol: rain }) }
    if (menu) return

    // ---- jogadores ----
    for (const p of players) {
      let s = ps.get(p)
      if (!s) ps.set(p, (s = { x: p.x, z: p.z, dist: 0, air: false, swimT: 0, breathT: 0, breathIn: false, heartT: 0, heldT: 0, drownT: 0 }))
      const moved = Math.hypot(p.x - s.x, p.z - s.z)
      s.x = p.x; s.z = p.z
      if (p.dead || p.vehicle) { s.air = false; s.dist = 0; continue }
      const air = p.jy > 0.06 && !p.swim, o = { x: p.x, z: p.z, cls: p.cls.id, wet: climate.wet > 0.4 }
      if (s.air && !air && !p.swim) sfx('land', { ...o, surf: surface(p) })
      s.air = air
      if (!air && !p.swim && moved < 2) {
        // um passo a cada passada (mesma conta da animação: o pé toca o chão no ritmo certo)
        s.dist += moved
        const stride = 0.5 + 0.42 * clamp(p.speed / 4.2, 0, 1) + (p.running ? 0.55 : 0)
        if (s.dist >= stride) { s.dist = 0; sfx('step', { ...o, surf: surface(p), run: p.running, vol: p.running ? 1 : 0.75 }) }
      }
      if (p.swim && p.speed > 0.4 && (s.swimT -= dt) <= 0) { s.swimT = 0.8; sfx('swim', o) }
      // fôlego: ofegante quando cansado ou correndo sem fôlego
      if ((p.tired || (p.running && p.stamina < 35)) && (s.breathT -= dt) <= 0) { s.breathIn = !s.breathIn; s.breathT = s.breathIn ? 0.36 : 0.44; sfx('breath', { ...o, in: s.breathIn }) }
      // pouca vida: coração batendo (mais rápido quanto menos vida)
      const hp = p.hp / p.max
      if (hp < 0.3 && (s.heartT -= dt) <= 0) { s.heartT = 0.55 + hp * 1.6; sfx('heart', o) }
      if (p.held && (s.heldT -= dt) <= 0) { s.heldT = rnd(0.6, 1.0); sfx('grunt', o) }
      if (p.drown && (s.drownT -= dt) <= 0) { s.drownT = rnd(0.5, 0.9); sfx('gurgle', o) }
    }

    // ---- zumbis ----
    for (const e of game.enemies) {
      if (e.state === 'dead') continue
      e.vT = (e.vT ?? rnd(0, 8)) - dt
      if (e.vT <= 0) {
        const o = { x: e.x, z: e.z, fast: e.fast }
        switch (e.state) {
          case 'chase': e.vT = rnd(2, 4.5); if (gate('zvox', 0.12)) sfx('growl', o); break
          case 'grab': e.vT = rnd(1.4, 2.2); sfx('growl', { ...o, vol: 0.8 }); break
          case 'feed': e.vT = rnd(0.35, 0.8); sfx(Math.random() < 0.1 ? 'growl' : 'chew', { ...o, vol: 0.7 }); break
          case 'wander': case 'investigate': e.vT = rnd(5, 14); if (gate('zvox', 0.2)) sfx('moan', o); break
          default: e.vT = 1
        }
      }
      // pés arrastando (só quem está perto, senão vira chiado)
      if (e.moving) {
        e.sd = (e.sd || 0) + e.vel * dt
        if (e.sd > (e.fast ? 1.2 : 0.8)) { e.sd = 0; if (gate('shuffle', 0.05)) sfx('shuffle', { x: e.x, z: e.z, vol: e.fast ? 1 : 0.7 }) }
      }
    }

    // ---- veículos ----
    const list = game.vehicles.list
    for (const [v, e] of engines) if (!list.includes(v) || v.wrecked || !v.seats[0] || v.sleep) killEngine(v, e, list.includes(v) && !v.wrecked)
    for (const v of list) {
      if (v.wrecked || v.sleep || !v.seats[0]) continue
      let e = engines.get(v)
      if (!e) engines.set(v, (e = makeEngine(v)))
      updateEngine(v, e, dt)
    }
  }
  // volta ao menu / reinício: motores param na hora
  function clear() { for (const [v, e] of engines) killEngine(v, e, false) }
  return { update, clear }
}
