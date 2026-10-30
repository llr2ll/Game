import * as THREE from 'three'
import { P, merge, ico, sph, cyl, cone, bx, box, prism } from './style'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

// Geometrias da natureza (criadas uma vez só e compartilhadas por todos os chunks).
// Formas redondas e suaves, cores saturadas e gradiente "luz no topo / sombra embaixo" assado nos vértices.

const MOSS = new THREE.Color(0x7fd23c)

// ===== estilo Link's Awakening: copas feitas de "camadas" com borda recortada em lóbulos (escamas de folhas),
// verde escuro nas dobras e claro/brilhante na ponta de cada lóbulo; capim de lâminas largas e dobradas =====

// uma camada da copa: casca torneada cuja borda de baixo vira lóbulos; cores escuras no vão e claras na ponta
function tier(r, h, lobes, dark, light, seed = 0) {
  const prof = [[0.0, 1.0], [0.42, 0.93], [0.74, 0.74], [0.93, 0.46], [1.0, 0.2], [0.86, 0.02], [0.45, -0.06]]
  const seg = lobes * 2, ring = prof.length, pos = []
  const P3 = (k, u) => {
    const a = (u / seg) * Math.PI * 2 + seed, lob = Math.cos(lobes * (a - seed)), rim = Math.max(0, (k - 2) / 3)
    const [pr, py] = prof[k], rr = r * pr * (1 + 0.16 * lob * rim), yy = h * py - h * 0.14 * rim * Math.max(0, lob)
    return [Math.cos(a) * rr, yy, Math.sin(a) * rr]
  }
  for (let k = 0; k < ring - 1; k++) for (let u = 0; u < seg; u++) {
    const a = P3(k, u), b = P3(k, u + 1), c = P3(k + 1, u + 1), d = P3(k + 1, u)
    if (k === 0) pos.push(...a, ...c, ...d) // topo: um triângulo só (o ponto do topo é único)
    else pos.push(...a, ...b, ...c, ...a, ...c, ...d)
  }
  let geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo = mergeVertices(geo, 1e-4)
  geo.computeVertexNormals()
  const D = new THREE.Color(dark), L = new THREE.Color(light)
  return P(geo, dark, {
    fn: (c, nx, ny, nz, lx, ly, lz) => {
      const a = Math.atan2(lz, lx) - seed, lob = Math.cos(lobes * a) * 0.5 + 0.5, t = ly / h
      const k = Math.min(1, Math.max(0, 0.15 + 0.55 * lob * Math.min(1, Math.max(0, (0.9 - t) * 1.6)) + 0.45 * Math.max(0, ny) * t))
      c.copy(D).lerp(L, k)
      if (ny < -0.2) c.multiplyScalar(0.55) // por baixo da camada: sombra funda
    },
  })
}

// ---- árvore redonda (a "bola de escamas" do jogo de referência) ----
export const OAK = merge([
  P(cyl(0.17, 0.26, 1.5, 6), 0x8a5530, { p: [0, 0.75, 0], grad: [0.55, 1.05] }),
  tier(1.25, 0.95, 7, 0x17703a, 0x52c45a, 0.0).translate(0, 1.15, 0),
  tier(1.55, 1.0, 8, 0x1a7a3e, 0x5fd063, 0.4).translate(0, 1.7, 0),
  tier(1.35, 0.95, 7, 0x1d8442, 0x6ad86b, 0.9).translate(0, 2.35, 0),
  tier(0.95, 0.85, 6, 0x22904a, 0x7ee27a, 1.3).translate(0, 2.95, 0),
  tier(0.45, 0.55, 5, 0x29984f, 0x92ea86, 0.2).translate(0, 3.5, 0),
])

// ---- pinheiro: camadas em degrau, cada vez menores ----
export const PINE = merge([
  P(cyl(0.14, 0.22, 1.3, 6), 0x7d4c2a, { p: [0, 0.65, 0], grad: [0.55, 1.05] }),
  tier(1.45, 0.9, 8, 0x125f3f, 0x3fae5e, 0.0).translate(0, 1.15, 0),
  tier(1.15, 0.85, 7, 0x146844, 0x48b965, 0.5).translate(0, 1.8, 0),
  tier(0.85, 0.8, 6, 0x177248, 0x55c46d, 1.0).translate(0, 2.4, 0),
  tier(0.5, 0.75, 5, 0x1b7c4d, 0x66cf78, 0.3).translate(0, 2.95, 0),
])

