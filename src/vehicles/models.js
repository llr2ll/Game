import * as THREE from 'three'
import { MAT, P, merge, box, cyl } from '../world/style'

// Veículos dirigíveis: sedã, picape e jipe. Frente para +Z, +X = lado do motorista (esquerda), rodas tocando y=0.
// Lataria = UMA malha fundida; rodas separadas (giram/esterçam); faróis e luz de freio em MAT.glow.
const SQ = Math.SQRT2
// "estufa" de vidro (tronco de pirâmide): base w x d, topo encolhido por k
const cabin = (w, h, d, k, color, p) => P(cyl(k, 1, h, 4).rotateY(Math.PI / 4), color, { p, s: [(w / 2) * SQ, 1, (d / 2) * SQ], lit: 0.3 })
// caixa de roda: meio tubo por cima do pneu
const arch = (r, w) => new THREE.CylinderGeometry(r, r, w, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2)
const GLASS = 0x9fd8ee, TIRE = 0x23232b, RIM = 0xd6dae6, DARK = 0x2c2c34, CHROME = 0xd9dde6

function wheelGeo(r, w, rim = RIM) {
  return merge([
    P(cyl(r, r, w, 14).rotateZ(Math.PI / 2), TIRE, { fn: (c, nx) => { if (Math.abs(nx) > 0.9) c.multiplyScalar(1.3) } }),
    P(cyl(r * 0.58, r * 0.58, w + 0.02, 10).rotateZ(Math.PI / 2), rim, { lit: 0.2 }),
    P(cyl(r * 0.2, r * 0.2, w + 0.04, 6).rotateZ(Math.PI / 2), 0x8a8f9c),
    ...[0, 1, 2, 3, 4].map((i) => box(w + 0.03, r * 0.12, r * 0.5, 0x8a8f9c, [0, Math.sin(i * 1.26) * r * 0.3, Math.cos(i * 1.26) * r * 0.3], { r: [i * 1.26, 0, 0] })),
  ])
}

// ---------------------------------------------------------------- SEDÃ
function sedan(c) {
  const W = 1.84, body = [
    box(W, 0.42, 4.0, c, [0, 0.6, 0], { lit: 0.3, grad: [0.72, 1.05] }), // lataria baixa
    box(W - 0.06, 0.16, 1.2, c, [0, 0.88, 1.35], { lit: 0.35 }), // capô
    box(W - 0.06, 0.16, 0.95, c, [0, 0.88, -1.5], { lit: 0.35 }), // porta-malas
    box(W - 0.02, 0.06, 2.0, c, [0, 0.83, -0.2]), // cintura
    cabin(W - 0.12, 0.5, 2.1, 0.74, GLASS, [0, 1.11, -0.22]),
    box(1.22, 0.07, 1.42, c, [0, 1.38, -0.24], { lit: 0.4 }), // teto
    box(W + 0.02, 0.05, 4.02, 0x23232b, [0, 0.42, 0]), // saia
    box(W + 0.04, 0.17, 0.16, CHROME, [0, 0.47, 2.03], { lit: 0.2 }), box(W + 0.04, 0.17, 0.16, CHROME, [0, 0.47, -2.03], { lit: 0.2 }), // para-choques
    box(0.9, 0.16, 0.04, DARK, [0, 0.66, 2.01]), // grade
    box(0.4, 0.12, 0.03, 0xf4f4f4, [0, 0.62, -2.02]), // placa
    box(0.3, 0.12, 0.05, 0xb02020, [0.66, 0.74, -2.0]), box(0.3, 0.12, 0.05, 0xb02020, [-0.66, 0.74, -2.0]), // lanterna
    ...[1, -1].flatMap((s) => [
      box(0.02, 0.38, 0.03, 0x23232b, [s * (W / 2 + 0.005), 0.62, 0.15]), box(0.02, 0.38, 0.03, 0x23232b, [s * (W / 2 + 0.005), 0.62, -0.9]), // vãos das portas
      box(0.03, 0.04, 0.14, CHROME, [s * (W / 2 + 0.01), 0.74, -0.05]), box(0.03, 0.04, 0.14, CHROME, [s * (W / 2 + 0.01), 0.74, -0.75]), // maçanetas
      box(0.14, 0.1, 0.06, c, [s * (W / 2 + 0.06), 0.98, 0.72]), // retrovisor
      P(arch(0.42, 0.06), 0x1c1c22, { p: [s * (W / 2 - 0.01), 0.38, 1.3] }), // caixa de roda
      P(arch(0.42, 0.06), 0x1c1c22, { p: [s * (W / 2 - 0.01), 0.38, -1.3] }),
    ]),
  ]
  return {
    body: merge(body),
    lights: merge([box(0.34, 0.13, 0.04, 0xfff3c0, [0.6, 0.72, 2.02]), box(0.34, 0.13, 0.04, 0xfff3c0, [-0.6, 0.72, 2.02])]),
    brake: merge([box(0.3, 0.12, 0.03, 0xff2a20, [0.66, 0.74, -2.03]), box(0.3, 0.12, 0.03, 0xff2a20, [-0.66, 0.74, -2.03])]),
    wheel: wheelGeo(0.36, 0.26), wheels: [[0.82, 0.36, 1.3], [-0.82, 0.36, 1.3], [0.82, 0.36, -1.3], [-0.82, 0.36, -1.3]],
  }
}

