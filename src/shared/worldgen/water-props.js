import * as THREE from 'three'
import { P, merge, box, cyl, sph, wind } from '../../engine/render/style'
import { WATER_Y } from './water'
import { DECK_Y, BridgeY, STONE_Y } from './water-life'

// Malhas das estruturas e da vida na água. Píer/ponte/pedras viram UMA geometria fundida por chunk;
// barcos boiam e peixes/patos nadam inteiramente na GPU (shader), sem custo de CPU por frame.

const WOOD = 0xb67a40, WOOD2 = 0xc98d4f, WOOD_D = 0x7d4f2a, CAP = 0xe6bd7c
const rotY = (g, th, x, y, z) => g.rotateY(th).translate(x, y, z)

// ---------- píer ----------
function pierGeo(p) {
  const parts = [], L = p.L
  for (let z = 0.15, k = 0; z < L; z += 0.34, k++) parts.push(box(1.55, 0.08, 0.3, k % 3 === 1 ? WOOD : WOOD2, [0, DECK_Y - 0.04, z], { lit: 0.15 }))
  for (const x of [-0.62, 0.62]) parts.push(box(0.14, 0.16, L, WOOD_D, [x, DECK_Y - 0.16, L / 2]))
  for (const z of [0.4, L / 2, L - 0.2]) for (const x of [-0.74, 0.74]) {
    parts.push(P(cyl(0.09, 0.1, 2.1, 7), WOOD_D, { p: [x, DECK_Y + 0.25 - 1.05, z], grad: [0.5, 1.05] }))
    parts.push(P(cyl(0.085, 0.085, 0.02, 7), CAP, { p: [x, DECK_Y + 0.26, z] }))
  }
  // lampião na ponta
  parts.push(box(0.1, 1.1, 0.1, WOOD_D, [0.62, DECK_Y + 0.55, L - 0.3]), box(0.24, 0.26, 0.24, 0xfff0a8, [0.62, DECK_Y + 1.2, L - 0.3], { lit: 0.3 }), box(0.32, 0.06, 0.32, 0x3b4254, [0.62, DECK_Y + 1.36, L - 0.3]))
  return rotY(merge(parts), p.th, p.x, 0, p.z)
}

// ---------- ponte de madeira em arco (atravessa no sentido z) ----------
function bridgeGeo(b) {
  const parts = [], H = b.H, step = 0.3
  for (let t = -H; t < H; t += step) {
    const tm = t + step / 2, y = BridgeY(b, tm), slope = (BridgeY(b, t + step) - BridgeY(b, t)) / step
    parts.push(box(1.5, 0.08, step * 0.9, Math.round((t + H) / step) % 3 ? WOOD2 : WOOD, [0, 0, 0], { lit: 0.15 }).rotateX(-Math.atan(slope)).translate(0, y - 0.04, tm))
    for (const x of [-0.66, 0.66]) parts.push(box(0.14, 0.18, step, WOOD_D, [0, 0, 0]).rotateX(-Math.atan(slope)).translate(x, y - 0.17, tm))
  }
  // corrimão: postes a cada ~1,2 m e trilho que segue o arco (vermelho, como as pontes da referência)
  const n = Math.max(2, Math.round((2 * H) / 1.2)), RED = 0xc4523a
  for (let k = 0; k <= n; k++) {
    const t = -H + (2 * H * k) / n, y = BridgeY(b, t)
    for (const x of [-0.7, 0.7]) parts.push(box(0.1, 0.85, 0.1, RED, [x, y + 0.4, t], { grad: [0.8, 1.05] }), box(0.13, 0.04, 0.13, 0xf0d8a8, [x, y + 0.85, t]))
    if (k < n) {
      const t2 = -H + (2 * H * (k + 1)) / n, y2 = BridgeY(b, t2), len = Math.hypot(t2 - t, y2 - y)
      for (const x of [-0.7, 0.7]) parts.push(box(0.07, 0.07, len, RED, [0, 0, 0]).rotateX(-Math.atan2(y2 - y, t2 - t)).translate(x, (y + y2) / 2 + 0.78, (t + t2) / 2))
    }
  }
  for (const e of [-1, 1]) for (const x of [-0.6, 0.6]) parts.push(P(cyl(0.1, 0.12, 1.4, 7), WOOD_D, { p: [x, BridgeY(b, e * (H - 0.6)) - 0.7, e * (H - 0.6)] }))
  return merge(parts).translate(b.x, 0, b.z)
}

