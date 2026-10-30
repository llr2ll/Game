import * as THREE from 'three'
import { WATER_Y } from '../worldgen/water'
import { WaterDepth } from '../worldgen/sidewalk'
import { events } from '../../engine/core/events'

// Interação com a água: anéis de onda (quem anda/nada na água, tiros que caem nela) e respingos (entrar na água, pular,
// cair). Pools fixos com InstancedMesh: 2 draw calls no total, matrizes atualizadas só para o que está vivo.
function ringTexture() {
  if (typeof document === 'undefined') return null
  try {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const x = c.getContext('2d')
    if (!x) return null
    const g = x.createRadialGradient(32, 32, 18, 32, 32, 31)
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,1)'); g.addColorStop(0.8, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g; x.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  } catch { return null }
}

const MAX_R = 64, MAX_D = 160
export function CreateWaterFX(scene) {
  const tex = ringTexture()
  // aditivo: a cor da instância (branco × alfa) faz o anel sumir aos poucos
  const ringMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  const rings = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ringMat, MAX_R)
  const drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: 0xe8fbff }), MAX_D)
  for (const m of [rings, drops]) { m.count = 0; m.frustumCulled = false; m.renderOrder = 3; scene.add(m) }
  rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_R * 3), 3)
  const R = [], D = []
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color()

  function ring(x, z, size = 1, life = 1.1) { if (R.length < MAX_R) R.push({ x, z, t: 0, life, size }) }
  function splash(x, z, n = 10, power = 1) {
    events.emit('splash', { x, z, power }) // o jogo toca o respingo
    ring(x, z, 1.4 * power, 0.9)
    for (let i = 0; i < n && D.length < MAX_D; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.8 + Math.random() * 1.6) * power
      D.push({ x, y: WATER_Y + 0.05, z, vx: Math.cos(a) * sp, vy: (3 + Math.random() * 2.5) * power, vz: Math.sin(a) * sp, s: 0.6 + Math.random() * 0.8 })
    }
  }

  // entidades: { x, z, speed, jy?, key } — cada uma deixa anéis enquanto anda pela água e espirra ao entrar
  const state = new WeakMap()
  function track(o, moving, airborne, dt) {
    const d = WaterDepth(o.x, o.z), st = state.get(o) || { inW: false, t: 0, air: false }
    const inW = d > 0.05 && !airborne
    if (inW && (!st.inW || st.air)) splash(o.x, o.z, st.air ? 14 : 8, st.air ? 1.1 : 0.7) // entrou ou caiu de um pulo
    if (inW) {
      st.t -= dt
      if (st.t <= 0) { ring(o.x, o.z, moving ? 1 + Math.min(d, 1) : 0.8, moving ? 1.0 : 1.6); st.t = moving ? 0.22 : 0.8 }
      if (moving && Math.random() < 0.15 && D.length < MAX_D) D.push({ x: o.x, y: WATER_Y + 0.05, z: o.z, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5, s: 0.5 })
    }
    st.inW = inW; st.air = airborne
    state.set(o, st)
  }

  function update(dt, players, enemies) {
    for (const p of players) if (!p.dead) track(p, p.speed > 0.5, p.jy > 0.05, dt)
    for (const e of enemies) if (!(e.dying > 0)) track(e, e.moving, false, dt)
    // anéis: crescem e somem
    let n = 0
    for (let i = R.length - 1; i >= 0; i--) { const r = R[i]; if ((r.t += dt) >= r.life) R.splice(i, 1) }
    for (const r of R) {
      const k = r.t / r.life, sz = r.size * (0.4 + k * 1.6)
      m4.compose(v.set(r.x, WATER_Y + 0.015, r.z), q.identity(), s.set(sz, 1, sz))
      rings.setMatrixAt(n, m4)
      c.setScalar((1 - k) * 0.85); rings.setColorAt(n, c)
      n++
    }
    rings.count = n
    if (n) { rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true }
    // gotas: balística simples; ao voltar para a água viram um anelzinho
    n = 0
    for (let i = D.length - 1; i >= 0; i--) {
      const d = D[i]
      d.vy -= 16 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt
      if (d.y < WATER_Y) { if (Math.random() < 0.3) ring(d.x, d.z, 0.35, 0.5); D.splice(i, 1) }
    }
    for (const d of D) { m4.compose(v.set(d.x, d.y, d.z), q.identity(), s.setScalar(d.s)); drops.setMatrixAt(n++, m4) }
    drops.count = n
    if (n) drops.instanceMatrix.needsUpdate = true
  }
  return { update, splash, ring }
}
