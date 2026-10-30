import * as THREE from 'three'
import { P, merge, box, bx, cyl, cone, ico, sph } from './style'

const dome = (r, seg = 10) => new THREE.SphereGeometry(r, seg, 5, 0, Math.PI * 2, 0, Math.PI / 2)
import { BUSH } from './assets'

// Mobiliário urbano das cidades (praças, jardins, estacionamentos): geometrias fundidas, compartilhadas por todos os chunks.
// Frente de cada peça = +z local (o gerador gira com ry).
const IRON = 0x3b4254, CONC = 0xd8d2c4, CONC_D = 0xb9b3a5, WATER = 0x7fd0f4, WATER_D = 0x3f9be0
const LEAF_D = 0x1a7a3e, LEAF_L = 0x62d067
const leafy = (o = {}) => ({ tip: LEAF_L, grad: [0.75, 1.05], lit: 0.15, ...o })

// lixeira verde com tampa
export const BIN = merge([
  P(cyl(0.24, 0.21, 0.72, 10), 0x3f8f4a, { p: [0, 0.36, 0], grad: [0.7, 1.05] }),
  P(cyl(0.26, 0.26, 0.06, 10), 0x2c6a36, { p: [0, 0.74, 0] }),
  P(dome(0.22), 0x4fa35a, { p: [0, 0.76, 0], s: [1, 0.45, 1] }),
  box(0.14, 0.03, 0.02, 0xf4f4f4, [0, 0.5, 0.235]), // faixa clara na frente
])

// hidrante vermelho
export const HYDRANT = merge([
  P(cyl(0.17, 0.19, 0.08, 8), 0xb8242a, { p: [0, 0.04, 0] }),
  P(cyl(0.12, 0.13, 0.48, 8), 0xe0382d, { p: [0, 0.32, 0], grad: [0.75, 1.05] }),
  P(cyl(0.15, 0.15, 0.06, 8), 0xb8242a, { p: [0, 0.57, 0] }),
  P(dome(0.11, 8), 0xe0382d, { p: [0, 0.6, 0] }),
  P(cyl(0.035, 0.035, 0.07, 6), 0xffd23a, { p: [0, 0.72, 0] }),
  ...[-1, 1].map((s) => P(cyl(0.055, 0.055, 0.12, 6).rotateZ(Math.PI / 2), 0xb8242a, { p: [s * 0.16, 0.38, 0] })),
  P(cyl(0.065, 0.065, 0.1, 6).rotateX(Math.PI / 2), 0xffd23a, { p: [0, 0.36, 0.15] }),
])

// floreira de concreto com arbusto
export const PLANTER = merge([
  box(1.2, 0.5, 1.2, CONC, [0, 0.25, 0], { grad: [0.75, 1.05] }),
  box(1.3, 0.08, 1.3, CONC_D, [0, 0.52, 0]),
  box(1.0, 0.04, 1.0, 0x6a4024, [0, 0.55, 0]),
  BUSH.clone().scale(0.95, 0.9, 0.95).translate(0, 0.52, 0),
])

// cerca viva aparada (2,4 m em x): bloco com topo em "almofadas"
export const HEDGE = merge([
  box(2.4, 0.7, 0.7, LEAF_D, [0, 0.35, 0], leafy({ tip: 0x3fae4a })),
  ...[-0.9, -0.3, 0.3, 0.9].map((x, i) => P(ico(0.42, 1), 0x2a8a44, { p: [x, 0.72, 0], s: [1, 0.55, 0.85], ...leafy({ lit: 0.25 }), r: [0, i, 0] })),
])