// ---------- pedras de travessia ----------
function stoneGeo(s) {
  return P(new THREE.CylinderGeometry(s.r, s.r * 1.15, 1.2, 9), 0xbfc3cf, {
    p: [s.x, STONE_Y - 0.6, s.z], grad: [0.5, 1.08], fn: (c, nx, ny) => { if (ny > 0.8) c.multiplyScalar(1.12) },
  })
}

export function BuildWaterStructs(g, list, dispose, MAT) {
  const parts = [...list.piers.map(pierGeo), ...list.bridges.map(bridgeGeo), ...list.stones.map(stoneGeo)]
  if (!parts.length) return
  const geo = merge(parts)
  g.add(new THREE.Mesh(geo, MAT.solid))
  dispose.push(geo)
}

// ---------- material que boia (barcos): sobe/desce e balança — só vertex shader ----------
function bobMat() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
      vec2 bp = instanceMatrix[3].xz;
      float ba = uWind * 1.5 + bp.x * 0.7 + bp.y * 0.4;
      transformed.y += sin(ba) * 0.05 + transformed.x * sin(ba * 0.8 + 1.0) * 0.06 + transformed.z * sin(ba * 0.6) * 0.02;`)
  }
  m.customProgramCacheKey = () => 'bob'
  return m
}
export const BobMat = bobMat()

// ---------- barco a remo (frente em +z) ----------
function hull() {
  const g = new THREE.BoxGeometry(1.15, 0.42, 2.5, 2, 3, 6), pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), e = Math.max(0, (Math.abs(z) - 0.55) / 0.7)
    const k = (1 - 0.82 * e * e) * (y < 0 ? 0.72 : 1)
    pos.setX(i, x * k)
    if (z > 0.55 && y > 0) pos.setY(i, y + e * 0.12) // proa levantada
  }
  g.computeVertexNormals()
  return g
}
export const BOAT = merge([
  P(hull(), 0xd9583e, { p: [0, 0.21, 0], grad: [0.6, 1.05], fn: (c, nx, ny, nz, lx, ly) => { if (ly > 0.13) c.setHex(0xf2e6c8) } }),
  box(0.86, 0.02, 1.7, 0x8a5a30, [0, 0.36, 0]),
  box(1.0, 0.06, 0.26, WOOD2, [0, 0.38, 0.35]), box(1.0, 0.06, 0.26, WOOD2, [0, 0.38, -0.5]),
  ...[-1, 1].map((s) => box(0.06, 0.05, 1.9, WOOD_D, [0, 0, 0]).rotateY(s * 0.35).rotateZ(s * 0.25).translate(s * 0.8, 0.42, -0.1)),
  ...[-1, 1].map((s) => box(0.03, 0.18, 0.42, WOOD, [0, 0, 0]).rotateY(s * 0.35).translate(s * 1.12, 0.3, -0.42)),
])
export const BOAT_TINTS = [new THREE.Color(1, 1, 1), new THREE.Color(0.55, 0.85, 1.5), new THREE.Color(0.75, 1.35, 0.7)]

// ---------- nado na GPU: cada instância gira num círculo; raio/fase/velocidade vêm na cor da instância ----------
// instanceColor = (raio/4, fase/2π, velocidade 0..1 com sinal pela fase); a cor real do bicho vem dos vértices
function swimMat(base, { jump = false, wiggle = true, key }) {
  base.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <color_vertex>', '#if defined(USE_COLOR) || defined(USE_INSTANCING_COLOR)\nvColor = vec4(1.0);\n#endif\n#ifdef USE_COLOR\nvColor.rgb *= color;\n#endif')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 sw = instanceColor;
        float R = sw.x * 4.0, ph = sw.y * 6.2832, sp = (sw.z - 0.5) * 2.4;
        float a = uWind * sp + ph;
        ${wiggle ? 'transformed.x += sin(uWind * 9.0 + ph * 5.0) * 0.07 * max(0.0, -transformed.z) / 0.4;' : ''}
        float hd = sp >= 0.0 ? 1.0 : -1.0;
        vec2 tg = vec2(-sin(a), cos(a)) * hd;
        float h = atan(tg.x, tg.y);
        float c = cos(h), s = sin(h);
        transformed = vec3(transformed.x * c + transformed.z * s, transformed.y, -transformed.x * s + transformed.z * c);
        transformed.xz += vec2(cos(a), sin(a)) * R;
        ${jump ? 'float jp = max(0.0, sin(uWind * 0.37 + ph * 7.0) - 0.97) / 0.03; transformed.y += jp * 0.9;' : 'transformed.y += sin(uWind * 2.0 + ph * 3.0) * 0.02;'}`)
  }
  base.customProgramCacheKey = () => key
  return base
}
export const FishMat = swimMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { jump: true, key: 'fish' })
export const FishShadowMat = swimMat(new THREE.MeshBasicMaterial({ color: 0x0b3d6b, transparent: true, opacity: 0.42, depthWrite: false }), { key: 'fishsh' })
export const DuckMat = swimMat(new THREE.MeshLambertMaterial({ vertexColors: true }), { wiggle: false, key: 'duck' })

