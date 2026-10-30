import * as THREE from 'three'
import { MAT } from '../../engine/render/style'
import { VEHICLES, VehicleGeo, KINDS } from './models'
import { resolve, Blocked, AddColliders, RemoveColliders } from '../../engine/world/collision'
import { GroundAt, WaterDepth, TooDeep } from '../worldgen/sidewalk'
import { RoadDist, Paved, ROAD_HALF } from '../worldgen/layout'
import { hash } from '../../engine/world/noise'
import { sfx, gate } from '../audio/sfx'

// Veículos dirigíveis para os 4 jogadores.
// - Os carros "abandonados" do mapa (props 'car' dos chunks, via register) e três na largada são pontos de nascimento;
//   o veículo de verdade só existe perto de alguém. Um veículo que já foi usado nunca some.
// - Direção relativa ao carro: cima/W acelera, baixo/S freia e depois dá ré, esquerda/direita viram o volante.
//   Arrasto lateral limitado = derrapagem nas curvas rápidas.
// - Cada veículo põe 3 caixas no grid de colisão (marcadas com veh): jogadores, inimigos e outros carros batem nele,
//   e o "olho"/A* dos inimigos desvia dele.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt))
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI }
const SPAWN_R = 46, DESPAWN_R = 80
const FORGET_R = 120 // ponto nunca usado e tão longe assim: esquece (o chunk dele já saiu e registra de novo quando voltar)
const wreckMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x4a4440 })

