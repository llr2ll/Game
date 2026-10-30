import * as THREE from 'three'
import { P, merge, box, cyl, cone, sph, ico } from './style'

// Iluminação pública (geometrias fundidas, compartilhadas por todos os chunks). Cada modelo tem DUAS geometrias:
// body (ferro, latão, pedra; MAT.solid) e glass (o vidro branco por vértice; o material de world/streetlights.js
// acende à noite). head = de onde sai a luz (espaço local; +z = para a rua), beam = raio do cone no chão.
const IRON = 0x2f6157, IRON_D = 0x1f4039, BRASS = 0xe8b34a, STONE = 0xb9bcc8, STONE2 = 0xa3a7b6, GLASS = 0xffffff

// caneluras: faces alternadas mais escuras (o poste parece frisado sem custar um triângulo a mais)
const fluted = (n, k = 0.8) => (c, cx, cy, cz) => { if (Math.floor((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2 / n)) & 1) c.multiplyScalar(k) }
const ring = (r, h, y, color = BRASS) => P(cyl(r, r, h, 10), color, { p: [0, y, 0], lit: 0.25 })

// vareta de A até B e curvas feitas de varetas com juntas redondas (braços, arabescos, escoras)
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _one = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0)
function rod(A, B, r, color) {
  _a.fromArray(A); _b.fromArray(B)
  const g = P(cyl(r, r, _a.distanceTo(_b), 6).rotateX(Math.PI / 2), color)
  _q.setFromRotationMatrix(_m.lookAt(_a, _b, _up))
  return g.applyMatrix4(_m.compose(_a.clone().add(_b).multiplyScalar(0.5), _q, _one))
}
function bend(pts, r, color) {
  const out = []
  for (let i = 1; i < pts.length; i++) out.push(rod(pts[i - 1], pts[i], r, color))
  for (let i = 1; i < pts.length - 1; i++) out.push(P(sph(r, 6, 4), color, { p: pts[i] }))
  return out
}

// ---- poste de rua da cidade: base de sino, fuste frisado com anéis de latão, braço "pescoço de cisne" sobre a rua
//      com arabesco e escora, luminária pendurada (chapéu, aro, vidro, gota). flowers = vaso de flores pendurado atrás ----
function streetLamp(flowers) {
  const H = 4.4, R = 1.45 // topo do poste, alcance do braço
  const p = [
    P(cyl(0.24, 0.28, 0.2, 8), IRON_D, { p: [0, 0.1, 0], grad: [0.75, 1.05] }),
    P(cyl(0.14, 0.22, 0.55, 8), IRON, { p: [0, 0.47, 0], grad: [0.7, 1.05], tri: fluted(8, 0.85) }),
    ring(0.16, 0.06, 0.77),
    P(cyl(0.075, 0.105, H - 0.8, 10), IRON, { p: [0, 0.8 + (H - 0.8) / 2, 0], grad: [0.72, 1.08], tri: fluted(10, 0.8) }),
    ring(0.12, 0.07, 2.0), ring(0.11, 0.06, H - 0.4),
    P(sph(0.1, 8, 6), IRON, { p: [0, H, 0], lit: 0.2 }),
    P(cone(0.045, 0.24, 6), BRASS, { p: [0, H + 0.2, 0], lit: 0.2 }),
    box(0.13, 0.17, 0.02, 0xf2ead0, [0, 1.6, 0.1]), // plaquinha com o número do poste
    box(0.07, 0.03, 0.022, 0x2a3a5a, [0, 1.62, 0.106]),
  ]
  const neck = []
  for (let k = 0; k <= 8; k++) { const s = k / 8; neck.push([0, H - 0.45 + 0.42 * Math.sin(Math.PI * s * 0.8), 0.06 + (R - 0.06) * s]) }
  p.push(...bend(neck, 0.05, IRON))
  p.push(rod([0, H - 1.05, 0.08], [0, H - 0.06, 0.8], 0.03, IRON)) // escora
  p.push(P(new THREE.TorusGeometry(0.15, 0.025, 5, 14).rotateY(Math.PI / 2), IRON, { p: [0, H - 0.42, 0.4] })) // arabesco
  p.push(P(sph(0.065, 8, 6), BRASS, { p: [0, H - 0.45, 0.07], lit: 0.2 }))
  const endY = neck[8][1], hy = endY - 0.42 // centro da luminária
  p.push(rod([0, endY, R], [0, endY - 0.13, R], 0.03, IRON))
  p.push(P(cone(0.34, 0.2, 10), IRON, { p: [0, hy + 0.2, R], grad: [0.8, 1.1] })) // chapéu
  p.push(P(cyl(0.35, 0.35, 0.04, 10), BRASS, { p: [0, hy + 0.1, R], lit: 0.2 }))
  p.push(P(sph(0.05, 6, 4), BRASS, { p: [0, hy + 0.32, R] }))
  p.push(P(cyl(0.11, 0.06, 0.07, 8), BRASS, { p: [0, hy - 0.185, R] }), P(sph(0.035, 6, 4), BRASS, { p: [0, hy - 0.24, R] }))
  if (flowers) {
    // suporte para trás (longe da rua), correntinhas e vaso de vime com folhagem caindo e flores
    const bz = -0.44, by = 2.95
    p.push(rod([0, by, -0.06], [0, by, bz], 0.025, IRON), P(sph(0.035, 6, 4), BRASS, { p: [0, by, bz] }))
    for (let k = 0; k < 3; k++) { const a = k * 2.09; p.push(rod([0, by, bz], [Math.cos(a) * 0.2, by - 0.38, bz + Math.sin(a) * 0.2], 0.008, 0x55606a)) }
    p.push(P(new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xb07a3c, { p: [0, by - 0.38, bz], grad: [0.7, 1.05], tri: fluted(10, 0.85) }))
    p.push(P(ico(0.24, 1), 0x2f9a45, { p: [0, by - 0.36, bz], s: [1.05, 0.55, 1.05], tip: 0x7ee27a, lit: 0.2 }))
    for (let k = 0; k < 5; k++) { const a = k * 1.26 + 0.3; p.push(P(ico(0.08, 0), 0x2f9a45, { p: [Math.cos(a) * 0.2, by - 0.62 - (k % 2) * 0.1, bz + Math.sin(a) * 0.2], s: [0.8, 1.6, 0.8], tip: 0x5fc860 })) }
    const FL = [0xff5f9e, 0xffffff, 0xffd23a, 0xff5f9e, 0xb48cff, 0xffffff, 0xff7a4a]
    FL.forEach((c, k) => { const a = k * 0.9, r = 0.1 + (k % 3) * 0.05; p.push(P(sph(0.05, 6, 4), c, { p: [Math.cos(a) * r, by - 0.25 + (k % 2) * 0.03, bz + Math.sin(a) * r], lit: 0.3 })) })
  }
  return {
    body: merge(p),
    glass: merge([P(cyl(0.21, 0.12, 0.26, 10), GLASS, { p: [0, hy - 0.02, R], grad: [1.0, 0.82] })]),
    head: [0, hy - 0.12, R], beam: 3.2, halo: 1.25, spot: true,
  }
}
export const STREET_LAMP = streetLamp(false)
export const STREET_LAMP_FLOWERS = streetLamp(true)