// ---- arbusto: duas camadas baixas ----
export const BUSH = merge([
  tier(0.62, 0.5, 6, 0x1a7a3e, 0x62d067, 0.2).translate(0, 0.0, 0),
  tier(0.42, 0.4, 5, 0x1f8644, 0x77de76, 0.8).translate(0, 0.32, 0),
])

// ---- touceira de capim: lâminas LARGAS e dobradas no meio (vinco claro/escuro), pontas claras ----
function blade(w, h, lean) {
  // base (0,0,0), lados recuados (vinco em V), ponta inclinada para fora (+z)
  const B = [0, 0, 0], L = [-w, h * 0.42, -w * 0.35], R = [w, h * 0.42, -w * 0.35], T = [0, h, lean]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([...B, ...T, ...L, ...B, ...R, ...T, ...B, ...L, ...T, ...B, ...T, ...R], 3))
  g.computeVertexNormals()
  return g
}
function clump() {
  const parts = []
  let seed = 7
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const n = 6
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.283 + rnd() * 0.5, h = 0.55 + rnd() * 0.3, w = 0.11 + rnd() * 0.04
    parts.push(P(blade(w, h, 0.18 + rnd() * 0.12), 0x1c7d2c, {
      p: [Math.sin(a) * 0.06, 0, Math.cos(a) * 0.06], r: [0, a, 0],
      tip: 0xa6ec58, lit: 0.15,
    }))
  }
  parts.push(P(blade(0.12, 0.72, 0.05), 0x1f852f, { r: [0, 0.4, 0], tip: 0xb8f466, lit: 0.15 }))
  return merge(parts)
}
export const CLUMP = clump()

// ---- flor: caule com folhinhas + cabeça de 5 pétalas (a cor vem da instância) ----
const petal = () => new THREE.OctahedronGeometry(0.07, 0)
export const FLOWER_STEM = merge([
  P(cyl(0.012, 0.016, 0.34, 3), 0x3aa22e, { p: [0, 0.17, 0] }),
  P(petal(), 0x4fc23a, { p: [0.07, 0.03, 0.01], s: [1.7, 0.3, 0.8] }),
  P(petal(), 0x4fc23a, { p: [-0.07, 0.03, 0.03], s: [1.7, 0.3, 0.8] }),
])
export const FLOWER_HEAD = merge([
  P(new THREE.OctahedronGeometry(0.045, 0), 0xffcf2e, { p: [0, 0.385, 0], s: [1, 0.8, 1] }),
  ...[0, 1, 2, 3, 4].map((i) => {
    const a = (i / 5) * Math.PI * 2
    return P(petal(), 0xffffff, { p: [Math.cos(a) * 0.085, 0.365, Math.sin(a) * 0.085], r: [0, -a, 0], s: [1.3, 0.35, 0.8] })
  }),
])

export const LEAF = new THREE.PlaneGeometry(0.3, 0.2).rotateX(-Math.PI / 2)

// ---- pedra facetada, com musgo em cima ----
export const ROCK = P(new THREE.DodecahedronGeometry(0.6, 0), 0xaeb2c6, {
  grad: [0.7, 1.08], lit: 0.2,
  fn: (c, nx, ny) => { if (ny > 0.45) c.lerp(MOSS, 0.5) },
})