export function CreateVehicles(scene, fx, wfx) {
  const list = []
  const tmp = { x: 0, z: 0, lv: 0, veh: null }
  let scanT = 0

  // pontos de nascimento: key -> { key, kind, c, x, z, ry, done, v, fixed }
  const spawns = new Map()
  function register(p, fixed = false) {
    const key = `${Math.round(p.x * 4)},${Math.round(p.z * 4)}`
    if (spawns.has(key)) return
    const kind = p.kind || KINDS[Math.floor(hash(Math.round(p.x), Math.round(p.z), 77) * KINDS.length) % KINDS.length]
    spawns.set(key, { key, kind, c: p.c ?? 0, x: p.x, z: p.z, ry: p.ry || 0, done: false, v: null, fixed })
  }
  // largada: um de cada, estacionados na estrada principal (x = 0); nunca são esquecidos
  register({ x: 1.6, z: 9, ry: 0.04, kind: 'jeep', c: 0 }, true)
  register({ x: -1.6, z: 16, ry: Math.PI - 0.05, kind: 'pickup', c: 0 }, true)
  register({ x: 1.6, z: -13, ry: Math.PI + 0.03, kind: 'sedan', c: 1 }, true)

  function create(s) {
    const d = VEHICLES[s.kind], g = VehicleGeo(s.kind, s.c)
    const r = d.W / 2, n = 3, offs = [...Array(n)].map((_, i) => -d.L / 2 + r + ((d.L - 2 * r) * i) / (n - 1))
    // nasce num lugar livre (desliza ao longo do próprio eixo se algo ocupa o ponto)
    const fx0 = Math.sin(s.ry), fz0 = Math.cos(s.ry)
    let x = s.x, z = s.z, ok = false
    for (const shift of [0, 1.5, -1.5, 3, -3]) {
      x = s.x + fx0 * shift; z = s.z + fz0 * shift
      if (offs.every((o) => !Blocked(x + fx0 * o, z + fz0 * o, r * 0.85))) { ok = true; break }
    }
    if (!ok) { s.done = true; return null }
    const group = new THREE.Group(), chassis = new THREE.Group()
    group.rotation.order = 'YXZ'
    group.add(chassis)
    const body = new THREE.Mesh(g.body, MAT.solid), lights = new THREE.Mesh(g.lights, MAT.glow), brake = new THREE.Mesh(g.brake, MAT.glow)
    brake.visible = false
    chassis.add(body, lights, brake)
    const wheels = g.wheels.map(([wx, wy, wz]) => {
      const pivot = new THREE.Group(), spin = new THREE.Mesh(g.wheel, MAT.solid)
      pivot.position.set(wx, wy, wz)
      pivot.add(spin)
      group.add(pivot)
      return { pivot, spin, front: wz > 0, x: wx, z: wz }
    })
    scene.add(group)
    const v = {
      key: s.key, kind: s.kind, d, x, z, yaw: s.ry, vx: 0, vz: 0, fwd: 0, steer: 0, acc: 0, y: GroundAt(x, z), pitch: 0, roll: 0,
      hp: d.hp, wrecked: false, touched: false, group, chassis, body, lights, brake, wheels, r, offs,
      seats: d.seats.map(() => null), cols: offs.map(() => ({ x: 0, z: 0, hw: r * 0.86, hd: r * 0.86, veh: null })), lastDriver: null, smokeT: 0, sleep: false,
    }
    for (const c of v.cols) c.veh = v
    placeCols(v)
    AddColliders(v.cols)
    s.v = v
    list.push(v)
    pose(v, 1)
    return v
  }
  function remove(v) {
    for (const p of v.seats) if (p) exit(p, true)
    RemoveColliders(v.cols)
    scene.remove(v.group)
    list.splice(list.indexOf(v), 1)
    const s = spawns.get(v.key)
    if (s) s.v = null
  }
  function placeCols(v) {
    const fx0 = Math.sin(v.yaw), fz0 = Math.cos(v.yaw)
    v.offs.forEach((o, i) => { v.cols[i].x = v.x + fx0 * o; v.cols[i].z = v.z + fz0 * o })
  }

  // ---- posição visual: altura e inclinação pelo terreno sob as 4 rodas + balanço da carroceria ----
  function pose(v, k) {
    const fx0 = Math.sin(v.yaw), fz0 = Math.cos(v.yaw), sx = Math.cos(v.yaw), sz = -Math.sin(v.yaw)
    const h = v.wheels.map((w) => GroundAt(v.x + sx * w.x + fx0 * w.z, v.z + sz * w.x + fz0 * w.z))
    const wb = v.wheels[0].z - v.wheels[2].z, tr = v.wheels[0].x - v.wheels[1].x
    const yT = (h[0] + h[1] + h[2] + h[3]) / 4
    const pT = -Math.atan2((h[0] + h[1]) / 2 - (h[2] + h[3]) / 2, wb)
    const rT = Math.atan2((h[0] + h[2]) / 2 - (h[1] + h[3]) / 2, tr)
    v.y += (yT - v.y) * k; v.pitch += (pT - v.pitch) * k; v.roll += (rT - v.roll) * k
    v.group.position.set(v.x, v.y, v.z)
    v.group.rotation.set(v.pitch, v.yaw, v.roll)
  }

  // ---- entrar / sair ----
  function nearest(p, max = 1.5) {
    let best = null, bd = max
    for (const v of list) {
      if (v.wrecked) continue
      const dx = p.x - v.x, dz = p.z - v.z, fx0 = Math.sin(v.yaw), fz0 = Math.cos(v.yaw)
      const lz = Math.abs(dx * fx0 + dz * fz0) - v.d.L / 2, lx = Math.abs(dx * fz0 - dz * fx0) - v.d.W / 2
      const d = Math.hypot(Math.max(lz, 0), Math.max(lx, 0))
      if (d < bd && v.seats.some((s) => !s)) { bd = d; best = v }
    }
    return best
  }
  function enter(p) {
    const v = nearest(p)
    if (!v || p.dead || p.swim) return false
    // motorista se o banco estiver livre; senão o banco livre mais perto
    let i = v.seats[0] ? -1 : 0
    if (i < 0) {
      let bd = Infinity
      v.seats.forEach((s, j) => {
        if (s) return
        const [lx, , lz] = v.d.seats[j], wx = v.x + Math.cos(v.yaw) * lx + Math.sin(v.yaw) * lz, wz = v.z - Math.sin(v.yaw) * lx + Math.cos(v.yaw) * lz
        const d = Math.hypot(wx - p.x, wz - p.z)
        if (d < bd) { bd = d; i = j }
      })
    }
    const [, , , mode, hidden] = v.d.seats[i]
    v.seats[i] = p
    v.touched = true
    const s = spawns.get(v.key)
    if (s) s.done = true
    p.vehicle = v; p.seat = { idx: i, mode, steer: 0 }; p.pad = v.d.W / 2 + 0.3
    p.vx = p.vz = p.vy = p.jy = 0; p.swim = false; p.dashT = 0
    p.model.root.visible = !hidden
    if (mode === 'drive') v.lastDriver = p
    if (mode !== 'stand') { sfx('door', { x: v.x, z: v.z, open: true }); sfx('door', { x: v.x, z: v.z, delay: 0.4 }) }
    return true
  }
  function exit(p, force = false) {
    const v = p.vehicle
    if (!v) return
    const [lx, , lz] = v.d.seats[p.seat.idx]
    const fx0 = Math.sin(v.yaw), fz0 = Math.cos(v.yaw), sx = Math.cos(v.yaw), sz = -Math.sin(v.yaw)
    const side = lx >= 0 ? 1 : -1
    const opts = [[side * (v.d.W / 2 + 0.7), lz], [-side * (v.d.W / 2 + 0.7), lz], [0, -(v.d.L / 2 + 0.8)], [0, v.d.L / 2 + 0.8], [side * (v.d.W / 2 + 1.6), lz]]
    let ox = v.x + sx * opts[0][0] + fx0 * opts[0][1], oz = v.z + sz * opts[0][0] + fz0 * opts[0][1]
    const now = performance.now()
    v.exits = (v.exits || []).filter((e) => now - e.t < 800) // quem acabou de descer ocupa o lugar
    for (const [a, b] of opts) {
      const x = v.x + sx * a + fx0 * b, z = v.z + sz * a + fz0 * b
      if (!Blocked(x, z, 0.45) && v.exits.every((e) => Math.hypot(e.x - x, e.z - z) > 0.8)) { ox = x; oz = z; break }
    }
    v.exits.push({ x: ox, z: oz, t: now })
    if (p.seat.mode !== 'stand' && !v.wrecked) { sfx('door', { x: v.x, z: v.z, open: true }); sfx('door', { x: v.x, z: v.z, delay: 0.45 }) }
    v.seats[p.seat.idx] = null
    p.vehicle = null; p.seat = null; p.pad = 0; p.lookX = p.lookZ = 0
    p.x = ox; p.z = oz; p.vx = v.vx * 0.7; p.vz = v.vz * 0.7; p.gy = undefined; p.lv = 0
    p.model.root.visible = true
    p.model.root.position.set(p.x, GroundAt(p.x, p.z), p.z)
    if (!force && Math.hypot(v.vx, v.vz) > 9) p.hurtCar = (Math.hypot(v.vx, v.vz) - 9) * 2 // pular do carro andando machuca
  }
  function wreck(v) {
    v.wrecked = true
    v.body.material = wreckMat
    v.lights.visible = v.brake.visible = false
    for (const p of [...v.seats]) if (p) { exit(p, true); p.hurtCar = 12 }
    fx.flash(v.x, v.y + 1, v.z, 3, 0xff8a3a, 0.4)
    sfx('wreck', { x: v.x, z: v.z })
    fx.burst(v.x, v.y + 1, v.z, 0xff9a3a, 20, 8, 0.8, 1.4)
    for (let i = 0; i < 8; i++) fx.puff(v.x + (Math.random() - 0.5) * 2, v.y + 1, v.z + (Math.random() - 0.5) * 3, 0x3a3836, 1.4, 2, 1.6)
  }
  function damage(v, n) {
    if (v.wrecked) return
    v.hp -= n
    if (v.hp <= 0) { v.hp = 0; wreck(v) }
  }

  // ---- física de um veículo ----
  function drive(v, dt, enemies, hooks) {
    const d = v.d, driver = v.seats[0]
    const fx0 = Math.sin(v.yaw), fz0 = Math.cos(v.yaw), sx = Math.cos(v.yaw), sz = -Math.sin(v.yaw)
    let fwd = v.vx * fx0 + v.vz * fz0, lat = v.vx * sx + v.vz * sz
    const road = RoadDist(v.x, v.z) < ROAD_HALF + 0.4 || Paved(v.x, v.z) > 0.5
    const wade = WaterDepth(v.x, v.z)
    const top = d.max * (road ? 1 : d.off) * (wade > 0.15 ? 0.45 : 1) * (v.hp < d.hp * 0.3 ? 0.65 : 1)
    let throttle = 0, steerT = 0, braking = false
    if (driver && !v.wrecked) {
      // controle relativo ao carro: cima/W acelera, baixo/S freia e depois dá ré, lados/A-D viram para a esquerda/direita do carro
      const { mx, mz } = driver.input
      if (Math.abs(mz) > 0.15) throttle = clamp(-mz, -1, 1)
      if (Math.abs(mx) > 0.15) steerT = clamp(-mx, -1, 1)
    }
    if (throttle > 0.01) {
      if (fwd < -0.3) { fwd = Math.min(0, fwd + d.brake * dt); braking = true } else fwd += d.accel * throttle * dt * clamp(1 - fwd / top, -1, 1)
    } else if (throttle < -0.01) {
      if (fwd > 0.3) { fwd = Math.max(0, fwd - d.brake * dt); braking = true } else fwd -= d.accel * 0.7 * -throttle * dt * clamp(1 + fwd / d.rev, 0, 1)
    } else {
      const c = (driver ? 2.2 : 7) + Math.abs(fwd) * 0.1 // sem motorista: freio de mão
      fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), c * dt)
      braking = !driver || Math.abs(fwd) > 1
    }
    lat *= Math.exp(-d.grip * (road ? 1 : 0.7) * dt)
    v.steer = damp(v.steer, steerT, 7, dt)
    const yawRate = v.steer * d.turn * clamp(fwd / 5, -1, 1) * (1 - Math.min(Math.abs(fwd) / d.max, 1) * 0.4)
    v.acc = damp(v.acc, (fwd - v.fwd) / Math.max(dt, 1e-3), 6, dt)
    v.fwd = fwd
    v.yaw += yawRate * dt
    // velocidade no referencial antigo: ao girar, parte dela vira "lateral" e o pneu segura aos poucos (derrapagem)
    v.vx = fx0 * fwd + sx * lat
    v.vz = fz0 * fwd + sz * lat

    // ---- movimento + colisão (3 círculos ao longo do carro) ----
    const px = v.x, pz = v.z, py = v.yaw
    v.x += v.vx * dt; v.z += v.vz * dt
    let impact = 0
    tmp.veh = v
    for (let it = 0; it < 2; it++) {
      const f1 = Math.sin(v.yaw), f2 = Math.cos(v.yaw)
      for (const o of v.offs) {
        const cx = v.x + f1 * o, cz = v.z + f2 * o
        tmp.x = cx; tmp.z = cz
        resolve(tmp, v.r, null, 0)
        const ux = tmp.x - cx, uz = tmp.z - cz, l = Math.hypot(ux, uz)
        if (l < 1e-5) continue
        v.x += ux; v.z += uz
        v.yaw += clamp((f2 * o * ux - f1 * o * uz) * 0.18, -0.05, 0.05) // batida de quina gira o carro
        const nx = ux / l, nz = uz / l, vn = v.vx * nx + v.vz * nz
        if (vn < 0) { v.vx -= nx * vn * 1.2; v.vz -= nz * vn * 1.2; impact = Math.max(impact, -vn) }
      }
    }
    // água funda: o carro não entra (volta e para)
    const f1 = Math.sin(v.yaw), f2 = Math.cos(v.yaw)
    if (v.offs.some((o) => TooDeep(v.x + f1 * (o + Math.sign(o) * 0.4), v.z + f2 * (o + Math.sign(o) * 0.4)))) {
      v.x = px; v.z = pz; v.yaw = py; impact = Math.max(impact, Math.hypot(v.vx, v.vz) * 0.5); v.vx *= -0.15; v.vz *= -0.15
      if (Math.random() < 0.3) wfx.splash(v.x + f1 * v.d.L * 0.5, v.z + f2 * v.d.L * 0.5, 6, 0.8)
    }
    if (impact > 3 && gate('crash', 0.25)) sfx('crash', { x: v.x, z: v.z, power: (impact - 3) / 12, vol: Math.min(1, impact / 8) }) // batida: amassa e (forte) quebra vidro
    if (impact > 6) {
      if (hooks.impact) hooks.impact(v.x, v.z, 'crash', Math.min(1, (impact - 6) / 10)) // batida forte: o jogo decide o tremor
      damage(v, (impact - 6) * 3.2 / d.mass)
      fx.burst(v.x + f1 * d.L * 0.45, v.y + 0.7, v.z + f2 * d.L * 0.45, 0xffd27a, 6, 4, 0.35)
      for (const p of v.seats) if (p) p.model.hurt()
    }

    // ---- atropelar inimigos ----
    const spd = Math.hypot(v.vx, v.vz)
    const g1 = Math.sin(v.yaw), g2 = Math.cos(v.yaw), s1 = Math.cos(v.yaw), s2 = -Math.sin(v.yaw)
    for (const e of enemies) {
      if (e.dying > 0) continue
      e.carT = Math.max(0, (e.carT || 0) - dt)
      const dx = e.x - v.x, dz = e.z - v.z, lz = dx * g1 + dz * g2, lx = dx * s1 + dz * s2
      if (Math.abs(lz) > d.L / 2 + e.radius || Math.abs(lx) > d.W / 2 + e.radius) continue
      if (spd > 4.5 && e.carT <= 0) {
        e.carT = 0.4
        hooks.hit(e, (spd - 3.5) * 0.8 * d.mass, v.lastDriver, v.vx * 0.9 + Math.sign(lx || 1) * s1 * 4, v.vz * 0.9 + Math.sign(lx || 1) * s2 * 4) // forte = zumbi derrubado
        v.vx *= 0.92; v.vz *= 0.92
        damage(v, 1.2)
        sfx('runover', { x: e.x, z: e.z })
        if (hooks.impact) hooks.impact(e.x, e.z, 'runover') // atropelou: o jogo decide tremor/pausa
        fx.burst(e.x, (e.group.position.y || 0) + 1, e.z, 0x6a1612, 6, 5, 0.4)
      }
    }

    // ---- visual: rodas, balanço, luzes, fumaça ----
    for (const w of v.wheels) {
      w.spin.rotation.x += (fwd * dt) / w.pivot.position.y
      if (w.front) w.pivot.rotation.y = v.steer * 0.55
    }
    v.chassis.rotation.z = damp(v.chassis.rotation.z, clamp(fwd * yawRate * 0.009, -0.08, 0.08), 8, dt)
    v.chassis.rotation.x = damp(v.chassis.rotation.x, clamp(-v.acc * 0.006, -0.06, 0.06), 8, dt)
    v.chassis.position.y = damp(v.chassis.position.y, driver ? Math.sin(performance.now() * 0.05) * 0.008 : 0, 10, dt) // motor ligado: vibra
    v.brake.visible = !v.wrecked && braking && !!driver
    if (driver && !v.wrecked && throttle > 0.3 && Math.random() < dt * 8) fx.puff(v.x - g1 * (d.L / 2 + 0.1) + s1 * 0.5, v.y + 0.45, v.z - g2 * (d.L / 2 + 0.1) + s2 * 0.5, 0xb8b8bc, 0.28, 0.6, 0.6)
    if (wade > 0.1 && spd > 3 && Math.random() < dt * 10) wfx.splash(v.x + s1 * d.W * 0.5 * (Math.random() < 0.5 ? 1 : -1), v.z + s2 * d.W * 0.5, 3, 0.6)
    pose(v, 1 - Math.exp(-14 * dt))
  }

  // ---- ocupantes acompanham o banco ----
  function seatPlayers(v, dt) {
    const fx0 = Math.sin(v.yaw), fz0 = Math.cos(v.yaw), sx = Math.cos(v.yaw), sz = -Math.sin(v.yaw)
    v.seats.forEach((p, i) => {
      if (!p) return
      const [lx, ly, lz, mode] = v.d.seats[i]
      p.x = v.x + sx * lx + fx0 * lz
      p.z = v.z + sz * lx + fz0 * lz
      p.gy = v.y; p.jy = 0; p.lv = 0
      p.y = v.y + ly - (mode === 'stand' ? 0 : 0.48)
      p.speed = Math.abs(v.fwd)
      p.vx = v.vx; p.vz = v.vz
      p.lookX = v.vx * 0.45; p.lookZ = v.vz * 0.45 // a câmera olha à frente do carro
      p.seat.steer = v.steer
      // passageiro mirando gira o corpo; motorista e quem não mira olham para a frente do carro
      const { ax, az } = p.input, aim = Math.hypot(ax, az) > 0.25 && mode !== 'drive'
      p.aiming = aim; p.firing = aim && p.input.fire !== 0; p.running = false
      const prev = p.facing
      if (aim) p.aimAngle = Math.atan2(ax, az)
      const want = aim ? p.aimAngle : v.yaw
      p.facing += clamp(wrap(want - p.facing), -12 * dt, 12 * dt)
      if (!aim) p.facing = v.yaw + wrap(p.facing - v.yaw) * Math.exp(-10 * dt)
      p.turn = 0
      if (aim) p.turn = wrap(p.facing - prev) / Math.max(dt, 1e-4)
      p.model.root.position.set(p.x, p.y, p.z)
      p.model.root.rotation.y = p.facing
    })
  }

  return {
    list,
    register, // o mundo avisou "aqui cabe um carro"
    get spawnCount() { return spawns.size },
    // pts: posições de quem está jogando (ou o centro do menu)
    update(dt, players, enemies, pts, hooks) {
      if ((scanT -= dt) <= 0) {
        scanT = 0.5
        for (const s of spawns.values()) if (!s.done && !s.v && pts.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < SPAWN_R)) create(s)
        for (const [k, s] of spawns) if (!s.fixed && !s.done && !s.v && pts.every((p) => Math.hypot(p.x - s.x, p.z - s.z) > FORGET_R)) spawns.delete(k)
        for (const v of [...list]) {
          const far = pts.every((p) => Math.hypot(p.x - v.x, p.z - v.z) > DESPAWN_R)
          v.sleep = far && !v.seats.some(Boolean)
          if (far && !v.touched) remove(v)
        }
      }
      for (const v of list) {
        if (v.sleep) continue
        RemoveColliders(v.cols)
        drive(v, dt, enemies, hooks)
        placeCols(v)
        AddColliders(v.cols)
        seatPlayers(v, dt)
        // fumaça de motor estragado / carcaça queimando
        if ((v.hp < v.d.hp * 0.4 || v.wrecked) && (v.smokeT -= dt) <= 0) {
          v.smokeT = v.wrecked ? 0.25 : 0.45
          fx.puff(v.x + Math.sin(v.yaw) * v.d.L * 0.32, v.y + 1.2, v.z + Math.cos(v.yaw) * v.d.L * 0.32, v.wrecked ? 0x2e2c2a : 0x8a8a90, 0.6, 1.6, 1.3)
        }
      }
    },
    use(p) { if (p.vehicle) { exit(p); return true } return enter(p) },
    exit,
    nearest,
    damage,
    clear() {
      for (const v of [...list]) remove(v)
      for (const s of spawns.values()) s.done = false
    },
  }
}
