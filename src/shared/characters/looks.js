import * as THREE from 'three'
import { P, merge, box, sph, cyl, cap, cone } from '../../engine/render/style'

// Visual de cada classe, separado por osso do esqueleto (cada osso = UMA malha fundida com cor por vértice).
// Medidas (metros, personagem olhando para +Z, +X = lado ESQUERDO dele):
//   quadril 0.88 · joelho 0.46 · tornozelo 0.09 · coluna 0.98 · ombros 1.42 · pescoço 1.52 · topo da cabeça ~1.9
//   coxa 0.38 · canela 0.37 · braço 0.30 · antebraço 0.30 (até o centro da mão)
export const BONES = { hipY: 0.88, legX: 0.1, legY: -0.04, knee: 0.38, ankle: 0.37, spineY: 0.1, shX: 0.24, shY: 0.44, neckY: 0.54, upper: 0.3, fore: 0.3 }

const SKIN = 0xf2c29b
const darker = (k) => (c, nx, ny, nz, lx, ly) => { if (ly < k) c.multiplyScalar(0.82) }

// rosto: olhos, sobrancelhas, nariz, orelhas (centro da cabeça em y=0.17 no osso do pescoço)
function face(brow, skin = SKIN) {
  const out = [P(sph(0.19, 14, 10), skin, { p: [0, 0.17, 0.01], s: [0.95, 1.04, 1], lit: 0.12 })]
  for (const s of [-1, 1]) {
    out.push(
      P(sph(0.026, 6, 5), 0x2a2030, { p: [s * 0.068, 0.19, 0.172], s: [0.85, 1.25, 0.6] }), // olho
      P(sph(0.009, 4, 3), 0xffffff, { p: [s * 0.062, 0.2, 0.188] }), // brilho
      box(0.065, 0.016, 0.02, brow, [s * 0.07, 0.235, 0.172], { r: [0, 0, s * -0.12] }), // sobrancelha
      P(sph(0.045, 6, 5), skin, { p: [s * 0.185, 0.16, 0], s: [0.5, 1, 0.8] }), // orelha
      P(sph(0.03, 6, 4), 0xf59a8e, { p: [s * 0.11, 0.135, 0.15], s: [1, 0.6, 0.4] }), // bochecha
    )
  }
  out.push(P(sph(0.028, 6, 4), skin, { p: [0, 0.155, 0.192], s: [0.9, 1, 1.1], fn: (c) => c.multiplyScalar(0.92) })) // nariz
  out.push(box(0.05, 0.012, 0.012, 0x9a4a40, [0, 0.105, 0.178])) // boca
  return out
}

// partes comuns (pernas, braços, pescoço) com as cores da roupa
function limbs({ pants, boots, sleeve, cuff = sleeve, hand = SKIN, thighR = 0.085, shinR = 0.072, bootTop = 0.2 }) {
  return {
    thigh: merge([P(cap(thighR, 0.22, 8), pants, { p: [0, -0.19, 0], lit: 0.12, grad: [0.85, 1.05] })]),
    shin: merge([
      P(cap(shinR, 0.22, 8), pants, { p: [0, -0.18, 0], lit: 0.12 }),
      P(cyl(0.085, 0.09, bootTop, 8), boots, { p: [0, -0.37 + bootTop / 2 - 0.02, 0.0], lit: 0.15 }),
    ]),
    foot: merge([
      box(0.13, 0.1, 0.25, boots, [0, -0.045, 0.05], { lit: 0.2 }),
      P(sph(0.066, 8, 6), boots, { p: [0, -0.05, 0.16], s: [1, 0.78, 1.1], lit: 0.2 }),
      box(0.135, 0.025, 0.27, 0x2a2024, [0, -0.085, 0.05]), // sola
    ]),
    upper: merge([
      P(cap(0.07, 0.17, 8), sleeve, { p: [0, -0.14, 0], lit: 0.15 }),
    ]),
    fore: merge([
      P(cap(0.062, 0.15, 8), cuff, { p: [0, -0.12, 0], lit: 0.15 }),
      P(sph(0.066, 8, 6), hand, { p: [0, -0.3, 0.005], s: [0.85, 1.12, 1] }),
      P(sph(0.03, 6, 4), hand, { p: [0.035, -0.27, 0.05] }), // polegar
    ]),
  }
}

