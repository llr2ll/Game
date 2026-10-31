import * as THREE from 'three'
import { MAT } from '../../../engine/render/style'
import { WEAPONS, WEAPON_ORDER } from '../config/weapons'
import { rayBox, HitWall } from '../../../engine/world/collision'
import { WaterDepth, GroundAt } from '../../../shared/worldgen/sidewalk'
import { GRENADE_GEO } from '../../../shared/characters/kits'
import { sfx, gate } from '../../../shared/audio/sfx'
import { BALANCE } from '../config/balance'

// Uma classe por vaga: Jogador 1 Atirador · 2 Samurai · 3 Mago · 4 Bardo.
// Cada uma tem o ataque principal (stick direito / mouse) e até três botões (cd = recarga em segundos).
export const CLASS_ORDER = ['gunner', 'samurai', 'mage', 'bard']
// vida, velocidade e recargas (hp, speed, cd) vêm de config/balance.js
const BC = BALANCE.classes
export const CLASSES = {
  gunner: { id: 'gunner', name: 'Atirador', icon: '🔫', ...BC.gunner, ranged: true, buttons: ['Trocar arma', 'Recarregar', 'Granada'] },
  samurai: { id: 'samurai', name: 'Samurai', icon: '⚔️', ...BC.samurai, ranged: false, buttons: ['Investida', 'Redemoinho'] },
  mage: { id: 'mage', name: 'Mago', icon: '🔮', ...BC.mage, ranged: true, buttons: ['Meteoro', 'Nova de gelo'] },
  bard: { id: 'bard', name: 'Bardo', icon: '🪕', ...BC.bard, ranged: true, buttons: ['Canção de cura', 'Balada da coragem'] },
}
export const ClassOf = (idx) => CLASSES[CLASS_ORDER[idx % 4]]

// números das habilidades: config/balance.js
const G = BALANCE.gunner, S = BALANCE.samurai, M = BALANCE.mage, B = BALANCE.bard
const MANA = M.mana, MANA_REGEN = M.manaRegen
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI }
const tracerGeo = new THREE.BoxGeometry(0.04, 0.04, 1)
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 })
const boltGeo = new THREE.IcosahedronGeometry(0.16, 1)
const boltMat = new THREE.MeshBasicMaterial({ color: 0xffc94a })
const meteorGeo = new THREE.IcosahedronGeometry(0.75, 1)
const meteorMat = new THREE.MeshBasicMaterial({ color: 0xff7a2a })
const iceGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.5, 8, 1, true)
const iceMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.45, depthWrite: false })

// estado de classe de cada jogador (munição, mana, recargas)
export function InitClassState(p) {
  const c = p.cls
  p.hp = p.max = c.hp
  p.cd = c.cd.map(() => 0)
  p.mana = MANA
  p.combo = 0; p.comboT = 9; p.atk = 0; p.dashT = 0; p.invulnT = 0; p.buffT = 0; p.slowAct = 1; p.slowT = 0
  p.weapon = c.id === 'gunner' ? 'carbine' : null
  p.reload = 0
  p.ammo = {}
  for (const k in WEAPONS) p.ammo[k] = { mag: WEAPONS[k].mag, reserve: WEAPONS[k].reserve }
}