// ---- troncos, tocos e postes: madeira redonda com a tampa clara e um anel (como na referência) ----
export const LOG = merge([
  P(cyl(0.3, 0.32, 1, 10).rotateZ(Math.PI / 2), 0xa8693a, { grad: [0.7, 1.05], fn: (c, nx) => { if (Math.abs(nx) > 0.9) c.multiplyScalar(1.4) } }),
  P(cyl(0.2, 0.2, 1.012, 10).rotateZ(Math.PI / 2), 0xd9ae6e),
])
export const STUMP = merge([
  P(cyl(0.3, 0.4, 0.6, 10), 0xa8693a, { p: [0, 0.3, 0], grad: [0.65, 1.05] }),
  P(cyl(0.29, 0.29, 0.02, 10), 0xe6bd7c, { p: [0, 0.605, 0] }),
  P(cyl(0.17, 0.17, 0.022, 10), 0xc99250, { p: [0, 0.606, 0] }),
])
export const POST = merge([
  P(cyl(0.15, 0.17, 1.1, 8), 0xa8693a, { p: [0, 0.55, 0], grad: [0.62, 1.05] }),
  P(cyl(0.145, 0.145, 0.02, 8), 0xe6bd7c, { p: [0, 1.105, 0] }),
  P(cyl(0.085, 0.085, 0.022, 8), 0xc99250, { p: [0, 1.106, 0] }),
])
export const RAIL = P(cyl(0.045, 0.045, 2.5, 5).rotateX(Math.PI / 2), 0x9a6234, { grad: [0.8, 1.05] })

// ---- faixa tracejada da estrada (4 traços; o chunk só move o mesh em z) ----
export const DASHES = merge([0, 1, 2, 3].map((i) => P(bx(0.16, 0.02, 2), 0xffd23a, { p: [0, 0.035, 1 + i * 4] })))

// ---- decoração das vilas ----
const STN = 0xb9bcc8, STN2 = 0xa3a7b6
// cruzeiro galego: degraus de pedra + fuste + cruz
export const CRUCEIRO = merge([
  box(1.8, 0.28, 1.8, STN2, [0, 0.14, 0], { grad: [0.8, 1.05] }),
  box(1.35, 0.28, 1.35, STN, [0, 0.42, 0], { grad: [0.8, 1.05] }),
  box(0.9, 0.28, 0.9, STN2, [0, 0.7, 0], { grad: [0.8, 1.05] }),
  P(cyl(0.12, 0.17, 2.3, 6), STN, { p: [0, 1.99, 0], grad: [0.7, 1.05] }),
  box(0.2, 0.9, 0.2, STN, [0, 3.4, 0], { grad: [0.8, 1.05] }),
  box(0.75, 0.2, 0.2, STN, [0, 3.65, 0], { grad: [0.8, 1.05] }),
])
// poço de pedra com telhadinho
export const WELL = merge([
  P(cyl(0.85, 0.9, 0.95, 10), STN, { p: [0, 0.475, 0], grad: [0.75, 1.05], tip: 0xcfd2dc }),
  P(cyl(0.6, 0.6, 0.02, 10), 0x2a4a66, { p: [0, 0.93, 0] }),
  box(0.12, 1.6, 0.12, 0x8a5a2e, [-0.75, 1.55, 0]), box(0.12, 1.6, 0.12, 0x8a5a2e, [0.75, 1.55, 0]),
  box(0.14, 0.14, 1.9, 0x8a5a2e, [0, 2.3, 0]),
  P(prism(1.9, 0.6, 2.0), 0xc0553a, { p: [0, 2.34, 0], lit: 0.1 }),
])
// espigueiro (celeiro elevado galego): corpo de ripas sobre pés de pedra
export const HORREO = merge([
  ...[-1.9, 0, 1.9].flatMap((z) => [-0.45, 0.45].map((x) => P(cyl(0.16, 0.2, 0.9, 6), STN, { p: [x, 0.45, z], grad: [0.7, 1.05] }))),
  ...[-1.9, 0, 1.9].flatMap((z) => [-0.45, 0.45].map((x) => box(0.5, 0.1, 0.5, 0xd4d6df, [x, 0.95, z]))),
  box(1.2, 0.14, 4.7, 0x7a4f2a, [0, 1.07, 0]),
  box(1.15, 1.25, 4.4, 0xb98a52, [0, 1.76, 0], { grad: [0.78, 1.05] }),
  ...[-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8].map((z) => box(1.2, 1.2, 0.07, 0x7a4f2a, [0, 1.76, z])),
  P(prism(1.55, 0.75, 4.9), 0xa6513a, { p: [0, 2.38, 0], r: [0, Math.PI / 2, 0], lit: 0.1 }),
  box(0.14, 0.14, 4.95, 0x7a4f2a, [0, 3.13, 0]),
])

// traço da faixa central (instanciado)
export const DASH = P(bx(0.16, 0.02, 2), 0xffd23a, { p: [0, 0.035, 0] })