function torsoBase(color, { chest = [1.15, 1, 0.8], grad = [0.82, 1.05], fn = null } = {}) {
  return [
    P(cap(0.19, 0.2, 10), color, { p: [0, 0.24, 0], s: chest, lit: 0.18, grad, fn }),
    P(sph(0.095, 8, 6), color, { p: [0.22, 0.42, 0], lit: 0.2 }), P(sph(0.095, 8, 6), color, { p: [-0.22, 0.42, 0], lit: 0.2 }), // ombros
    P(cyl(0.062, 0.07, 0.12, 8), SKIN, { p: [0, 0.54, 0.0] }), // pescoço
  ]
}

// ---------------------------------------------------------------- Atirador (jogador 1)
function gunner() {
  const RED = 0xc8574f, OLIVE = 0x6b7a3e, KHAKI = 0x8f8159, HAIR = 0x4a3020, BOOT = 0x3a2c22
  const L = limbs({ pants: KHAKI, boots: BOOT, sleeve: RED, cuff: RED, hand: 0x2e2e36 })
  L.shin = merge([L.shin, box(0.13, 0.1, 0.07, 0x3d4228, [0, -0.04, 0.06], { lit: 0.2 })]) // joelheira
  return {
    ...L,
    pelvis: merge([
      P(sph(0.165, 10, 8), KHAKI, { p: [0, 0.0, 0], s: [1.2, 0.8, 0.9], lit: 0.1 }),
      P(cyl(0.18, 0.18, 0.06, 12), 0x3a3026, { p: [0, 0.08, 0], s: [1.1, 1, 0.85] }), // cinto
      box(0.08, 0.1, 0.06, OLIVE, [0.17, 0.0, 0.06]), box(0.08, 0.1, 0.06, OLIVE, [-0.17, 0.0, 0.06]), // bolsos
      box(0.09, 0.14, 0.1, 0x2e3324, [-0.2, -0.05, 0.0]), // coldre
    ]),
    torso: merge([
      ...torsoBase(RED),
      box(0.4, 0.34, 0.33, OLIVE, [0, 0.27, 0.0], { lit: 0.2, grad: [0.85, 1.05] }), // colete
      ...[-0.11, 0.0, 0.11].map((x) => box(0.09, 0.1, 0.05, 0x56632f, [x, 0.2, 0.18])), // porta-carregadores
      box(0.06, 0.08, 0.04, 0xd9c38a, [0.12, 0.38, 0.17]), // distintivo
      P(sph(0.17, 8, 6), 0x5c6a34, { p: [0, 0.27, -0.24], s: [1, 1.15, 0.55], lit: 0.2 }), // mochila pequena
      box(0.36, 0.04, 0.05, 0x3a3026, [0, 0.38, -0.32]), // alça
    ]),
    head: merge([
      ...face(HAIR),
      P(new THREE.SphereGeometry(0.198, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), HAIR, { p: [0, 0.18, -0.005], s: [0.97, 1, 1.02] }), // cabelo curto
      P(new THREE.SphereGeometry(0.205, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.42), RED, { p: [0, 0.2, 0], lit: 0.25 }), // boné
      P(cyl(0.12, 0.12, 0.02, 12, false), RED, { p: [0, 0.27, 0.16], s: [1.15, 1, 1.25], lit: 0.2 }), // aba
      P(sph(0.025, 6, 4), 0xffffff, { p: [0, 0.4, 0] }),
      box(0.15, 0.025, 0.02, 0x22252e, [0, 0.21, 0.19]), // óculos (armação)
      box(0.055, 0.04, 0.012, 0x3a4a66, [0.05, 0.2, 0.195]), box(0.055, 0.04, 0.012, 0x3a4a66, [-0.05, 0.2, 0.195]),
    ]),
  }
}