// ---------------------------------------------------------------- PICAPE
function pickup(c) {
  const W = 1.98, bedC = 0x3a3a40, body = [
    box(W, 0.5, 4.86, c, [0, 0.78, 0], { lit: 0.3, grad: [0.7, 1.05] }), // chassi/lataria baixa
    box(W - 0.04, 0.3, 1.25, c, [0, 1.16, 1.78], { lit: 0.35 }), // capô alto
    box(W, 0.3, 1.5, c, [0, 1.16, 0.43], { lit: 0.3 }), // base da cabine
    cabin(W - 0.12, 0.5, 1.5, 0.78, GLASS, [0, 1.56, 0.4]),
    box(1.55, 0.08, 1.15, c, [0, 1.83, 0.38], { lit: 0.4 }), // teto
    box(0.04, 0.2, 0.8, 0x1c1c22, [0, 1.95, 0.38]), // farol no teto
    // caçamba aberta (paredes + assoalho)
    box(W - 0.16, 0.06, 2.05, bedC, [0, 1.06, -1.33]),
    box(0.1, 0.42, 2.12, c, [W / 2 - 0.05, 1.24, -1.33], { lit: 0.35 }), box(0.1, 0.42, 2.12, c, [-W / 2 + 0.05, 1.24, -1.33], { lit: 0.35 }),
    box(W, 0.42, 0.1, c, [0, 1.24, -2.38], { lit: 0.3 }), // tampa traseira
    box(W, 0.46, 0.08, c, [0, 1.26, -0.28]),
    box(0.9, 0.3, 0.42, 0x5a5f6a, [0.0, 1.24, -0.55], { lit: 0.3 }), // caixa de ferramentas
    ...[-0.8, -1.4, -2.0].map((z) => box(W - 0.2, 0.025, 0.05, 0x2a2a30, [0, 1.1, z])), // frisos do assoalho
    // frente robusta
    box(W + 0.06, 0.24, 0.2, 0x2a2a30, [0, 0.62, 2.47]), box(1.3, 0.3, 0.06, 0x2a2a30, [0, 1.06, 2.42]), // para-choque + grade
    ...[-0.4, -0.2, 0, 0.2, 0.4].map((x) => box(0.05, 0.26, 0.03, CHROME, [x, 1.06, 2.45])),
    box(W + 0.06, 0.2, 0.18, 0x2a2a30, [0, 0.62, -2.47]),
    box(0.22, 0.2, 0.04, 0xb02020, [0.84, 1.18, -2.43]), box(0.22, 0.2, 0.04, 0xb02020, [-0.84, 1.18, -2.43]),
    ...[1, -1].flatMap((s) => [
      box(0.02, 0.5, 0.03, 0x23232b, [s * (W / 2 + 0.005), 1.0, -0.2]), box(0.03, 0.04, 0.16, CHROME, [s * (W / 2 + 0.01), 1.22, 0.1]),
      box(0.16, 0.13, 0.07, 0x2a2a30, [s * (W / 2 + 0.08), 1.42, 1.1]),
      box(0.12, 0.1, 4.6, 0x2a2a30, [s * (W / 2 + 0.02), 0.5, 0]), // estribo/saia
      P(arch(0.52, 0.08), 0x1c1c22, { p: [s * (W / 2), 0.46, 1.55] }),
      P(arch(0.52, 0.08), 0x1c1c22, { p: [s * (W / 2), 0.46, -1.45] }),
    ]),
  ]
  return {
    body: merge(body),
    lights: merge([box(0.36, 0.16, 0.04, 0xfff3c0, [0.72, 1.12, 2.43]), box(0.36, 0.16, 0.04, 0xfff3c0, [-0.72, 1.12, 2.43])]),
    brake: merge([box(0.22, 0.2, 0.03, 0xff2a20, [0.84, 1.18, -2.44]), box(0.22, 0.2, 0.03, 0xff2a20, [-0.84, 1.18, -2.44])]),
    wheel: wheelGeo(0.45, 0.32, 0xb8bdc8), wheels: [[0.9, 0.45, 1.55], [-0.9, 0.45, 1.55], [0.9, 0.45, -1.45], [-0.9, 0.45, -1.45]],
  }
}

