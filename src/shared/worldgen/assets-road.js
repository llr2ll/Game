import * as THREE from 'three'
import { P, merge, box, bx, cyl, cone, ico, sph } from '../../engine/render/style'

// Peças de rua e de obra (geometrias fundidas, compartilhadas por todos os chunks).
const RED = 0xe0382d, WHITE = 0xf4f4f4, ORANGE = 0xff7a1a, IRON = 0x3b4254, GREY = 0x8d93a3

// barreira listrada de obra (2 m)
export const BARRIER = (() => {
  const p = []
  for (let i = 0; i < 8; i++) for (const y of [0.78, 0.5]) p.push(box(0.25, 0.2, 0.06, (i + (y > 0.6 ? 0 : 1)) & 1 ? WHITE : RED, [-0.875 + i * 0.25, y, 0], { lit: 0.15 }))
  for (const x of [-0.8, 0.8]) p.push(box(0.07, 0.95, 0.07, GREY, [x, 0.475, 0.0]), box(0.07, 0.07, 0.6, GREY, [x, 0.03, 0.0]))
  p.push(box(0.1, 0.1, 0.1, 0xffd23a, [-0.8, 1.0, 0]), box(0.1, 0.1, 0.1, 0xffd23a, [0.8, 1.0, 0]))
  return merge(p)
})()
export const CONE = merge([
  box(0.4, 0.04, 0.4, 0x22252d, [0, 0.02, 0]),
  P(cone(0.17, 0.62, 8), ORANGE, { p: [0, 0.35, 0], tip: 0xff9a4a, grad: [0.85, 1.05] }),
  P(cyl(0.1, 0.12, 0.1, 8), WHITE, { p: [0, 0.36, 0] }),
  P(cyl(0.065, 0.075, 0.07, 8), WHITE, { p: [0, 0.5, 0] }),
])
export const BOLLARD = merge([
  P(cyl(0.1, 0.11, 0.9, 8), 0xf0f0f0, { p: [0, 0.45, 0], grad: [0.85, 1.05] }),
  P(cyl(0.105, 0.105, 0.14, 8), RED, { p: [0, 0.72, 0] }), P(cyl(0.105, 0.105, 0.14, 8), RED, { p: [0, 0.4, 0] }),
])
export const DIRT = merge([
  P(ico(1.5, 1), 0x8a5a33, { p: [0, 0.35, 0], s: [1, 0.75, 1], tip: 0xb07a46, grad: [0.75, 1.05], lit: 0.2 }),
  P(ico(0.9, 1), 0x9a6a3a, { p: [1.1, 0.2, 0.5], s: [1, 0.7, 1], tip: 0xbc8650, lit: 0.2 }),
])
export const PIPES = merge([[0.3, -0.52], [0.3, 0.52], [0.84, 0]].map(([y, z]) =>
  P(cyl(0.3, 0.3, 2.4, 10).rotateZ(Math.PI / 2), 0x6f7685, { p: [0, y, z], grad: [0.8, 1.05], tip: 0x9aa1b0, fn: (c, nx) => { if (Math.abs(nx) > 0.9) c.multiplyScalar(0.7) } })))
export const TFENCE = (() => { // grade metálica provisória (2,5 m)
  const p = []
  for (const x of [-1.2, 1.2]) p.push(box(0.08, 1.9, 0.08, GREY, [x, 0.95, 0]), box(0.3, 0.1, 0.5, 0x6b7080, [x, 0.05, 0]))
  p.push(box(2.5, 0.06, 0.06, GREY, [0, 1.85, 0]), box(2.5, 0.06, 0.06, GREY, [0, 0.12, 0]))
  for (let i = 0; i < 9; i++) p.push(box(0.03, 1.7, 0.03, 0xb3b8c6, [-1.0 + i * 0.25, 1.0, 0]))
  return merge(p)
})()
export const EXCAVATOR = (() => {
  const Y = 0xf2b632, D = 0x2a2d36
  const p = []
  for (const z of [-0.85, 0.85]) p.push(box(3.0, 0.55, 0.65, D, [0, 0.3, z], { grad: [0.8, 1.05] }), P(cyl(0.3, 0.3, 0.7, 8).rotateX(Math.PI / 2), 0x555a66, { p: [-1.2, 0.3, z] }), P(cyl(0.3, 0.3, 0.7, 8).rotateX(Math.PI / 2), 0x555a66, { p: [1.2, 0.3, z] }))
  p.push(box(2.2, 0.7, 1.9, Y, [-0.1, 0.95, 0], { grad: [0.8, 1.05] }), box(1.0, 1.1, 1.3, Y, [0.5, 1.7, 0.1], { grad: [0.85, 1.05] }), box(0.9, 0.8, 1.1, 0xa6dcef, [0.55, 1.75, 0.12]))
  p.push(box(1.5, 0.5, 1.2, 0x3a3f4c, [-0.9, 1.15, 0])) // contrapeso
  p.push(P(bx(2.3, 0.3, 0.3), Y, { p: [1.9, 2.1, -0.4], r: [0, 0, 0.55], grad: [0.8, 1.05] })) // lança
  p.push(P(bx(1.6, 0.25, 0.25), Y, { p: [3.25, 1.7, -0.4], r: [0, 0, -0.9] })) // braço
  p.push(P(bx(0.7, 0.6, 0.8), 0x5b606e, { p: [3.65, 0.95, -0.4], r: [0, 0, 0.3] })) // caçamba
  return merge(p)
})()
export const BENCH = merge([
  ...[0, 1, 2, 3].map((i) => box(1.8, 0.07, 0.1, 0xa8693a, [0, 0.46, -0.14 + i * 0.1], { grad: [0.8, 1.05] })),
  ...[0, 1, 2].map((i) => box(1.8, 0.09, 0.05, 0xa8693a, [0, 0.62 + i * 0.13, -0.27], { r: [0.0, 0, 0] })),
  ...[-0.8, 0.8].flatMap((x) => [box(0.06, 0.46, 0.5, IRON, [x, 0.23, 0.0]), box(0.06, 0.55, 0.06, IRON, [x, 0.72, -0.27])]),
])
export const KM_POST = merge([
  box(0.26, 0.9, 0.2, 0xf0f0f0, [0, 0.45, 0], { grad: [0.85, 1.05] }),
  P(cyl(0.13, 0.13, 0.2, 3).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), 0xf0f0f0, { p: [0, 0.9, 0], r: [0, 0, 0] }),
  box(0.27, 0.22, 0.21, RED, [0, 0.72, 0]),
])
// poste de sinalização (cinza) com altura variável; criado por BuildSigns
export const postGeo = (h) => P(cyl(0.05, 0.055, h, 6), 0x9aa1b0, { p: [0, h / 2, 0], grad: [0.75, 1.05] })

