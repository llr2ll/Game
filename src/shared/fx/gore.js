import * as THREE from 'three'
import { GroundAt, WaterDepth } from '../worldgen/sidewalk'
import { WallAt } from '../../engine/world/collision'
import { PointInBuilding } from '../worldgen/buildings-registry'
import { CUT_H } from '../worldgen/buildings'

// Sangue e desmembramento:
// - gotas: voam com gravidade; ao bater no chão ou numa parede deixam uma mancha (decal)
// - manchas: ficam no mapa (anel de instâncias: as mais antigas são reaproveitadas); poças crescem sob os corpos
// - pedaços: braço/cabeça/canela arrancados do zumbi voam, quicam, deixam rastro e afundam no chão depois de um tempo
// - jatos: o toco (pescoço, ombro, joelho) espirra sangue por alguns segundos
// Tudo em InstancedMesh (1 draw call por tipo), exceto os pedaços, que reaproveitam a geometria do zumbi.
const MAX_DROPS = 500, MAX_GROUND = 2500, MAX_WALL = 700, MAX_GIBS = 40, GIB_T = 16
const G = 16
const rnd = (a, b) => a + Math.random() * (b - a)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color()
const _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0)

// mancha irregular: contorno com raio ruidoso + respingos soltos em volta; drips = escorridos para baixo (parede)
function blobGeo(drips) {
  const shapes = [], main = new THREE.Shape(), n = 16
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = 0.75 + Math.random() * 0.35
    if (i === 0) main.moveTo(r, 0)
    else main.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  main.closePath()
  shapes.push(main)
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, d = rnd(1.1, 1.7), r = rnd(0.06, 0.16), s = new THREE.Shape()
    s.absarc(Math.cos(a) * d, Math.sin(a) * d, r, 0, Math.PI * 2)
    shapes.push(s)
  }
  if (drips) for (const x of [-0.45, 0.05, 0.4]) {
    const w = rnd(0.07, 0.13), L = rnd(0.9, 2.2), s = new THREE.Shape()
    s.moveTo(x - w, -0.3); s.lineTo(x + w, -0.3); s.lineTo(x + w * 0.8, -L); s.absarc(x, -L, w * 0.8, 0, -Math.PI, true); s.lineTo(x - w, -0.3)
    shapes.push(s)
  }
  return new THREE.ShapeGeometry(shapes, 3)
}
// polygonOffset -7: acima do asfalto e do desgaste da estrada (-3…-6)
const bloodMat = (o = {}) => new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7, ...o })
const SHADES = [0x6e100c, 0x5a0c09, 0x7c1610, 0x4a0a08]

function pool(scene, geo, mat, N) {
  const mesh = new THREE.InstancedMesh(geo, mat, N)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  scene.add(mesh)
  let next = 0
  return {
    mesh,
    add(m, color) {
      const i = next
      next = (next + 1) % N
      mesh.count = Math.max(mesh.count, i + 1)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, _c.set(color))
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor.needsUpdate = true
      return i
    },
    set(i, m) { mesh.setMatrixAt(i, m); mesh.instanceMatrix.needsUpdate = true },
    clear() { mesh.count = 0; next = 0 },
  }
}