// ctx: { scene, fx, wfx, colliders, enemies, players, hit(e, dmg, p, kx, kz), noise(x, z, raio) — atrai zumbis,
//        impact(x, z, tipo) — tremor/pausa (balance.js · juice), night() }
export function CreateAbilities(ctx) {
  const { scene, fx, wfx, colliders, enemies, players } = ctx
  const tracers = [], bolts = [], nades = [], meteors = [], timers = []
  const tmp = new THREE.Vector3()
  const later = (t, fn) => timers.push({ t, fn })
  const sameFloor = (e, p) => (e.lv || 0) === (p.lv || 0)
  const noise = (p, r) => ctx.noise && ctx.noise(p.x, p.z, r)
  const dirOf = (p) => (p.aiming ? p.aimAngle : p.facing)
  const aligned = (p, tol) => Math.abs(wrap(p.aimAngle - p.facing)) < tol
  const dmgMul = (p) => (p.buffT > 0 ? B.courage.damage : 1)
  const act = (p, name, dur, slow = 1) => { p.model.play(name, dur); p.atk = Math.max(p.atk, dur * 0.95); p.slowAct = slow; p.slowT = dur }
  const knock = (e, from, power) => { const dx = e.x - from.x, dz = e.z - from.z, d = Math.hypot(dx, dz) || 1; return [(dx / d) * power, (dz / d) * power] }

  // dano em área (explosão, gelo, redemoinho): tudo no raio, no mesmo andar
  function area(p, x, z, r, dmg, power, extra) {
    for (const e of enemies) {
      if (e.dying > 0 || !sameFloor(e, p)) continue
      const d = Math.hypot(e.x - x, e.z - z)
      if (d > r + e.radius) continue
      const [kx, kz] = knock(e, { x, z }, power * (1 - (d / (r + e.radius)) * 0.5))
      ctx.hit(e, dmg * (1 - (d / (r + e.radius)) * 0.45) * dmgMul(p), p, kx, kz)
      if (extra) extra(e)
    }
  }
  // dano em cone à frente (corte de espada, onda do bardo)
  function cone(p, ang, range, half, dmg, power, max = 99) {
    let n = 0
    for (const e of enemies) {
      if (n >= max || e.dying > 0 || !sameFloor(e, p)) continue
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz)
      if (d > range + e.radius || (d > 0.6 && Math.abs(wrap(Math.atan2(dx, dz) - ang)) > half)) continue
      const [kx, kz] = knock(e, p, power)
      ctx.hit(e, dmg * dmgMul(p), p, kx, kz)
      fx.burst(e.x, (e.group.position.y || 0) + 1.2, e.z, 0xffffff, 4, 3, 0.3, 0.8)
      n++
    }
    return n
  }
  function explode(p, x, z, r, dmg, power, color) {
    const y = GroundAt(x, z)
    fx.flash(x, y + 0.6, z, r * 0.8, color, 0.35)
    fx.flash(x, y + 0.6, z, r * 0.45, 0xfff2b0, 0.18)
    fx.ring(x, y, z, color, 0.5, r * 1.15, 0.55)
    fx.burst(x, y + 0.5, z, color, 16, 7, 0.7, 1.3)
    fx.burst(x, y + 0.5, z, 0x4a3a2a, 8, 5, 0.9, 1.6)
    for (let i = 0; i < 5; i++) fx.puff(x + (Math.random() - 0.5) * r, y + 0.3, z + (Math.random() - 0.5) * r, 0xb4b0b8, 0.7 + Math.random() * 0.4, 1.1 + Math.random() * 0.5, 1.8)
    if (WaterDepth(x, z) > 0.1) wfx.splash(x, z, 18, 1.4)
    if (ctx.noise) ctx.noise(x, z, BALANCE.explosionNoise)
    if (ctx.impact) ctx.impact(x, z, 'explosion')
    area(p, x, z, r, dmg, power)
  }

  // ---------------------------------------------------------------- ATIRADOR
  function startReload(p) {
    const w = WEAPONS[p.weapon], s = p.ammo[p.weapon]
    if (p.reload > 0 || s.mag >= w.mag || s.reserve <= 0) return
    p.reload = w.reload
    p.model.play('reload', w.reload)
    sfx('reload', { x: p.x, z: p.z, weapon: p.weapon, time: w.reload })
  }
  function setWeapon(p, w) {
    if (p.weapon === w || p.reload > 0) return
    p.weapon = w
    p.model.setWeapon(w)
    p.model.play('swap', 0.32)
    p.cool = Math.max(p.cool, 0.25)
    sfx('swap', { x: p.x, z: p.z })
  }
  function shoot(p) {
    const w = WEAPONS[p.weapon], s = p.ammo[p.weapon]
    if (p.reload > 0 || p.cool > 0 || !aligned(p, 0.3)) return
    if (s.mag <= 0 && s.reserve <= 0 && p.weapon !== 'pistol') { sfx('dryfire', { x: p.x, z: p.z }); return setWeapon(p, 'pistol') } // sem munição: saca a pistola
    if (s.mag <= 0) return startReload(p)
    p.cool = w.rate
    s.mag--
    noise(p, p.weapon === 'pistol' ? G.pistolNoise : G.shotNoise) // tiro chama zumbis de longe
    sfx(p.weapon, { x: p.x, z: p.z, vol: p.weapon === 'carbine' ? 0.8 : 1 })
    if (p.weapon !== 'shotgun' && gate('casing', 0.18)) sfx('casing', { x: p.x, z: p.z, delay: 0.3 })
    p.model.kick()
    p.model.muzzle(tmp)
    if (p.weapon === 'shotgun' && ctx.impact) ctx.impact(p.x, p.z, 'shotgun')
    // à noite o tiro clareia o chão em volta (brilho falso, não é luz de verdade)
    if (ctx.night && ctx.night()) { const L = BALANCE.juice.muzzleGlow; fx.ring(tmp.x, GroundAt(tmp.x, tmp.z), tmp.z, L.color, 0.4, L.radius, L.time, { fill: true, alpha: L.alpha }) }
    for (let n = 0; n < (w.pellets || 1); n++) {
      const a = p.aimAngle + (Math.random() - 0.5) * 2 * w.spread
      const dx = Math.sin(a), dz = Math.cos(a)
      let best = null, bt = w.range * (w.pellets ? 0.8 + Math.random() * 0.2 : 1)
      for (const e of enemies) {
        if (e.dying > 0 || !sameFloor(e, p)) continue
        const rx = e.x - p.x, rz = e.z - p.z
        const t = rx * dx + rz * dz
        if (t < 0 || t > bt) continue
        if (Math.abs(rx * dz - rz * dx) < e.radius) { best = e; bt = t }
      }
      let wall = null
      for (const c of colliders) {
        if (c.off || (c.lv !== undefined && c.lv !== (p.lv || 0))) continue
        const t = rayBox(p.x, p.z, dx, dz, c)
        if (t < bt) { bt = t; best = null; wall = c }
      }
      if (wall && gate('impact', 0.05)) sfx(wall.veh ? 'ricochet' : 'impact', { x: p.x + dx * bt, z: p.z + dz * bt }) // bala na parede / na lataria
      const tr = new THREE.Mesh(tracerGeo, tracerMat)
      const len = Math.max(bt - 0.6, 0.5)
      tr.scale.z = len
      tr.position.set(tmp.x + (dx * len) / 2, tmp.y, tmp.z + (dz * len) / 2)
      tr.rotation.y = a
      scene.add(tr)
      tracers.push({ mesh: tr, life: 0.06 })
      if (!best) { const ex = p.x + dx * bt, ez = p.z + dz * bt; if (WaterDepth(ex, ez) > 0.1) wfx.splash(ex, ez, 4, 0.45) } // tiro na água espirra
      if (best) ctx.hit(best, w.dmg * dmgMul(p), p, dx * (w.knock || 0.8) * 3, dz * (w.knock || 0.8) * 3)
    }
    if (s.mag <= 0) startReload(p)
  }
  function grenade(p) {
    const a = dirOf(p), sx = p.x, sz = p.z
    act(p, 'throw', 0.55, 0.6)
    sfx('pin', { x: p.x, z: p.z })
    later(0.24, () => {
      if (p.dead) return
      sfx('throw', { x: p.x, z: p.z })
      p.model.muzzle(tmp) // sai da altura da mão
      const tx = sx + Math.sin(a) * G.grenade.distance, tz = sz + Math.cos(a) * G.grenade.distance
      const m = new THREE.Mesh(GRENADE_GEO, MAT.solid)
      m.scale.setScalar(1.3)
      scene.add(m)
      nades.push({ p, m, x0: p.x, z0: p.z, y0: tmp.y, tx, tz, t: 0, T: G.grenade.flight })
    })
  }

  // ---------------------------------------------------------------- SAMURAI
  function slash(p) {
    if (p.atk > 0 || !aligned(p, 0.7)) return
    p.combo = p.comboT < S.combo.window ? (p.combo + 1) % 3 : 0
    const dur = S.combo.time[p.combo], n = p.combo
    act(p, `slash${n + 1}`, dur, 0.45)
    p.comboT = -dur
    const a = p.aimAngle
    later(dur * 0.42, () => {
      if (p.dead) return
      p.vx += Math.sin(a) * (n === 2 ? 5 : 3); p.vz += Math.cos(a) * (n === 2 ? 5 : 3) // passo à frente no golpe
      const y = (p.y || 0) + (n === 2 ? 0.7 : 1.1)
      fx.arc(p.x, y, p.z, a + (n === 1 ? -0.2 : n === 0 ? 0.2 : 0), 0.6, 2.9, n === 2 ? 1.0 : 2.3, n === 2 ? 0xc8e4ff : 0xeaf4ff, 0.2, 0.35)
      sfx('swing', { x: p.x, z: p.z, heavy: n === 2, cls: p.cls.id })
      if (cone(p, a, S.combo.range, S.combo.angle[n], S.combo.damage[n], S.combo.knock[n])) { sfx('slice', { x: p.x, z: p.z }); if (n === 2 && ctx.impact) ctx.impact(p.x, p.z, 'heavyHit') } // 3º golpe: pausa + tremor
      noise(p, S.combo.noise)
    })
  }
  function dash(p) {
    const a = dirOf(p)
    act(p, 'dash', 0.42, 1)
    p.dashT = S.dash.time; p.dashA = a; p.dashV = S.dash.speed; p.invulnT = S.dash.invulnerable; p.dashHit = new Set()
    p.facing = p.aimAngle = a
    fx.arc(p.x, (p.y || 0) + 1, p.z, a + Math.PI, 0.2, 1.2, 1.2, 0xbfe0ff, 0.25)
    sfx('dash', { x: p.x, z: p.z })
  }
  function spin(p) {
    act(p, 'spin', 0.55, 0.3)
    sfx('spin', { x: p.x, z: p.z, delay: 0.1 })
    for (const t of [0.14, 0.3]) later(t, () => {
      if (p.dead) return
      fx.arc(p.x, (p.y || 0) + 1.0, p.z, p.facing, 0.5, 3.4, Math.PI * 2, 0xd8ecff, 0.25, 0.3)
      area(p, p.x, p.z, S.spin.radius, S.spin.damage, S.spin.knock)
    })
  }

  // ---------------------------------------------------------------- MAGO
  function bolt(p) {
    if (p.cool > 0 || p.mana < M.bolt.mana || !aligned(p, 0.35)) return
    p.cool = M.bolt.cooldown; p.mana -= M.bolt.mana
    act(p, 'cast', 0.3, 1)
    p.model.kick()
    p.model.muzzle(tmp)
    const m = new THREE.Mesh(boltGeo, boltMat)
    m.position.copy(tmp)
    scene.add(m)
    bolts.push({ p, m, a: p.aimAngle, life: M.bolt.life, y: tmp.y })
    sfx('bolt', { x: p.x, z: p.z })
    noise(p, M.bolt.noise)
  }
  function meteor(p) {
    if (p.mana < M.meteor.mana) return false
    p.mana -= M.meteor.mana
    const a = dirOf(p), tx = p.x + Math.sin(a) * M.meteor.distance, tz = p.z + Math.cos(a) * M.meteor.distance, ty = GroundAt(tx, tz)
    act(p, 'meteor', 0.85, 0.35)
    fx.ring(tx, ty, tz, 0xff4a2a, 3.6, 3.8, 1.1, { add: false })
    fx.ring(tx, ty, tz, 0xff6a2a, 0.3, 3.8, 1.1, { add: false, fill: true })
    const m = new THREE.Mesh(meteorGeo, meteorMat)
    scene.add(m)
    meteors.push({ p, m, tx, tz, ty, t: 0, T: M.meteor.fall })
    sfx('charge', { x: p.x, z: p.z })
    sfx('meteorfall', { x: tx, z: tz, time: M.meteor.fall })
  }
  function nova(p) {
    if (p.mana < M.nova.mana) return false
    p.mana -= M.nova.mana
    act(p, 'nova', 0.6, 0.2)
    later(0.32, () => {
      if (p.dead) return
      const y = p.gy || 0
      fx.ring(p.x, y, p.z, 0x9fe8ff, 0.5, 6, 0.6)
      fx.ring(p.x, y, p.z, 0x9fe8ff, 0.3, 5.5, 0.7, { add: false, fill: true })
      fx.burst(p.x, y + 0.3, p.z, 0xcff4ff, 22, 8, 0.6, 1.2)
      sfx('nova', { x: p.x, z: p.z })
      area(p, p.x, p.z, M.nova.radius, M.nova.damage, M.nova.knock, (e) => {
        e.slowT = M.nova.slowTime
        if (gate('freeze', 0.06)) sfx('freeze', { x: e.x, z: e.z, delay: 0.1 })
        if (!e.ice) { e.ice = new THREE.Mesh(iceGeo, iceMat); e.ice.position.y = 0.25; e.ice.scale.setScalar(e.radius * 1.6); e.group.add(e.ice) }
      })
    })
  }

  // ---------------------------------------------------------------- BARDO
  function wave(p) {
    if (p.cool > 0 || !aligned(p, 0.4)) return
    p.cool = B.wave.cooldown
    p.model.kick()
    p.model.muzzle(tmp)
    const a = p.aimAngle
    fx.arc(p.x, tmp.y - 0.2, p.z, a, 0.8, 6.8, 1.1, 0xffe27a, 0.4, 0.3)
    fx.arc(p.x, tmp.y - 0.2, p.z, a, 0.5, 5.2, 0.9, 0xb8f2ff, 0.32, 0.25)
    fx.note(tmp.x, tmp.y, tmp.z, Math.random() < 0.5 ? 0xffe26a : 0x9cf0ff)
    cone(p, a, B.wave.range, B.wave.angle, B.wave.damage, B.wave.knock)
    noise(p, B.wave.noise)
    sfx('strum', { x: p.x, z: p.z })
  }
  function allies(p, r) { return [...players.values()].filter((o) => Math.hypot(o.x - p.x, o.z - p.z) < r) }
  function song(p) {
    act(p, 'song', 1.0, 0.4)
    noise(p, B.song.noise) // música alta: cura, mas atrai
    sfx('song', { x: p.x, z: p.z })
    fx.ring(p.x, p.gy || 0, p.z, 0x7aff9a, 0.5, 9, 0.9)
    later(0.35, () => {
      if (p.dead) return
      for (const o of allies(p, B.song.radius)) {
        if (o.dead) { if (!o.out && Math.hypot(o.x - p.x, o.z - p.z) < B.song.reviveRadius) { o.dead = false; o.hp = o.max * B.song.reviveHp; o.model.hurt(); sfx('revive', { x: o.x, z: o.z }) } else continue } // levanta quem caiu perto (quem ficou fora só volta no amanhecer)
        else { o.hp = Math.min(o.max, o.hp + B.song.heal); sfx('heal', { x: o.x, z: o.z, delay: Math.random() * 0.15 }) }
        fx.ring(o.x, o.gy || 0, o.z, 0x7aff9a, 0.2, 1.4, 0.7)
        for (let i = 0; i < 3; i++) fx.note(o.x + (Math.random() - 0.5) * 0.8, (o.y || 0) + 1.6, o.z + (Math.random() - 0.5) * 0.8, 0x7aff9a)
      }
    })
  }
  function courage(p) {
    act(p, 'courage', 0.9, 0.4)
    noise(p, B.courage.noise)
    sfx('courage', { x: p.x, z: p.z })
    fx.ring(p.x, p.gy || 0, p.z, 0xffd24a, 0.5, 9, 0.9)
    later(0.4, () => {
      if (p.dead) return
      for (const o of allies(p, B.courage.radius)) {
        if (o.dead) continue
        o.buffT = B.courage.time
        sfx('buff', { x: o.x, z: o.z, delay: 0.5 + Math.random() * 0.15 })
        fx.ring(o.x, o.gy || 0, o.z, 0xffd24a, 0.2, 1.4, 0.7)
        fx.burst(o.x, (o.y || 0) + 1.8, o.z, 0xffd24a, 8, 3, 0.6)
      }
    })
  }

  const SKILLS = {
    gunner: [(p) => setWeapon(p, WEAPON_ORDER[(WEAPON_ORDER.indexOf(p.weapon) + 1) % WEAPON_ORDER.length]), (p) => startReload(p), grenade],
    samurai: [dash, spin],
    mage: [meteor, nova],
    bard: [song, courage],
  }
  const PRIMARY = { gunner: shoot, samurai: slash, mage: bolt, bard: wave }

  return {
    setWeapon,
    // botão i (0, 1, 2) da classe
    skill(p, i) {
      const list = SKILLS[p.cls.id]
      if (!list[i] || p.dead || p.cd[i] > 0 || (p.atk > 0 && p.cls.cd[i])) return
      if (p.vehicle && !(p.cls.id === 'gunner' && i < 2)) return // de carro: só trocar arma/recarregar
      if (list[i](p) === false) return
      p.cd[i] = p.cls.cd[i]
    },
    // por jogador, a cada quadro
    tick(p, dt) {
      p.cool -= dt
      p.atk = Math.max(0, p.atk - dt)
      p.comboT += dt
      p.invulnT = Math.max(0, p.invulnT - dt)
      p.buffT = Math.max(0, p.buffT - dt)
      if ((p.slowT -= dt) <= 0) p.slowAct = 1
      for (let i = 0; i < p.cd.length; i++) p.cd[i] = Math.max(0, p.cd[i] - dt)
      p.mana = Math.min(MANA, p.mana + MANA_REGEN * dt * (p.firing ? M.manaRegenAttacking : 1))
      if (p.dead) return
      if (p.weapon && p.reload > 0 && (p.reload -= dt) <= 0) {
        const w = WEAPONS[p.weapon], s = p.ammo[p.weapon]
        const take = Math.min(w.mag - s.mag, s.reserve)
        s.mag += take; s.reserve -= take; p.reload = 0
      }
      // investida: corta quem estiver no caminho
      if (p.dashT > 0 && p.dashHit) {
        for (const e of enemies) {
          if (e.dying > 0 || p.dashHit.has(e) || !sameFloor(e, p) || Math.hypot(e.x - p.x, e.z - p.z) > e.radius + S.dash.reach) continue
          p.dashHit.add(e)
          ctx.hit(e, S.dash.damage * dmgMul(p), p, Math.cos(p.dashA) * S.dash.knock * (Math.random() < 0.5 ? 1 : -1), -Math.sin(p.dashA) * S.dash.knock)
          fx.burst(e.x, 1.2, e.z, 0xeaf4ff, 6, 4, 0.35)
        }
        if (Math.random() < 0.6) fx.puff(p.x, (p.gy || 0) + 0.2, p.z, 0xd8d0c0, 0.35, 0.45, 0.5)
      }
      if (p.buffT > 0 && Math.random() < dt * 2) fx.note(p.x, (p.y || 0) + 2.1, p.z, 0xffd24a, 0.8)
      const canAttack = !p.vehicle || (p.cls.ranged && p.seat.mode !== 'drive') // de carro: só passageiro, e só à distância
      if (p.firing && canAttack && !p.swim) PRIMARY[p.cls.id](p)
    },
    // projéteis e efeitos com tempo
    update(dt) {
      for (let i = timers.length - 1; i >= 0; i--) if ((timers[i].t -= dt) <= 0) { const f = timers[i].fn; timers.splice(i, 1); f() }
      for (let i = tracers.length - 1; i >= 0; i--) if ((tracers[i].life -= dt) <= 0) { scene.remove(tracers[i].mesh); tracers.splice(i, 1) }
      // dardos mágicos: viram um pouco em direção ao inimigo mais à frente
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i]
        b.life -= dt
        let tgt = null, bd = M.bolt.seek
        for (const e of enemies) {
          if (e.dying > 0 || !sameFloor(e, b.p)) continue
          const dx = e.x - b.m.position.x, dz = e.z - b.m.position.z, d = Math.hypot(dx, dz)
          if (d < bd && Math.abs(wrap(Math.atan2(dx, dz) - b.a)) < 0.5) { bd = d; tgt = e }
        }
        if (tgt) { const want = Math.atan2(tgt.x - b.m.position.x, tgt.z - b.m.position.z); b.a += Math.max(-M.bolt.turn * dt, Math.min(M.bolt.turn * dt, wrap(want - b.a))) }
        b.m.position.x += Math.sin(b.a) * M.bolt.speed * dt
        b.m.position.z += Math.cos(b.a) * M.bolt.speed * dt
        b.m.rotation.y += dt * 12
        if (Math.random() < 0.5) fx.burst(b.m.position.x, b.m.position.y, b.m.position.z, 0xffe08a, 1, 0.6, 0.25, 0.7)
        let hit = null
        for (const e of enemies) if (e.dying <= 0 && sameFloor(e, b.p) && Math.hypot(e.x - b.m.position.x, e.z - b.m.position.z) < e.radius + 0.25) { hit = e; break }
        const wall = HitWall(b.m.position.x, b.m.position.z, b.p.lv || 0)
        if (hit || wall || b.life <= 0) {
          if (hit) ctx.hit(hit, M.bolt.damage * dmgMul(b.p), b.p, Math.sin(b.a) * M.bolt.knock, Math.cos(b.a) * M.bolt.knock)
          if (hit || wall) { sfx('zap', { x: b.m.position.x, z: b.m.position.z }); fx.flash(b.m.position.x, b.m.position.y, b.m.position.z, 0.5, 0xffc94a, 0.2); fx.burst(b.m.position.x, b.m.position.y, b.m.position.z, 0xffd86a, 6, 3, 0.35) }
          scene.remove(b.m); bolts.splice(i, 1)
        }
      }
      // granadas: parábola até o ponto e explodem ao cair
      for (let i = nades.length - 1; i >= 0; i--) {
        const n = nades[i]
        n.t += dt
        const k = Math.min(1, n.t / n.T), gy = GroundAt(n.tx, n.tz)
        n.m.position.set(n.x0 + (n.tx - n.x0) * k, n.y0 + (gy + 0.1 - n.y0) * k + Math.sin(k * Math.PI) * 2.6, n.z0 + (n.tz - n.z0) * k)
        n.m.rotation.x += dt * 14
        if (k >= 1) { scene.remove(n.m); nades.splice(i, 1); explode(n.p, n.tx, n.tz, G.grenade.radius, G.grenade.damage, G.grenade.knock, 0xffa040); sfx('explosion', { x: n.tx, z: n.tz }) }
      }
      // meteoros: caem em diagonal no alvo marcado
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        m.t += dt
        const k = Math.min(1, m.t / m.T), e = k * k
        m.m.position.set(m.tx - 4 * (1 - e), m.ty + 16 * (1 - e) + 0.4, m.tz - 4 * (1 - e))
        m.m.rotation.x += dt * 6
        if (Math.random() < 0.8) fx.puff(m.m.position.x, m.m.position.y, m.m.position.z, 0xff9a3a, 0.7, 0.5, 0.2)
        if (k >= 1) { scene.remove(m.m); meteors.splice(i, 1); explode(m.p, m.tx, m.tz, M.meteor.radius, M.meteor.damage, M.meteor.knock, 0xff6a2a); sfx('fireboom', { x: m.tx, z: m.tz }) }
      }
    },
    // texto e botões para o HUD e o celular
    info(p) {
      const c = p.cls
      let text = c.name
      if (c.id === 'gunner') { const s = p.ammo[p.weapon]; text = `${WEAPONS[p.weapon].name} ${p.reload > 0 ? '· recarregando' : `${s.mag}/${s.reserve === Infinity ? '∞' : s.reserve}`}` }
      else if (c.id === 'mage') text = `Mana ${Math.floor(p.mana)}`
      else if (c.id === 'samurai') text = 'Katana'
      else if (c.id === 'bard') text = p.buffT > 0 ? 'Alaúde · coragem!' : 'Alaúde'
      return { text, buttons: c.buttons.map((l, i) => ({ l, cd: c.cd[i] ? p.cd[i] / c.cd[i] : 0 })) }
    },
    clear() {
      for (const l of [tracers, bolts, nades, meteors]) { for (const o of l) scene.remove(o.mesh || o.m); l.length = 0 }
      timers.length = 0
    },
  }
}