// ---------------------------------------------------------------- Samurai (jogador 2)
function samurai() {
  const BLUE = 0x3f6fb5, NAVY = 0x232d48, WHITE = 0xf2efe6, HAIR = 0x1c1a22, GOLD = 0xd9b44a, RED = 0xb8443a
  const L = limbs({ pants: NAVY, boots: WHITE, sleeve: BLUE, cuff: BLUE, thighR: 0.12, shinR: 0.1, bootTop: 0.1 })
  L.shin = merge([ // hakama: calça larga em forma de sino
    P(cyl(0.11, 0.15, 0.3, 10), NAVY, { p: [0, -0.15, 0], lit: 0.12, fn: darker(-0.25) }),
    P(cyl(0.065, 0.07, 0.1, 8), WHITE, { p: [0, -0.33, 0] }), // meia tabi
  ])
  L.foot = merge([
    box(0.12, 0.08, 0.24, WHITE, [0, -0.04, 0.05], { lit: 0.2 }),
    box(0.14, 0.03, 0.28, 0x8a6a3a, [0, -0.085, 0.05]), // sandália
    box(0.02, 0.03, 0.08, RED, [0, -0.02, 0.13]),
  ])
  L.upper = merge([
    P(cap(0.085, 0.15, 8), BLUE, { p: [0, -0.14, 0], lit: 0.15 }),
    box(0.13, 0.17, 0.2, NAVY, [0, -0.07, 0], { lit: 0.25 }), // sode (placa do ombro)
    box(0.135, 0.025, 0.205, GOLD, [0, -0.15, 0]),
  ])
  L.fore = merge([
    P(cap(0.064, 0.15, 8), 0x2a3550, { p: [0, -0.12, 0], lit: 0.15 }), // kote (manga de armadura)
    P(sph(0.066, 8, 6), SKIN, { p: [0, -0.3, 0.005], s: [0.85, 1.12, 1] }),
    P(sph(0.03, 6, 4), SKIN, { p: [0.035, -0.27, 0.05] }),
  ])
  return {
    ...L,
    pelvis: merge([
      P(sph(0.17, 10, 8), NAVY, { p: [0, 0.0, 0], s: [1.25, 0.85, 0.95], lit: 0.1 }),
      P(cyl(0.2, 0.2, 0.1, 12), WHITE, { p: [0, 0.08, 0], s: [1.05, 1, 0.85] }), // obi
      box(0.1, 0.06, 0.05, RED, [0.08, 0.08, 0.17]),
    ]),
    torso: merge([
      ...torsoBase(BLUE, { fn: (c, nx, ny, nz, lx, ly, lz) => { if (lz > 0.05 && Math.abs(lx) < 0.32 - ly * 0.45 && Math.abs(lx) > 0.27 - ly * 0.45) c.setHex(WHITE) } }), // gola em V
      P(cyl(0.21, 0.2, 0.18, 12), NAVY, { p: [0, 0.27, 0], s: [1.1, 1, 0.82], lit: 0.2 }), // peitoral (dō)
      P(cyl(0.212, 0.212, 0.025, 12), GOLD, { p: [0, 0.35, 0], s: [1.1, 1, 0.82] }),
      box(0.05, 0.6, 0.04, 0x3a2a20, [0.08, 0.27, -0.2], { r: [0, 0, 0.5] }), // cordão nas costas
    ]),
    head: merge([
      ...face(HAIR),
      P(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), HAIR, { p: [0, 0.18, -0.01], lit: 0.2 }),
      P(cyl(0.2, 0.2, 0.05, 14, true), WHITE, { p: [0, 0.25, -0.005], s: [1, 1, 1.02] }), // hachimaki
      box(0.05, 0.16, 0.02, WHITE, [0.05, 0.17, -0.21], { r: [0.3, 0, 0.4] }), box(0.05, 0.16, 0.02, WHITE, [-0.03, 0.15, -0.21], { r: [0.3, 0, -0.3] }), // pontas da faixa
      P(cyl(0.035, 0.04, 0.16, 8).rotateX(Math.PI / 2), HAIR, { p: [0, 0.37, -0.02] }), // chonmage (coque)
      P(sph(0.05, 8, 6), HAIR, { p: [0, 0.37, 0.07] }),
    ]),
    // bainha da katana presa no lado esquerdo do quadril
    hipsExtra: merge([
      P(cyl(0.035, 0.03, 0.85, 8).rotateX(Math.PI / 2), 0x1f1a22, { p: [0.23, 0.0, -0.05], r: [-0.35, 0, 0] }),
      P(cyl(0.04, 0.04, 0.04, 8).rotateX(Math.PI / 2), GOLD, { p: [0.23, 0.13, 0.33], r: [-0.35, 0, 0] }),
    ]),
  }
}