// ---------------------------------------------------------------- JIPE (aberto, santo-antônio, estepe atrás)
function jeep(c) {
  const W = 1.8, seat = 0x3a2e28, body = [
    box(W, 0.12, 3.3, 0x2a2a30, [0, 0.58, -0.05]), // assoalho
    box(0.1, 0.55, 2.3, c, [W / 2 - 0.05, 0.9, -0.55], { lit: 0.3, grad: [0.75, 1.05] }), box(0.1, 0.55, 2.3, c, [-W / 2 + 0.05, 0.9, -0.55], { lit: 0.3, grad: [0.75, 1.05] }),
    box(W, 0.55, 0.1, c, [0, 0.9, -1.7], { lit: 0.3 }), // traseira
    box(W, 0.55, 1.15, c, [0, 0.9, 1.18], { lit: 0.3, grad: [0.75, 1.05] }), // capô
    box(W - 0.1, 0.05, 1.1, c, [0, 1.19, 1.18], { lit: 0.4 }),
    box(W, 0.4, 0.1, c, [0, 1.02, 0.6]), // painel
    // grade com fendas verticais e faróis redondos
    box(W - 0.2, 0.42, 0.06, c, [0, 0.92, 1.77]),
    ...[-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36].map((x) => box(0.05, 0.3, 0.03, 0x1c1c22, [x, 0.92, 1.8])),
    box(W + 0.1, 0.2, 0.18, 0x2a2a30, [0, 0.55, 1.85]), box(W + 0.1, 0.2, 0.15, 0x2a2a30, [0, 0.55, -1.8]),
    // para-lamas
    ...[1, -1].flatMap((s) => [
      box(0.32, 0.08, 0.95, 0x2a2a30, [s * (W / 2 + 0.06), 1.0, 1.12], { lit: 0.3 }),
      box(0.32, 0.08, 0.95, 0x2a2a30, [s * (W / 2 + 0.06), 1.0, -1.18], { lit: 0.3 }),
      box(0.18, 0.06, 0.9, 0x2a2a30, [s * (W / 2 + 0.06), 0.56, 0.0]), // estribo
    ]),
    // para-brisa com moldura
    box(W - 0.1, 0.06, 0.06, c, [0, 1.25, 0.62]), box(W - 0.1, 0.06, 0.06, c, [0, 1.68, 0.62]),
    box(0.06, 0.48, 0.06, c, [W / 2 - 0.08, 1.46, 0.62]), box(0.06, 0.48, 0.06, c, [-W / 2 + 0.08, 1.46, 0.62]),
    box(W - 0.24, 0.38, 0.025, GLASS, [0, 1.46, 0.62], { lit: 0.3 }),
    // santo-antônio
    P(cyl(0.045, 0.045, 0.8, 6), DARK, { p: [0.8, 1.55, -0.95] }), P(cyl(0.045, 0.045, 0.8, 6), DARK, { p: [-0.8, 1.55, -0.95] }),
    P(cyl(0.045, 0.045, 1.6, 6).rotateZ(Math.PI / 2), DARK, { p: [0, 1.95, -0.95] }),
    // bancos
    ...[[0.42, 0.1], [-0.42, 0.1], [0.42, -0.95], [-0.42, -0.95]].flatMap(([x, z]) => [
      box(0.56, 0.14, 0.5, seat, [x, 0.75, z], { lit: 0.2 }), box(0.56, 0.48, 0.12, seat, [x, 1.02, z - 0.28], { lit: 0.2, r: [-0.12, 0, 0] }),
    ]),
    // volante
    P(new THREE.TorusGeometry(0.16, 0.025, 6, 14), 0x1c1c22, { p: [0.42, 1.18, 0.5], r: [-0.9, 0, 0] }),
    P(cyl(0.025, 0.025, 0.3, 5), 0x1c1c22, { p: [0.42, 1.08, 0.58], r: [-0.9, 0, 0] }),
    // estepe
    P(cyl(0.38, 0.38, 0.24, 12).rotateX(Math.PI / 2), TIRE, { p: [0, 1.0, -1.88] }), P(cyl(0.22, 0.22, 0.26, 8).rotateX(Math.PI / 2), RIM, { p: [0, 1.0, -1.88] }),
    box(0.2, 0.14, 0.04, 0xb02020, [0.78, 0.95, -1.76]), box(0.2, 0.14, 0.04, 0xb02020, [-0.78, 0.95, -1.76]),
    box(0.25, 0.3, 0.2, 0x5a6a3a, [-0.72, 1.0, 1.5], { lit: 0.2 }), // galão no capô
  ]
  return {
    body: merge(body),
    lights: merge([1, -1].map((s) => P(cyl(0.12, 0.12, 0.05, 10).rotateX(Math.PI / 2), 0xfff3c0, { p: [s * 0.62, 0.96, 1.8] }))),
    brake: merge([box(0.2, 0.14, 0.03, 0xff2a20, [0.78, 0.95, -1.79]), box(0.2, 0.14, 0.03, 0xff2a20, [-0.78, 0.95, -1.79])]),
    wheel: wheelGeo(0.43, 0.34, 0x8a8f7a), wheels: [[0.92, 0.43, 1.15], [-0.92, 0.43, 1.15], [0.92, 0.43, -1.15], [-0.92, 0.43, -1.15]],
  }
}