export function CreateGore(scene) {
  const ground = pool(scene, blobGeo(false).rotateX(-Math.PI / 2), bloodMat(), MAX_GROUND)
  const wall = pool(scene, blobGeo(true), bloodMat({ side: THREE.DoubleSide }), MAX_WALL)
  const dropMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x7a120e }), MAX_DROPS)
  dropMesh.count = 0
  dropMesh.frustumCulled = false
  dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  scene.add(dropMesh)
  const drops = [], grows = [], gibs = [], jets = []

  // chão do lugar: térreo segue o terreno; andar de cima usa a altura do piso de quem sangrou
  const floorAt = (x, z, lv, fy) => (lv ? fy : GroundAt(x, z))

  function splat(x, z, y, size, lv) {
    if (!lv && WaterDepth(x, z) > 0.05) return -1 // na água o sangue se dilui
    _q.setFromAxisAngle(_up, Math.random() * Math.PI * 2)
    _m.compose(_p.set(x, y + 0.025 + Math.random() * 0.004, z), _q, _s.set(size * rnd(0.8, 1.25), 1, size * rnd(0.8, 1.25)))
    return ground.add(_m, SHADES[(Math.random() * SHADES.length) | 0])
  }
  function wallSplat(c, x, y, z, px, pz, size, fl) {
    // parede de casa: fica abaixo da altura do recorte (com o jogador dentro as paredes são cortadas e a mancha flutuaria)
    if (PointInBuilding(x, z, 0.3)) { size = Math.min(size, 0.22); y = Math.min(y, fl + CUT_H - size * 0.8) }
    // face atravessada: a gota vinha de fora da caixa por esse lado
    let nx = 0, nz = 0
    if (px < c.x - c.hw) { nx = -1; x = c.x - c.hw - 0.012 } else if (px > c.x + c.hw) { nx = 1; x = c.x + c.hw + 0.012 }
    else if (pz < c.z - c.hd) { nz = -1; z = c.z - c.hd - 0.012 } else { nz = 1; z = c.z + c.hd + 0.012 }
    _q.setFromEuler(_e.set(0, Math.atan2(nx, nz), rnd(-0.15, 0.15)))
    _m.compose(_p.set(x, y, z), _q, _s.set(size * rnd(0.8, 1.2), size * rnd(0.85, 1.3), 1))
    wall.add(_m, SHADES[(Math.random() * SHADES.length) | 0])
  }

  // um jorro de gotas: (dx, dz) = direção do golpe (o sangue sai pelas costas do zumbi), n = quantidade
  function spray(x, y, z, dx, dz, n, power, lv = 0, fy = 0) {
    const l = Math.hypot(dx, dz)
    const ux = l > 1e-4 ? dx / l : 0, uz = l > 1e-4 ? dz / l : 0
    for (let i = 0; i < n && drops.length < MAX_DROPS; i++) {
      const back = l > 1e-4 && Math.random() < 0.25 ? -0.5 : 1 // alguns respingam de volta para quem bateu
      const sp = power * rnd(0.4, 1.2), a = Math.random() * Math.PI * 2, j = l > 1e-4 ? 0.45 : 1
      drops.push({
        x, y, z, lv, fy,
        vx: ux * sp * back + Math.cos(a) * sp * j, vz: uz * sp * back + Math.sin(a) * sp * j, vy: rnd(0.5, 3.5),
        r: rnd(0.025, 0.06), mark: Math.random() < 0.28,
      })
    }
  }
  function updateDrops(dt) {
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i], px = d.x, pz = d.z
      d.vy -= G * dt
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt
      const fl = floorAt(d.x, d.z, d.lv, d.fy)
      const c = WallAt(d.x, d.z, d.lv)
      if (c && (c.h === undefined || d.y - fl < c.h)) {
        if (d.mark) wallSplat(c, d.x, d.y, d.z, px, pz, rnd(0.08, 0.2), fl)
        drops.splice(i, 1)
      } else if (d.y <= fl) {
        if (d.mark) splat(d.x, d.z, fl, d.r * rnd(2.5, 5), d.lv)
        drops.splice(i, 1)
      }
    }
    dropMesh.count = drops.length
    drops.forEach((d, i) => {
      _m.makeScale(d.r, d.r * (1 + Math.min(2, Math.abs(d.vy) * 0.15)), d.r)
      _m.setPosition(d.x, d.y, d.z)
      dropMesh.setMatrixAt(i, _m)
    })
    dropMesh.instanceMatrix.needsUpdate = true
  }

  // poça que cresce devagar (sob o corpo, sob um pedaço que parou)
  function puddle(x, z, lv, fy, size, delay = 0, time = 4) {
    grows.push({ x, z, lv, fy, size, delay, time, t: 0, i: -1, rot: Math.random() * Math.PI * 2, sx: rnd(0.85, 1.2), sz: rnd(0.85, 1.2) })
  }
  function updateGrows(dt) {
    for (let k = grows.length - 1; k >= 0; k--) {
      const g = grows[k]
      if ((g.delay -= dt) > 0) continue
      const y = floorAt(g.x, g.z, g.lv, g.fy)
      if (g.i < 0) {
        if (!g.lv && WaterDepth(g.x, g.z) > 0.05) { grows.splice(k, 1); continue }
        g.y = y
        g.i = ground.add(_m.makeScale(0.001, 1, 0.001), SHADES[(Math.random() * 2) | 0])
      }
      g.t += dt
      const s = g.size * (1 - (1 - Math.min(1, g.t / g.time)) ** 2)
      _q.setFromAxisAngle(_up, g.rot)
      ground.set(g.i, _m.compose(_p.set(g.x, g.y + 0.03, g.z), _q, _s.set(s * g.sx, 1, s * g.sz)))
      if (g.t >= g.time) grows.splice(k, 1)
    }
  }

  // ---- pedaços arrancados: mesh = a parte do zumbi (escondida lá); a cópia voa solta pelo mapa ----
  function gib(mesh, vx, vz, lv, fy, kind) {
    mesh.updateWorldMatrix(true, false)
    const g = mesh.geometry
    g.computeBoundingBox()
    const ctr = g.boundingBox.getCenter(new THREE.Vector3())
    const piece = new THREE.Mesh(g, mesh.material)
    piece.position.copy(ctr).negate()
    const pivot = new THREE.Group()
    pivot.add(piece)
    // centro da peça no mundo; a rotação/escala vêm do osso que a segurava
    mesh.matrixWorld.decompose(_p, _q, _s)
    pivot.quaternion.copy(_q); pivot.scale.copy(_s)
    pivot.position.copy(ctr).applyMatrix4(mesh.matrixWorld)
    scene.add(pivot)
    const head = kind === 'head'
    const sp = Math.hypot(vx, vz)
    const o = {
      pivot, lv, fy, t: 0, rest: false, head,
      vx: vx * 0.6 + rnd(-1.5, 1.5), vz: vz * 0.6 + rnd(-1.5, 1.5), vy: rnd(3, 5.5) + sp * 0.1,
      wx: rnd(-12, 12), wy: rnd(-6, 6), wz: rnd(-12, 12), rad: head ? 0.17 : 0.07, trail: 0,
      lie: head ? null : new THREE.Quaternion().setFromEuler(_e.set(0, Math.random() * Math.PI * 2, Math.PI / 2)),
    }
    gibs.push(o)
    if (gibs.length > MAX_GIBS) { const old = gibs.shift(); scene.remove(old.pivot) }
    return o
  }
  function updateGibs(dt) {
    for (let i = gibs.length - 1; i >= 0; i--) {
      const o = gibs[i], P = o.pivot
      o.t += dt
      const fl = floorAt(P.position.x, P.position.z, o.lv, o.fy)
      if (!o.rest) {
        o.vy -= G * dt
        const nx = P.position.x + o.vx * dt, nz = P.position.z + o.vz * dt
        const c = WallAt(nx, nz, o.lv)
        if (c && (c.h === undefined || P.position.y - fl < c.h)) {
          // bateu na parede: volta e deixa a marca
          wallSplat(c, nx, P.position.y, nz, P.position.x, P.position.z, rnd(0.25, 0.4), fl)
          const inX = P.position.x >= c.x - c.hw && P.position.x <= c.x + c.hw
          if (inX) o.vz *= -0.35; else o.vx *= -0.35
        } else { P.position.x = nx; P.position.z = nz }
        P.position.y += o.vy * dt
        _e.set(o.wx * dt, o.wy * dt, o.wz * dt); _q.setFromEuler(_e); P.quaternion.multiply(_q)
        if ((o.trail -= dt) <= 0) { o.trail = 0.09; spray(P.position.x, P.position.y, P.position.z, 0, 0, 1, 0.6, o.lv, o.fy) }
        if (P.position.y <= fl + o.rad) {
          P.position.y = fl + o.rad
          if (o.vy < -1.5) { splat(P.position.x, P.position.z, fl, rnd(0.18, 0.3), o.lv); o.vy *= -0.3; o.wx *= 0.5; o.wz *= 0.5 } else o.vy = 0
          o.vx *= 0.75; o.vz *= 0.75
          if (Math.hypot(o.vx, o.vz) < 0.4 && Math.abs(o.vy) < 0.5) { o.rest = true; puddle(P.position.x, P.position.z, o.lv, o.fy, rnd(0.3, 0.5), 0, 3) }
        }
      } else {
        if (o.lie) P.quaternion.slerp(o.lie, 1 - Math.exp(-8 * dt))
        P.position.y = fl + o.rad - Math.max(0, o.t - (GIB_T - 1.5)) * 0.3 // afunda antes de sumir
      }
      if (o.t >= GIB_T) { scene.remove(P); gibs.splice(i, 1) }
    }
  }

  // ---- jato do toco: obj = grupo do osso; dir = para onde o toco aponta (no espaço do osso); e = zumbi (andar) ----
  function jet(obj, dir, time, e) { jets.push({ obj, dir: dir.clone(), t: time, time, e, acc: 0 }) }
  function updateJets(dt) {
    for (let i = jets.length - 1; i >= 0; i--) {
      const j = jets[i]
      j.t -= dt
      if (j.t <= 0 || !j.obj.parent) { jets.splice(i, 1); continue }
      const k = j.t / j.time, pulse = 0.6 + 0.4 * Math.max(0, Math.sin(j.t * 14)) // pulsa com o "coração"
      j.acc += dt * 40 * k * pulse
      if (j.acc < 1) continue
      const n = j.acc | 0
      j.acc -= n
      j.obj.updateWorldMatrix(true, false)
      j.obj.getWorldPosition(_p)
      _d.copy(j.dir).transformDirection(j.obj.matrixWorld)
      for (let m = 0; m < n && drops.length < MAX_DROPS; m++) {
        const sp = rnd(1.5, 3.5) * (0.4 + k)
        drops.push({
          x: _p.x, y: _p.y, z: _p.z, lv: j.e.lv || 0, fy: j.e.fy,
          vx: _d.x * sp + rnd(-0.5, 0.5), vy: _d.y * sp + rnd(0, 1), vz: _d.z * sp + rnd(-0.5, 0.5),
          r: rnd(0.025, 0.05), mark: Math.random() < 0.22,
        })
      }
    }
  }

  return {
    spray, splat, puddle, gib, jet,
    update(dt) { updateDrops(dt); updateGrows(dt); updateGibs(dt); updateJets(dt) },
    clear() {
      drops.length = grows.length = jets.length = 0
      for (const o of gibs) scene.remove(o.pivot)
      gibs.length = 0
      ground.clear(); wall.clear(); dropMesh.count = 0
    },
  }
}
