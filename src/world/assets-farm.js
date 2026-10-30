import * as THREE from 'three'
import { P, merge, sph, cyl, cone, box, bx } from './style'

// Plantações (hortas atrás das casas), vida da água (vitórias-régias, juncos) e pontes de pedra.

// folha larga e curva (para repolhos/cenouras): losango achatado inclinado para fora
const leaf = (len, w) => new THREE.OctahedronGeometry(1, 0).scale(w, 0.08, len)

// ---- repolho (o "pé de folhas" das hortas da referência): roseta de folhas abertas + miolo redondo ----
export const CABBAGE = merge([
  ...[0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i / 6) * Math.PI * 2
    return P(leaf(0.3, 0.2), 0x2f9a3a, { p: [Math.sin(a) * 0.2, 0.12, Math.cos(a) * 0.2], r: [-0.55, a, 0], tip: 0x8fe05a, lit: 0.25 })
  }),
  P(sph(0.2, 8, 6), 0x7fd458, { p: [0, 0.2, 0], s: [1, 0.85, 1], tip: 0xc8f58e, lit: 0.25 }),
])
// ---- milho: talo, folhas compridas e uma espiga ----
export const CORN = merge([
  P(cyl(0.035, 0.05, 1.5, 5), 0x5ea836, { p: [0, 0.75, 0], tip: 0x9fd85a }),
  ...[0, 1, 2, 3].map((i) => P(leaf(0.42, 0.07), 0x3f9a34, { p: [Math.sin(i * 2.3) * 0.22, 0.45 + i * 0.28, Math.cos(i * 2.3) * 0.22], r: [-0.7, i * 2.3, 0], tip: 0xa5e05e, lit: 0.2 })),
  P(cyl(0.06, 0.05, 0.3, 6), 0xf3c739, { p: [0.08, 1.05, 0], r: [0, 0, -0.35], lit: 0.2 }),
  P(cone(0.05, 0.2, 4), 0xc8a050, { p: [0, 1.6, 0] }),
])
// ---- cenoura: tufo verde com a "cabeça" laranja aparecendo ----
export const CARROT = merge([
  P(cone(0.08, 0.14, 6).rotateX(Math.PI), 0xf07a22, { p: [0, 0.05, 0], lit: 0.2 }),
  ...[0, 1, 2, 3, 4].map((i) => P(leaf(0.18, 0.06), 0x3aa83e, { p: [Math.sin(i * 1.26) * 0.06, 0.2, Math.cos(i * 1.26) * 0.06], r: [-1.0, i * 1.26, 0], tip: 0x9ce85c })),
])
// ---- leira de terra (fileira) com 1 m de comprimento: fica sob cada planta ----
export const RIDGE = P(bx(0.55, 0.16, 1.02), 0x9a5a2a, { p: [0, 0.03, 0], tip: 0xc07a3a, lit: 0.15 })
// ---- espantalho ----
export const SCARECROW = merge([
  P(cyl(0.06, 0.07, 1.9, 5), 0x8a5a2e, { p: [0, 0.95, 0] }),
  box(1.3, 0.08, 0.08, 0x8a5a2e, [0, 1.35, 0]),
  box(0.55, 0.62, 0.3, 0x3c6fb8, [0, 1.2, 0], { grad: [0.8, 1.05] }),
  ...[-0.6, 0.6].map((x) => box(0.24, 0.16, 0.2, 0x3c6fb8, [x, 1.35, 0])),
  P(sph(0.2, 8, 6), 0xe8cf8a, { p: [0, 1.72, 0], lit: 0.2 }),
  P(cyl(0.38, 0.38, 0.04, 10), 0xd8a54a, { p: [0, 1.85, 0] }),
  P(cone(0.2, 0.28, 8), 0xd8a54a, { p: [0, 1.99, 0], lit: 0.15 }),
])

// ---- vitória-régia (folha com recorte) e flor rosa ----
export const LILY = P(new THREE.CircleGeometry(0.42, 10, 0.35, Math.PI * 2 - 0.7).rotateX(-Math.PI / 2), 0x3fa84a, { tip: 0x6fd25a, lit: 0.3 })
export const LILY_FLOWER = merge([0, 1, 2, 3, 4].map((i) => P(new THREE.OctahedronGeometry(0.08, 0), 0xff9ac8, { p: [Math.sin(i * 1.26) * 0.07, 0.07, Math.cos(i * 1.26) * 0.07], s: [0.7, 1, 1.4], r: [0.5, i * 1.26, 0], tip: 0xffffff })))
// ---- juncos da margem ----
export const REED = merge([
  ...[0, 1, 2, 3, 4].map((i) => P(cone(0.035, 1.0 + (i % 3) * 0.25, 3), 0x3f8f3a, { p: [Math.sin(i * 2.1) * 0.12, 0.5 + (i % 3) * 0.12, Math.cos(i * 2.1) * 0.12], r: [Math.sin(i) * 0.15, 0, Math.cos(i) * 0.15], tip: 0x9ed65a })),
  P(cyl(0.05, 0.05, 0.25, 5), 0x7a4a26, { p: [0.12, 1.05, 0.06] }),
  P(cyl(0.05, 0.05, 0.25, 5), 0x7a4a26, { p: [-0.1, 1.2, -0.08] }),
])

// ---- ponte: muro de pedra (parapeito + cabeceira com arco escuro), comprimento 1 em z (escalado) ----
const STN = 0xb8b2a2, STN_D = 0x958e7e
export const BRIDGE_WALL = merge([
  P(bx(0.42, 0.6, 1), STN, { p: [0, 0.3, 0], grad: [0.85, 1.08], lit: 0.1 }),
  P(bx(0.5, 0.1, 1), 0xd0cabb, { p: [0, 0.65, 0], lit: 0.2 }),
])
// face lateral sobre o rio (sai do nível da estrada até o leito), com a boca escura do túnel
export const BRIDGE_FACE = merge([
  P(bx(0.4, 1.7, 1), STN_D, { p: [0, -0.85, 0], grad: [0.6, 1.0] }),
])
export const BRIDGE_ARCH = P(bx(0.06, 1, 1), 0x1c2a36, {})