// peixe (frente em +z): corpo laranja/branco, nadadeiras
const tri = (pts) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.computeVertexNormals(); return g }
export const FISH = merge([
  P(sph(1, 8, 6), 0xff8a2a, { s: [0.11, 0.12, 0.3], tip: 0xffe2b0, lit: 0.2 }),
  P(tri([0, 0, -0.25, 0, 0.14, -0.45, 0, -0.14, -0.45, 0, 0, -0.25, 0, -0.14, -0.45, 0, 0.14, -0.45]), 0xffb04a, {}),
  P(tri([0, 0.1, 0.05, 0, 0.22, -0.1, 0, 0.1, -0.15, 0, 0.1, 0.05, 0, 0.1, -0.15, 0, 0.22, -0.1]), 0xff7020, {}),
  P(sph(0.025, 4, 3), 0x111111, { p: [0.08, 0.04, 0.2] }), P(sph(0.025, 4, 3), 0x111111, { p: [-0.08, 0.04, 0.2] }),
])
export const FISH_SHADOW = merge([
  P(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), 0xffffff, { s: [0.13, 1, 0.33] }),
  P(tri([0, 0, -0.26, 0.15, 0, -0.48, -0.15, 0, -0.48]), 0xffffff, {}),
])
export const DUCK = merge([
  P(sph(1, 8, 6), 0xffffff, { s: [0.2, 0.15, 0.3], p: [0, 0.06, 0], grad: [0.8, 1.05], lit: 0.2 }),
  P(sph(0.11, 7, 5), 0xffffff, { p: [0, 0.27, 0.2], lit: 0.2 }),
  P(new THREE.ConeGeometry(0.05, 0.13, 5).rotateX(Math.PI / 2), 0xffa21f, { p: [0, 0.25, 0.34] }),
  P(sph(0.02, 4, 3), 0x111111, { p: [0.08, 0.3, 0.27] }), P(sph(0.02, 4, 3), 0x111111, { p: [-0.08, 0.3, 0.27] }),
  P(new THREE.ConeGeometry(0.08, 0.14, 4).rotateX(-Math.PI / 2 - 0.5), 0xf0f0f0, { p: [0, 0.14, -0.3] }),
])

export { WATER_Y }