// banca de jornal: cabine verde, balcão com revistas coloridas, toldo listrado
export const KIOSK = (() => {
  const G = 0x2f8a5a, GD = 0x226b45, p = []
  p.push(box(2.3, 2.2, 1.7, G, [0, 1.1, 0], { grad: [0.75, 1.05] }))
  p.push(box(2.5, 0.16, 1.9, GD, [0, 2.28, 0]), box(2.2, 0.35, 1.6, 0xf4f0e2, [0, 2.53, 0]), box(2.4, 0.08, 1.8, GD, [0, 2.74, 0]))
  p.push(box(1.8, 0.95, 0.05, 0x2b3a52, [0, 1.45, 0.86])) // janela do atendente
  p.push(box(2.0, 0.08, 0.5, 0xd9c49a, [0, 0.95, 1.05])) // balcão
  for (let i = 0; i < 7; i++) p.push(box(0.22, 0.3, 0.03, [0xe0473a, 0xffd23a, 0x3a86e0, 0xf4f4f4, 0xb060c8, 0x4cc27a, 0xf0a030][i], [-0.75 + i * 0.25, 1.15, 0.89], { r: [-0.15, 0, 0] }))
  for (let i = 0; i < 6; i++) p.push(box(0.42, 0.05, 0.62, i & 1 ? 0xf4f4f4 : 0xe0473a, [-1.05 + i * 0.42, 2.12, 1.2], { r: [0.32, 0, 0] })) // toldo
  for (const s of [-1, 1]) p.push(box(0.05, 1.0, 0.7, 0xf4f4f4, [s * 1.18, 0.5, 0], { grad: [0.85, 1.05] })) // prateleiras laterais
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) p.push(box(0.04, 0.22, 0.16, [0xffd23a, 0x3a86e0, 0xe0473a][i], [s * 1.22, 0.3 + i * 0.3, 0.2 - i * 0.15]))
  return merge(p)
})()

// chafariz: bacia de pedra, água, coluna com taça e jatos caindo
export const FOUNTAIN = (() => {
  const p = []
  p.push(P(cyl(1.75, 1.85, 0.55, 12), CONC, { p: [0, 0.275, 0], grad: [0.7, 1.05] }))
  p.push(P(cyl(1.82, 1.82, 0.1, 12), 0xe9e3d4, { p: [0, 0.6, 0] })) // borda (dá para sentar)
  p.push(P(cyl(1.55, 1.55, 0.04, 12), WATER_D, { p: [0, 0.5, 0], tip: WATER, fn: (c, nx, ny) => { if (ny > 0.9) c.set(WATER) } }))
  p.push(P(cyl(0.22, 0.32, 1.25, 8), CONC, { p: [0, 1.0, 0], grad: [0.75, 1.05] }))
  p.push(P(cyl(0.72, 0.35, 0.24, 10), CONC, { p: [0, 1.6, 0], grad: [0.8, 1.05] }))
  p.push(P(cyl(0.62, 0.62, 0.03, 10), WATER, { p: [0, 1.71, 0] }))
  p.push(P(cyl(0.08, 0.12, 0.45, 6), CONC, { p: [0, 1.93, 0] }), P(sph(0.12, 8, 6), WATER, { p: [0, 2.2, 0], lit: 0.4 }))
  for (let k = 0; k < 8; k++) { // véu de água caindo da taça
    const a = (k / 8) * Math.PI * 2
    p.push(P(bx(0.18, 0.95, 0.04), WATER, { p: [Math.cos(a) * 0.74, 1.15, Math.sin(a) * 0.74], r: [0, -a + Math.PI / 2, 0], tip: 0xd8f4ff, lit: 0.2 }))
  }
  return merge(p)
})()

// abrigo de ônibus: fundo de vidro, laterais, telhado e banco (aberto em +z)
export const BUS_SHELTER = (() => {
  const p = [], GL = 0x9fd8f0
  for (const x of [-1.45, 1.45]) for (const z of [-0.55, 0.5]) p.push(box(0.08, 2.4, 0.08, IRON, [x, 1.2, z]))
  p.push(box(2.9, 1.7, 0.04, GL, [0, 1.25, -0.55], { tip: 0xd8f4ff }))
  p.push(box(0.04, 1.7, 0.95, GL, [-1.45, 1.25, -0.03], { tip: 0xd8f4ff }))
  p.push(box(3.2, 0.12, 1.45, 0xe8453c, [0, 2.46, -0.02], { grad: [0.85, 1.05] }), box(3.25, 0.06, 1.5, 0xf4f4f4, [0, 2.55, -0.02]))
  p.push(box(2.9, 0.12, 0.05, IRON, [0, 0.4, -0.55])) // rodapé
  p.push(box(2.2, 0.06, 0.4, 0xa8693a, [0.15, 0.46, -0.3], { grad: [0.8, 1.05] }), box(2.2, 0.35, 0.05, 0xa8693a, [0.15, 0.68, -0.5]))
  for (const x of [-0.8, 1.1]) p.push(box(0.05, 0.44, 0.35, IRON, [x, 0.22, -0.3]))
  p.push(box(0.7, 1.0, 0.05, 0xffd23a, [1.0, 1.4, -0.52])) // cartaz de horários
  p.push(box(0.6, 0.06, 0.02, 0x2c3140, [1.0, 1.6, -0.49]), box(0.6, 0.06, 0.02, 0x2c3140, [1.0, 1.4, -0.49]), box(0.45, 0.06, 0.02, 0x2c3140, [0.93, 1.2, -0.49]))
  return merge(p)
})()