// ---------------------------------------------------------------- Mago (jogador 3)
function mage() {
  const PURPLE = 0x5b3d9e, DEEP = 0x3d2870, GOLD = 0xe0b23c, HAIR = 0xd4d4e2, BOOT = 0x6a4428
  const L = limbs({ pants: 0x4a3a5a, boots: BOOT, sleeve: PURPLE, cuff: PURPLE })
  L.fore = merge([ // manga larga em sino
    P(cyl(0.065, 0.12, 0.2, 10, true), PURPLE, { p: [0, -0.1, 0], lit: 0.15 }),
    P(cyl(0.123, 0.123, 0.03, 10, true), GOLD, { p: [0, -0.2, 0] }),
    P(cap(0.055, 0.12, 8), 0x4a3a5a, { p: [0, -0.12, 0] }),
    P(sph(0.066, 8, 6), SKIN, { p: [0, -0.3, 0.005], s: [0.85, 1.12, 1] }),
    P(sph(0.03, 6, 4), SKIN, { p: [0.035, -0.27, 0.05] }),
  ])
  L.foot = merge([L.foot, P(cone(0.04, 0.12, 6).rotateX(Math.PI / 2), BOOT, { p: [0, -0.02, 0.24], r: [-0.4, 0, 0] })]) // bota de bico
  const star = (c, nx, ny, nz, lx, ly, lz) => { if (Math.sin(lx * 31 + ly * 7) * Math.sin(lz * 29 - ly * 11) > 0.82) c.setHex(GOLD) }
  return {
    ...L,
    pelvis: merge([
      P(sph(0.165, 10, 8), PURPLE, { p: [0, 0.0, 0], s: [1.2, 0.8, 0.9] }),
      P(cyl(0.2, 0.32, 0.6, 12, true), PURPLE, { p: [0, -0.26, 0], lit: 0.12, fn: star, grad: [0.75, 1] }), // saia do manto
      P(cyl(0.325, 0.325, 0.04, 12, true), GOLD, { p: [0, -0.55, 0] }),
      P(cyl(0.19, 0.19, 0.06, 12), GOLD, { p: [0, 0.08, 0], s: [1.1, 1, 0.85] }), // faixa
      P(sph(0.04, 6, 4), 0x6fe3ff, { p: [0, 0.08, 0.17] }),
    ]),
    torso: merge([
      ...torsoBase(PURPLE, { fn: star }),
      P(cyl(0.11, 0.17, 0.1, 10), DEEP, { p: [0, 0.5, 0], lit: 0.2 }), // gola alta
      P(cyl(0.172, 0.172, 0.025, 10), GOLD, { p: [0, 0.46, 0] }),
      box(0.05, 0.42, 0.03, GOLD, [0, 0.22, 0.155]), // faixa dourada na frente
      P(sph(0.3, 10, 8), DEEP, { p: [0, 0.15, -0.14], s: [0.95, 1.4, 0.35], lit: 0.1 }), // capa
    ]),
    head: merge([
      ...face(HAIR),
      P(sph(0.2, 10, 8), HAIR, { p: [0, 0.12, -0.04], s: [1.02, 1.05, 1], lit: 0.2 }), // cabelo prateado
      P(cone(0.11, 0.2, 8), HAIR, { p: [0, 0.0, 0.14], r: [Math.PI, 0, 0], s: [1, 1, 0.5] }), // barbicha
      P(cyl(0.42, 0.42, 0.03, 18), PURPLE, { p: [0, 0.3, 0], lit: 0.25 }), // aba larga
      P(cone(0.21, 0.5, 12), PURPLE, { p: [0, 0.55, -0.04], r: [-0.3, 0, 0.1], lit: 0.2, fn: star }), // chapéu pontudo
      P(cyl(0.215, 0.215, 0.06, 12, true), GOLD, { p: [0, 0.335, 0] }),
      P(sph(0.04, 6, 4), GOLD, { p: [0.03, 0.8, -0.18] }),
    ]),
  }
}