// dimensões, desempenho e bancos (x, y do banco, z; modo: sentado / em pé na caçamba; hidden = teto cobre)
export const VEHICLES = {
  sedan: {
    name: 'Sedã', build: sedan, L: 4.1, W: 1.86, H: 1.42, colors: [0xe0473a, 0x3a86e0, 0xf0ece4, 0x4cc27a, 0x3a3a46, 0xf2b632],
    max: 23, rev: 7, accel: 14, brake: 28, turn: 2.4, grip: 7.5, off: 0.6, hp: 100, mass: 1,
    seats: [[0.42, 0.62, 0.15, 'drive', true], [-0.42, 0.62, 0.15, 'sit', true], [0.42, 0.62, -0.8, 'sit', true], [-0.42, 0.62, -0.8, 'sit', true]],
  },
  pickup: {
    name: 'Picape', build: pickup, L: 4.9, W: 2.0, H: 1.9, colors: [0xd9453a, 0x3b6fb6, 0xf0ece0, 0x4a4a52, 0x7a8a4a],
    max: 20, rev: 6, accel: 11.5, brake: 24, turn: 2.0, grip: 7, off: 0.82, hp: 160, mass: 1.5,
    seats: [[0.45, 0.85, 0.35, 'drive', true], [-0.45, 0.85, 0.35, 'sit', true], [0.45, 1.09, -1.05, 'stand', false], [-0.45, 1.09, -1.7, 'stand', false]],
  },
  jeep: {
    name: 'Jipe', build: jeep, L: 3.8, W: 1.86, H: 1.9, colors: [0x7a8a4a, 0xd8b56a, 0xe0473a, 0x2f6b4a, 0xf2f0e8],
    max: 19, rev: 7, accel: 13, brake: 26, turn: 2.75, grip: 9, off: 0.97, hp: 125, mass: 1.15,
    seats: [[0.42, 0.82, 0.1, 'drive', false], [-0.42, 0.82, 0.1, 'sit', false], [0.42, 0.82, -0.95, 'sit', false], [-0.42, 0.82, -0.95, 'sit', false]],
  },
}
export const KINDS = Object.keys(VEHICLES)

const cache = new Map()
export function VehicleGeo(kind, c) {
  const k = `${kind}${c}`
  if (!cache.has(k)) { const d = VEHICLES[kind]; cache.set(k, d.build(d.colors[c % d.colors.length])) }
  return cache.get(k)
}