// batente de estacionamento (concreto com faixas amarelas), 1,6 m em x
export const WHEEL_STOP = merge([
  box(1.6, 0.12, 0.24, CONC, [0, 0.06, 0], { grad: [0.8, 1.05] }),
  ...[-0.5, 0, 0.5].map((x) => box(0.2, 0.125, 0.245, 0xffd23a, [x, 0.06, 0])),
])

// mesa de piquenique (madeira): tampo 1,8 m em x, bancos dos dois lados
export const PICNIC = (() => {
  const W = 0xb87638, WD = 0x8a5530, p = []
  for (let i = 0; i < 4; i++) p.push(box(1.8, 0.06, 0.18, W, [0, 0.76, -0.29 + i * 0.195], { grad: [0.85, 1.05] }))
  for (const z of [-0.72, 0.72]) p.push(box(1.8, 0.06, 0.26, W, [0, 0.45, z], { grad: [0.85, 1.05] }))
  for (const x of [-0.7, 0.7]) {
    p.push(box(0.08, 0.06, 1.7, WD, [x, 0.4, 0]))
    for (const s of [-1, 1]) p.push(P(bx(0.07, 0.85, 0.07), WD, { p: [x, 0.38, s * 0.3], r: [s * 0.55, 0, 0] }))
  }
  return merge(p)
})()

// mesa de café com guarda-sol
export const CAFE = (() => {
  const p = [P(cyl(0.45, 0.45, 0.04, 12), 0xf4f0e2, { p: [0, 0.74, 0] }), P(cyl(0.04, 0.04, 0.72, 6), IRON, { p: [0, 0.37, 0] }), P(cyl(0.22, 0.25, 0.04, 8), IRON, { p: [0, 0.02, 0] })]
  p.push(P(cyl(0.025, 0.025, 1.6, 6), 0xf4f4f4, { p: [0, 1.5, 0] }))
  // guarda-sol: gomos alternando vermelho e branco (cor por face, pelo ângulo do centro do triângulo)
  const red = new THREE.Color(0xe0473a)
  p.push(P(cone(1.15, 0.45, 16, true), 0xf4f4f4, { p: [0, 2.2, 0], tri: (c, cx, cy, cz) => { if (Math.floor((Math.atan2(cz, cx) + Math.PI) / (Math.PI / 4)) & 1) c.copy(red) } }))
  for (const a of [0, Math.PI]) { // duas cadeiras
    const cx = Math.sin(a) * 0.75, cz = Math.cos(a) * 0.75
    p.push(box(0.42, 0.05, 0.42, 0x3f8fe0, [cx, 0.45, cz]), P(bx(0.42, 0.45, 0.05), 0x3f8fe0, { p: [cx + Math.sin(a) * 0.2, 0.7, cz + Math.cos(a) * 0.2], r: [0, a, 0] }))
    for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) p.push(box(0.04, 0.45, 0.04, IRON, [cx + dx, 0.22, cz + dz]))
  }
  return merge(p)
})()

// bicicletário (4 arcos)
export const BIKE_RACK = merge([
  ...[-0.6, -0.2, 0.2, 0.6].map((x) => P(new THREE.TorusGeometry(0.32, 0.03, 4, 10, Math.PI), 0x9aa1b0, { p: [x, 0.0, 0], r: [0, Math.PI / 2, 0] })),
  box(1.5, 0.04, 0.08, 0x9aa1b0, [0, 0.02, 0]),
])