// semáforo: poste alto com braço sobre a rua (-x local) e duas cabeças de 3 luzes voltadas para +z (quem chega).
// Corpo e lentes são geometrias separadas: as lentes (0 vermelho, 1 amarelo, 2 verde) usam os materiais de
// world/streetlights.js, que acendem/apagam conforme o ciclo
const HOUSING = 0x22252d
const HEADS = [[-3.2, 4.4, 0, true], [0, 3.3, 0.22, false]] // [x, y, z, moldura]: na ponta do braço e repetidor na altura dos olhos
function headBody(x, y, z, plate) {
  const p = [
    box(0.36, 1.0, 0.26, HOUSING, [x, y, z], { grad: [0.85, 1.05] }),
    box(0.42, 0.05, 0.32, HOUSING, [x, y + 0.52, z]), // tampa
    box(0.12, 0.14, 0.12, IRON, [x, y + 0.6, z]), // conexão
  ]
  if (plate) p.push(box(0.56, 1.16, 0.03, 0xf2d23a, [x, y, z - 0.15], { lit: 0.1 }), box(0.48, 1.08, 0.035, 0x1a1c22, [x, y, z - 0.14])) // moldura amarela atrás
  for (let i = 0; i < 3; i++) {
    const ly = y + 0.3 - i * 0.3
    p.push(P(cyl(0.13, 0.13, 0.02, 12).rotateX(Math.PI / 2), 0x14161c, { p: [x, ly, z + 0.135] })) // aro escuro da lente
    p.push(box(0.28, 0.025, 0.17, HOUSING, [x, ly + 0.135, z + 0.21])) // pala
    for (const s of [-1, 1]) p.push(box(0.02, 0.12, 0.14, HOUSING, [x + s * 0.13, ly + 0.075, z + 0.2]))
  }
  return p
}
export const TRAFFIC_BODY = merge([
  P(cyl(0.17, 0.21, 0.22, 8), IRON, { p: [0, 0.11, 0], grad: [0.75, 1.05] }),
  P(cyl(0.07, 0.1, 5.3, 8), IRON, { p: [0, 2.65, 0], grad: [0.75, 1.05] }),
  box(0.18, 0.18, 0.18, IRON, [0, 5.3, 0]),
  box(3.4, 0.1, 0.1, IRON, [-1.7, 5.0, 0]),
  P(bx(1.25, 0.06, 0.06), IRON, { p: [-0.55, 4.72, 0], r: [0, 0, 0.47] }), // mão-francesa do braço
  ...HEADS.flatMap(([x, y, z, plate]) => headBody(x, y, z, plate)),
  box(0.24, 0.6, 0.2, HOUSING, [0, 2.0, -0.16]), // caixa de comando
  box(0.13, 0.2, 0.1, 0xf2d23a, [0.13, 1.15, 0], { lit: 0.1 }), // botoeira de pedestre
  P(cyl(0.035, 0.035, 0.03, 8).rotateZ(Math.PI / 2), 0x1a1c22, { p: [0.195, 1.12, 0] }),
])
export const TRAFFIC_LENS = [0, 1, 2].map((i) => merge(HEADS.map(([x, y, z]) => P(cyl(0.11, 0.11, 0.04, 12).rotateX(Math.PI / 2), 0xffffff, { p: [x, y + 0.3 - i * 0.3, z + 0.15], grad: [0.78, 1.0] }))))