// ---- lanterna de vila / praça: pedestal de pedra, fuste curto, 4 arabescos segurando uma lanterna de 4 vidros com telhadinho ----
export const LANTERN = (() => {
  const p = [
    box(0.56, 0.3, 0.56, STONE2, [0, 0.15, 0], { grad: [0.8, 1.05] }),
    box(0.44, 0.12, 0.44, STONE, [0, 0.36, 0], { grad: [0.85, 1.05] }),
    P(cyl(0.13, 0.16, 0.22, 8), IRON_D, { p: [0, 0.53, 0], grad: [0.8, 1.05] }),
    ring(0.11, 0.06, 0.66),
    P(cyl(0.065, 0.09, 2.0, 10), IRON, { p: [0, 1.66, 0], grad: [0.72, 1.08], tri: fluted(10, 0.8) }),
    ring(0.1, 0.06, 1.9),
    P(cyl(0.2, 0.08, 0.12, 8), IRON, { p: [0, 2.68, 0], grad: [0.8, 1.05] }),
    box(0.36, 0.05, 0.36, BRASS, [0, 2.76, 0], { lit: 0.2 }),
  ]
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, cx = Math.cos(a), cz = Math.sin(a)
    p.push(...bend([[cx * 0.06, 2.3, cz * 0.06], [cx * 0.17, 2.42, cz * 0.17], [cx * 0.21, 2.58, cz * 0.21], [cx * 0.16, 2.7, cz * 0.16]], 0.022, IRON))
  }
  // montantes nos cantos acompanham o vidro (mais largo em cima)
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) p.push(rod([sx * 0.108, 2.77, sz * 0.108], [sx * 0.143, 3.2, sz * 0.143], 0.02, IRON))
  p.push(box(0.36, 0.04, 0.36, BRASS, [0, 3.22, 0], { lit: 0.2 }))
  p.push(P(cone(0.3, 0.26, 4).rotateY(Math.PI / 4), IRON, { p: [0, 3.37, 0], grad: [0.8, 1.1] }))
  p.push(P(sph(0.05, 6, 4), BRASS, { p: [0, 3.52, 0] }), P(cone(0.03, 0.14, 6), BRASS, { p: [0, 3.62, 0] }))
  return {
    body: merge(p),
    glass: merge([P(cyl(0.2, 0.15, 0.44, 4).rotateY(Math.PI / 4), GLASS, { p: [0, 2.98, 0], grad: [1.0, 0.82] })]),
    head: [0, 2.85, 0], beam: 2.5, halo: 1.0, spot: true,
  }
})()

// ---- luminária baixa de jardim: globo de vidro num pé fino ----
export const GARDEN_LAMP = {
  body: merge([
    P(cyl(0.12, 0.15, 0.1, 8), IRON_D, { p: [0, 0.05, 0] }),
    P(cyl(0.04, 0.055, 1.05, 8), IRON, { p: [0, 0.62, 0], grad: [0.72, 1.08], tri: fluted(8, 0.82) }),
    ring(0.065, 0.04, 0.3), ring(0.06, 0.04, 1.1),
    P(cyl(0.1, 0.05, 0.08, 8), BRASS, { p: [0, 1.18, 0], lit: 0.2 }),
    P(cone(0.11, 0.08, 8), IRON, { p: [0, 1.5, 0] }),
    P(sph(0.03, 6, 4), BRASS, { p: [0, 1.56, 0] }),
  ]),
  glass: merge([P(sph(0.15, 10, 8), GLASS, { p: [0, 1.33, 0], grad: [1.0, 0.85] })]),
  head: [0, 1.3, 0], beam: 1.2, halo: 0.6, spot: false,
}