// ---------------------------------------------------------------- Bardo (jogador 4)
function bard() {
  const GREEN = 0x4f9e6a, DGREEN = 0x2f6a46, GOLD = 0xe8c050, BROWN = 0x7a5a3a, HAIR = 0xc0602a, BOOT = 0x5a3a22, RED = 0xc8463c
  const L = limbs({ pants: BROWN, boots: BOOT, sleeve: GOLD, cuff: GREEN, bootTop: 0.26 })
  L.shin = merge([L.shin, P(cyl(0.1, 0.1, 0.05, 8), 0x7a5232, { p: [0, -0.1, 0] })]) // dobra da bota
  L.upper = merge([ // manga bufante
    P(sph(0.11, 10, 8), GOLD, { p: [0, -0.1, 0], s: [1, 1.2, 1], lit: 0.2, fn: (c, nx) => { if (Math.sin(Math.atan2(nx, 0.01) * 6) > 0.4) c.setHex(GREEN) } }),
    P(cap(0.062, 0.16, 8), GREEN, { p: [0, -0.17, 0] }),
  ])
  const diamond = (c, nx, ny, nz, lx, ly) => { if (Math.abs(((lx * 9 + ly * 9) % 1 + 1) % 1 - 0.5) < 0.12 && Math.abs(((lx * 9 - ly * 9) % 1 + 1) % 1 - 0.5) < 0.12) c.setHex(GOLD) }
  return {
    ...L,
    pelvis: merge([
      P(sph(0.165, 10, 8), BROWN, { p: [0, 0.0, 0], s: [1.2, 0.8, 0.9] }),
      P(cyl(0.2, 0.25, 0.22, 12, true), GREEN, { p: [0, -0.04, 0], lit: 0.1, fn: diamond }), // barra da túnica
      P(cyl(0.19, 0.19, 0.05, 12), 0x5a3a22, { p: [0, 0.08, 0], s: [1.1, 1, 0.85] }), // cinto
      box(0.07, 0.06, 0.03, GOLD, [0, 0.08, 0.17]),
      P(sph(0.06, 6, 5), 0x8a5a32, { p: [-0.2, -0.02, 0.05], s: [1, 1.2, 0.7] }), // bolsinha de moedas
    ]),
    torso: merge([
      ...torsoBase(GREEN, { fn: diamond }),
      P(cyl(0.12, 0.15, 0.06, 10), GOLD, { p: [0, 0.49, 0] }), // gola
      P(cone(0.34, 0.68, 10, true), RED, { p: [0, 0.12, -0.2], s: [1, 1, 0.35], lit: 0.1 }), // capa curta
      box(0.04, 0.5, 0.03, 0x5a3a22, [0, 0.25, 0.165], { r: [0, 0, 0.6] }), // alça do alaúde
    ]),
    head: merge([
      ...face(HAIR),
      P(sph(0.2, 10, 8), HAIR, { p: [0, 0.13, -0.05], s: [1.04, 1, 1], lit: 0.2 }), // cabelo
      P(sph(0.06, 6, 4), HAIR, { p: [0.17, 0.08, 0.05] }), P(sph(0.06, 6, 4), HAIR, { p: [-0.17, 0.08, 0.05] }),
      P(cyl(0.24, 0.2, 0.09, 14), DGREEN, { p: [0.02, 0.32, -0.01], r: [0, 0, -0.18], lit: 0.25 }), // boina
      P(cyl(0.205, 0.205, 0.03, 14, true), GOLD, { p: [0.0, 0.28, -0.01], r: [0, 0, -0.18] }),
      P(cone(0.04, 0.5, 6), RED, { p: [0.18, 0.42, -0.2], r: [-1.0, 0, -0.5], s: [1, 1, 0.4] }), // pena
    ]),
  }
}

const cache = new Map()
export const LOOK = (cls) => {
  if (!cache.has(cls)) cache.set(cls, ({ gunner, samurai, mage, bard })[cls]())
  return cache.get(cls)
}
