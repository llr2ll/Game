import * as THREE from 'three'
import { CreatePlayerModel } from './characters/player'
import { UpdatePlayerMovement } from './characters/player-moviment'
import { CreateEnemy, UpdateEnemy, TYPES } from './enemies/enemies'
import { WEAPONS, WEAPON_ORDER } from './weapons/weapons'
import { rayBox } from './world/collision'
import { Height } from './world/terrain'

const tracerGeo = new THREE.BoxGeometry(0.04, 0.04, 1)
const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 })
const MAX_PLAYERS = 4

export function CreateGame(scene, colliders, net) {
  const players = new Map(), enemies = [], tracers = []
  const st = { wave: 0, toSpawn: 0, spawnT: 0, pause: 3, score: 0, over: false, overT: 0, msg: '', msgT: 0, sync: 0 }
  const tmp = new THREE.Vector3()

  const say = (t, s = 2.2) => { st.msg = t; st.msgT = s }
  const alive = () => [...players.values()].filter((p) => !p.dead)

  function addPlayer(id, name) {
    if (players.has(id) || players.size >= MAX_PLAYERS) return
    const idx = [...players.values()].length
    const model = CreatePlayerModel(idx)
    scene.add(model.root)
    players.set(id, {
      id, name, idx, model, x: (idx - 1.5) * 1.3, z: 0, vx: 0, vz: 0, aimAngle: 0, facing: 0, speed: 0, aiming: false, firing: false,
      jy: 0, vy: 0, gy: 0, y: 0, stamina: 100, tired: false, running: false,
      hp: 100, max: 100, dead: false, weapon: 'carbine', cool: 0, reload: 0, kills: 0, lastIn: performance.now(),
      ammo: { pistol: { mag: WEAPONS.pistol.mag, reserve: Infinity }, carbine: { mag: WEAPONS.carbine.mag, reserve: WEAPONS.carbine.reserve } },
      input: { mx: 0, mz: 0, ax: 0, az: 0, run: 0 },
    })
  }
  function removePlayer(id) {
    const p = players.get(id)
    if (!p) return
    scene.remove(p.model.root)
    players.delete(id)
  }
  function setInput(id, m) {
    const p = players.get(id)
    if (!p) return
    p.input.mx = +m.mx || 0; p.input.mz = +m.mz || 0; p.input.ax = +m.ax || 0; p.input.az = +m.az || 0; p.input.run = m.run ? 1 : 0
    p.lastIn = performance.now()
  }
  function setWeapon(p, w) {
    if (p.weapon === w || p.reload > 0) return
    p.weapon = w
    p.model.setWeapon(w)
  }
  function startReload(p) {
    const w = WEAPONS[p.weapon], s = p.ammo[p.weapon]
    if (p.reload > 0 || s.mag >= w.mag || s.reserve <= 0) return
    p.reload = w.reload
  }
  function act(id, a) {
    const p = players.get(id)
    if (!p || p.dead) return
    if (a === 'swap') setWeapon(p, WEAPON_ORDER[(WEAPON_ORDER.indexOf(p.weapon) + 1) % WEAPON_ORDER.length])
    else if (a === 'reload') startReload(p)
    else if (a === 'jump') { if (p.jy <= 0.02) p.vy = 9 }
    else if (WEAPONS[a]) setWeapon(p, a)
  }

  function fire(p) {
    const w = WEAPONS[p.weapon], s = p.ammo[p.weapon]
    if (p.reload > 0 || p.cool > 0) return
    if (s.mag <= 0) return startReload(p)
    p.cool = w.rate
    s.mag--
    const a = p.aimAngle + (Math.random() - 0.5) * 2 * w.spread
    const dx = Math.sin(a), dz = Math.cos(a)
    let best = null, bt = w.range
    for (const e of enemies) {
      if (e.dying > 0) continue
      const rx = e.x - p.x, rz = e.z - p.z
      const t = rx * dx + rz * dz
      if (t < 0 || t > bt) continue
      if (Math.abs(rx * dz - rz * dx) < e.radius) { best = e; bt = t }
    }
    for (const c of colliders) {
      const t = rayBox(p.x, p.z, dx, dz, c)
      if (t < bt) { bt = t; best = null }
    }
    p.model.root.updateMatrixWorld(true)
    p.model.muzzle(tmp)
    p.model.kick()
    const tr = new THREE.Mesh(tracerGeo, tracerMat)
    const len = Math.max(bt - 0.6, 0.5)
    tr.scale.z = len
    tr.position.set(tmp.x + (dx * len) / 2, tmp.y, tmp.z + (dz * len) / 2)
    tr.rotation.y = a
    scene.add(tr)
    tracers.push({ mesh: tr, life: 0.06 })
    if (best) {
      best.hp -= w.dmg
      best.hitT = 0.1
      best.x += dx * 0.12; best.z += dz * 0.12
      if (best.hp <= 0 && best.dying <= 0) { best.dying = 0.25; st.score += best.score; p.kills++ }
    }
    if (s.mag <= 0) startReload(p)
  }

  function hurt(p, dmg) {
    if (p.dead) return
    p.hp -= dmg
    net && p.id !== 'local' && net.send(p.id, { t: 'hit' })
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.reload = 0 }
  }

  function nextWave() {
    st.wave++
    st.toSpawn = 5 + st.wave * 3 + (players.size - 1) * 3
    for (const p of players.values()) {
      const c = p.ammo.carbine
      c.reserve = Math.min(c.reserve + 45, 180)
      if (p.dead) { p.dead = false; p.hp = p.max * 0.5 } else p.hp = Math.min(p.max, p.hp + 30)
    }
    say(`ONDA ${st.wave}`)
  }
  function spawn() {
    const list = alive()
    if (!list.length) return
    const t = list[(Math.random() * list.length) | 0]
    const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 5
    const r = Math.random()
    let type = 'scarecrow'
    if (st.wave >= 2 && r < 0.22) type = 'crow'
    else if (st.wave >= 3 && r > 1 - Math.min(0.06 + st.wave * 0.02, 0.18)) type = 'logger'
    const e = CreateEnemy(type, t.x + Math.cos(a) * d, t.z + Math.sin(a) * d)
    scene.add(e.group)
    enemies.push(e)
  }
  function restart() {
    for (const e of enemies) scene.remove(e.group)
    enemies.length = 0
    Object.assign(st, { wave: 0, toSpawn: 0, pause: 3, score: 0, over: false })
    for (const p of players.values()) {
      Object.assign(p, { hp: p.max, dead: false, stamina: 100, tired: false, jy: 0, vy: 0, reload: 0, x: (p.idx - 1.5) * 1.3, z: 0, vx: 0, vz: 0 })
      p.ammo.pistol.mag = WEAPONS.pistol.mag
      p.ammo.carbine.mag = WEAPONS.carbine.mag; p.ammo.carbine.reserve = WEAPONS.carbine.reserve
    }
  }

  function update(dt) {
    const now = performance.now()
    st.msgT = Math.max(0, st.msgT - dt)

    for (const p of players.values()) {
      if (now - p.lastIn > 1500 && p.id !== 'local') p.input.mx = p.input.mz = p.input.ax = p.input.az = 0
      p.cool -= dt
      if (!p.dead) {
        UpdatePlayerMovement(p, dt, colliders)
        if (p.reload > 0 && (p.reload -= dt) <= 0) {
          const w = WEAPONS[p.weapon], s = p.ammo[p.weapon]
          const take = Math.min(w.mag - s.mag, s.reserve)
          s.mag += take; s.reserve -= take; p.reload = 0
        }
        if (p.firing) fire(p)
      } else { p.gy = Height(p.x, p.z); p.jy = 0; p.y = p.gy; p.model.root.position.set(p.x, p.y, p.z); p.speed = 0 }
      p.model.animate(dt, p.speed, p.dead)
    }

    // ondas
    if (players.size && !st.over) {
      if (!enemies.length && st.toSpawn === 0) { if ((st.pause -= dt) <= 0) { nextWave(); st.pause = 4 } }
      else if (st.toSpawn > 0 && (st.spawnT -= dt) <= 0) { spawn(); st.toSpawn--; st.spawnT = Math.max(0.35, 1.2 - st.wave * 0.06) }
      if (players.size && !alive().length) { st.over = true; st.overT = 6; say('FIM DE JOGO', 6) }
    } else if (st.over && (st.overT -= dt) <= 0) restart()

    // inimigos
    const list = [...players.values()]
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i]
      if (UpdateEnemy(e, dt, list, colliders, (p, en) => hurt(p, en.dmg))) { scene.remove(e.group); enemies.splice(i, 1) }
    }
    for (let i = 0; i < enemies.length; i++)
      for (let j = i + 1; j < enemies.length; j++) {
        const a = enemies[i], b = enemies[j]
        const dx = b.x - a.x, dz = b.z - a.z, min = (a.radius + b.radius) * 0.9, d2 = dx * dx + dz * dz
        if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2), p = (min - d) / 2; a.x -= (dx / d) * p; a.z -= (dz / d) * p; b.x += (dx / d) * p; b.z += (dz / d) * p }
      }

    for (let i = tracers.length - 1; i >= 0; i--) if ((tracers[i].life -= dt) <= 0) { scene.remove(tracers[i].mesh); tracers.splice(i, 1) }

    // estado para os celulares
    if (net && (st.sync -= dt) <= 0) {
      st.sync = 0.15
      for (const p of players.values()) {
        if (p.id === 'local') continue
        const s = p.ammo[p.weapon]
        net.send(p.id, { t: 'state', hp: Math.ceil(p.hp), max: p.max, w: WEAPONS[p.weapon].name, mag: s.mag, res: s.reserve === Infinity ? -1 : s.reserve, rl: p.reload > 0, dead: p.dead, st: Math.round(p.stamina), wave: st.wave, score: st.score })
      }
    }
  }

  return { players, enemies, st, addPlayer, removePlayer, setInput, act, update, alive }
}
