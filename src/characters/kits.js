import * as THREE from 'three'
import { MAT, P, merge, box, sph, cyl, cone } from '../world/style'

// "Kit" de cada classe: o objeto que ela segura (armas, katana, cajado, alaúde) e as POSES desse objeto.
// A animação é guiada pelo objeto: o kit diz onde o objeto está (no espaço do corpo, olhando para +Z)
// e onde ficam as empunhaduras; as mãos chegam lá por IK de dois ossos (player.js).
//
// pose(st, o) preenche:
//   o.pos / o.quat       posição e rotação do objeto (espaço do corpo)
//   o.rGrip / o.lGrip    empunhaduras (espaço do objeto)     o.rW / o.lW   peso de cada mão no objeto (0 = braço livre)
//   o.hold + o.holdQuat  objeto "na mão": segue a mão direita (andando com a pistola baixa, cajado de bengala)
//   o.rT / o.rTarget     alvo livre da mão direita (espaço do corpo), ex.: lançar granada
//   o.lT / o.lTarget     idem mão esquerda (pegar carregador no cinto)
//   o.spineX/Y/Z, o.crouch, o.yaw (giro extra do corpo), o.armsUp

const V = (x, y, z) => new THREE.Vector3(x, y, z)
const E = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'))
const BLADE = (yaw, pitch, roll = 0) => E(-pitch, yaw, roll) // lâmina ao longo de +Z: guinada e elevação
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const smooth = (t) => t * t * (3 - 2 * t)
export const bump = (k, a = 0, b = 1) => { const t = clamp((k - a) / (b - a), 0, 1); return Math.sin(t * Math.PI) }

// trilha de quadros-chave: [k, [x,y,z], quat, { valores extras }]
function track(keys) {
  const ks = keys.map(([k, p, q, x = {}]) => ({ k, p: V(...p), q, x }))
  return (k, o) => {
    let i = 0
    while (i < ks.length - 2 && k > ks[i + 1].k) i++
    const a = ks[i], b = ks[i + 1], t = smooth(clamp((k - a.k) / (b.k - a.k || 1), 0, 1))
    o.pos.lerpVectors(a.p, b.p, t)
    o.quat.slerpQuaternions(a.q, b.q, t)
    for (const n in b.x) o[n] += (a.x[n] ?? 0) + ((b.x[n] ?? 0) - (a.x[n] ?? 0)) * t
    for (const n in a.x) if (!(n in b.x)) o[n] += a.x[n] * (1 - t)
  }
}

// roda uma trilha por cima da pose atual, entrando e saindo suave (sem "pulo" se a ação começa de outra pose)
const _bp = V(0, 0, 0), _bq = new THREE.Quaternion()
function play(trk, k, o, edge = 0.12) {
  _bp.copy(o.pos); _bq.copy(o.quat)
  trk(k, o)
  const w = smooth(clamp(Math.min(k, 1 - k) / edge, 0, 1))
  o.pos.lerpVectors(_bp, o.pos, w); o.quat.slerpQuaternions(_bq, o.quat, w)
  return w
}

const flashGeo = new THREE.OctahedronGeometry(0.11, 0)
function muzzleAt(parent, z, y = 0) {
  const m = new THREE.Object3D(); m.position.set(0, y, z)
  const f = new THREE.Mesh(flashGeo, MAT.flash); f.position.set(0, y, z + 0.08); f.visible = false
  parent.add(m, f)
  return { m, f }
}

// ================================================================ ATIRADOR
const GUN = 0x3a404e, WOOD = 0xa8693a
const pistolGeo = merge([ // origem = centro da mão; cano para +Z
  box(0.055, 0.075, 0.24, GUN, [0, 0.07, 0.07], { lit: 0.25 }),
  box(0.05, 0.13, 0.075, 0x2a2420, [0, -0.0, -0.005], { r: [0.25, 0, 0] }),
  box(0.02, 0.03, 0.03, 0xff8a3d, [0, 0.12, 0.17]),
])
const carbineGeo = merge([ // origem = empunhadura (mão direita); coronha para trás, cano para frente
  box(0.075, 0.11, 0.42, GUN, [0, 0.06, 0.08], { lit: 0.25 }),
  box(0.07, 0.13, 0.3, WOOD, [0, 0.03, -0.24], { lit: 0.2 }), // coronha
  box(0.08, 0.09, 0.26, WOOD, [0, 0.04, 0.28], { lit: 0.2 }), // guarda-mão
  P(cyl(0.02, 0.02, 0.24, 6).rotateX(Math.PI / 2), 0xb8bfcc, { p: [0, 0.07, 0.5] }),
  box(0.055, 0.17, 0.08, 0x2a2f3a, [0, -0.07, 0.13], { r: [0.2, 0, 0] }), // carregador
  box(0.05, 0.11, 0.06, 0x2a2420, [0, -0.04, -0.01], { r: [0.3, 0, 0] }), // punho
  box(0.04, 0.05, 0.1, 0xff8a3d, [0, 0.14, 0.06]), // mira
])
const shotgunGeo = merge([
  box(0.08, 0.1, 0.3, GUN, [0, 0.06, 0.05], { lit: 0.25 }),
  box(0.075, 0.14, 0.34, 0x7a4a26, [0, 0.02, -0.26], { lit: 0.2 }),
  P(cyl(0.032, 0.032, 0.56, 8).rotateX(Math.PI / 2), 0x55606e, { p: [0, 0.09, 0.44] }),
  P(cyl(0.026, 0.026, 0.42, 8).rotateX(Math.PI / 2), 0x2f3540, { p: [0, 0.03, 0.4] }), // tubo
  box(0.085, 0.085, 0.16, 0x7a4a26, [0, 0.03, 0.32], { lit: 0.2 }), // telha (pump)
  box(0.05, 0.11, 0.06, 0x2a2420, [0, -0.04, -0.02], { r: [0.3, 0, 0] }),
])
const grenadeGeo = merge([P(sph(0.065, 8, 6), 0x55663a, { lit: 0.2 }), box(0.03, 0.04, 0.03, 0x9aa0aa, [0, 0.07, 0])])
export const GRENADE_GEO = grenadeGeo

function gunner(holder, bones) {
  const mk = (geo, z, y) => { const g = new THREE.Group(); g.add(new THREE.Mesh(geo, MAT.solid)); holder.add(g); return { g, ...muzzleAt(g, z, y) } }
  const W = { pistol: mk(pistolGeo, 0.2, 0.07), carbine: mk(carbineGeo, 0.63, 0.07), shotgun: mk(shotgunGeo, 0.73, 0.09) }
  const nade = new THREE.Mesh(grenadeGeo, MAT.solid)
  nade.position.set(0, -0.32, 0.04); nade.visible = false
  bones.handR.add(nade)
  let cur = 'carbine', pump = 0
  const lowQ = E(0.6, 0.55, 0.3), aimQ = E(0, 0, 0), pistolDown = E(1.25, 0, 0)
  const rifleKeys = { reload: track([
    [0, [-0.12, 1.36, 0.32], aimQ],
    [0.2, [-0.08, 1.2, 0.3], E(0.25, 0.2, 0.55)],
    [0.8, [-0.08, 1.2, 0.3], E(0.25, 0.2, 0.55)],
    [1, [-0.12, 1.36, 0.32], aimQ],
  ]) }
  const tmp = V(0, 0, 0)
  return {
    setWeapon(w) { cur = w; for (const k in W) W[k].g.visible = k === w },
    muzzle: (v) => W[cur].m.getWorldPosition(v),
    flash: (on) => { for (const k in W) W[k].f.visible = on && k === cur },
    kick() { if (cur === 'shotgun') pump = 1 },
    pose(st, o) {
      const a = st.aimW, act = st.act, k = st.ak
      pump = Math.max(0, pump - st.dt * 2.6)
      nade.visible = act === 'throw' && k < 0.55
      if (cur === 'pistol') {
        o.pos.set(-0.06, 1.4, 0.5); o.quat.copy(aimQ)
        o.pos.z -= st.recoil * 0.06; o.quat.multiply(E(-st.recoil * 0.35, 0, 0))
        o.rGrip.set(0, 0, 0); o.lGrip.set(0.04, -0.05, -0.03)
        o.hold = 1 - a; o.holdQuat.copy(pistolDown).multiply(E(-st.armR * 0.6, 0, 0))
        o.rW = a; o.lW = a * 0.95
        o.spineY += a * 0.1
      } else {
        // fuzil: "pronto baixo" andando (cano apontado para o chão, cruzando o corpo) e na mira com a coronha no ombro
        tmp.set(-0.12, 1.06 + st.bob, 0.3)
        o.pos.set(-0.12, 1.36, 0.32).lerp(tmp, 1 - a)
        o.quat.slerpQuaternions(lowQ, aimQ, a)
        o.pos.z -= st.recoil * 0.08; o.quat.multiply(E(-st.recoil * 0.22, 0, 0))
        o.rGrip.set(0, -0.03, 0)
        o.lGrip.set(0, 0, cur === 'shotgun' ? 0.32 - bump(1 - pump) * 0.12 : 0.27) // espingarda: a mão esquerda bombeia depois do tiro
        o.rW = 1; o.lW = 1
        o.spineY += a * 0.38; o.spineX += a * 0.04 // corpo de lado na mira: o ombro esquerdo vai à frente
        o.neckY -= a * 0.3
      }
      if (act === 'reload') {
        if (cur !== 'pistol') play(rifleKeys.reload, k, o)
        else { o.hold = 0; o.rW = 1; o.pos.set(-0.05, 1.22, 0.36); o.quat.copy(E(-0.5, 0.3, 0)) }
        // mão esquerda: cinto -> encaixe do carregador -> volta
        o.lT = bump(k, 0.08, 0.9)
        const toBelt = clamp((k - 0.1) / 0.25, 0, 1), back = clamp((k - 0.45) / 0.3, 0, 1)
        o.lTarget.set(0.14, 0.98, 0.16).lerp(V(-0.06, 1.13, 0.4), smooth(back))
        if (toBelt < 1) o.lTarget.lerp(V(-0.1, 1.15, 0.45), 1 - smooth(toBelt))
        o.spineX += 0.12 * bump(k); o.neckX += 0.35 * bump(k)
      } else if (act === 'throw') {
        // granada por cima do ombro; o fuzil fica só na mão esquerda
        o.rW = 0; o.hold = 0
        if (cur === 'pistol') { o.pos.set(0.15, 1.05, 0.25); o.quat.copy(E(1.2, 0.3, 0)); o.lW = 0 }
        else { o.pos.set(0.05, 1.05, 0.28); o.quat.copy(lowQ) }
        o.rT = 1
        if (k < 0.4) o.rTarget.set(-0.2, 1.4, 0.2).lerp(V(-0.34, 1.82, -0.22), smooth(k / 0.4))
        else if (k < 0.55) o.rTarget.set(-0.34, 1.82, -0.22).lerp(V(-0.12, 1.58, 0.52), smooth((k - 0.4) / 0.15))
        else o.rTarget.set(-0.12, 1.58, 0.52).lerp(V(0.08, 1.02, 0.36), smooth((k - 0.55) / 0.45))
        o.spineY += k < 0.4 ? -0.55 * smooth(k / 0.4) : -0.55 + 1.0 * smooth(clamp((k - 0.4) / 0.25, 0, 1))
        o.spineX += 0.25 * bump(k, 0.35, 1)
      } else if (act === 'swap') {
        o.pos.y -= 0.32 * bump(k); o.quat.multiply(E(0.9 * bump(k), 0, 0))
      }
    },
  }
}

// ================================================================ SAMURAI
const katanaGeo = merge([ // origem = mão direita; lâmina ao longo de +Z
  P(cyl(0.024, 0.026, 0.27, 8).rotateX(Math.PI / 2), 0x1a1820, { p: [0, 0, -0.06] }), // cabo
  ...[-0.15, -0.09, -0.03, 0.03].map((z) => box(0.055, 0.055, 0.015, 0xf0ece0, [0, 0, z], { r: [0, 0, 0.78] })), // amarração
  P(cyl(0.065, 0.065, 0.02, 10).rotateX(Math.PI / 2), 0xd9b44a, { p: [0, 0, 0.085] }), // tsuba
  box(0.018, 0.05, 0.78, 0xe6edf6, [0, 0.005, 0.48], { lit: 0.35, fn: (c, nx, ny, nz, lx, ly) => { if (ly < -0.005) c.multiplyScalar(1.12) } }), // lâmina
  P(cone(0.026, 0.1, 4).rotateX(Math.PI / 2), 0xe6edf6, { p: [0, 0.005, 0.92], s: [0.7, 1, 1] }),
  box(0.02, 0.02, 0.3, 0xb8c2d0, [0, 0.03, 0.3]),
])

function samurai(holder) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(katanaGeo, MAT.solid))
  holder.add(g)
  const tip = new THREE.Object3D(); tip.position.set(0, 0, 0.9); g.add(tip)
  const guardP = [-0.06, 1.14, 0.36], guardQ = BLADE(0.08, 0.85)
  const relaxQ = E(0.75, 0.25, 0)
  const T = {
    slash1: track([
      [0, guardP, guardQ],
      [0.32, [-0.34, 1.64, 0.04], BLADE(-1.25, 1.05, -0.4), { spineY: -0.55, spineX: -0.08 }],
      [0.5, [-0.04, 1.3, 0.5], BLADE(-0.1, 0.05, -0.9), { spineY: 0.15, spineX: 0.12 }],
      [0.72, [0.32, 0.96, 0.32], BLADE(1.35, -0.55, -1.2), { spineY: 0.6, spineX: 0.18, crouch: -0.08 }],
      [1, guardP, guardQ],
    ]),
    slash2: track([
      [0, guardP, guardQ],
      [0.3, [0.26, 1.0, 0.26], BLADE(1.45, -0.45, 0.8), { spineY: 0.55, crouch: -0.06 }],
      [0.5, [0.0, 1.26, 0.5], BLADE(0.1, 0.15, 1.2), { spineY: -0.1, spineX: 0.1 }],
      [0.72, [-0.36, 1.58, 0.2], BLADE(-1.35, 0.65, 1.4), { spineY: -0.6, spineX: -0.05 }],
      [1, guardP, guardQ],
    ]),
    slash3: track([
      [0, guardP, guardQ],
      [0.36, [-0.04, 1.86, -0.02], BLADE(0, 2.05), { spineX: -0.22, crouch: 0.02 }],
      [0.55, [-0.02, 1.3, 0.52], BLADE(0, 0.0), { spineX: 0.38, crouch: -0.12 }],
      [0.75, [0, 0.92, 0.44], BLADE(0, -0.8), { spineX: 0.32, crouch: -0.14 }],
      [1, guardP, guardQ],
    ]),
  }
  return {
    setWeapon() {},
    muzzle: (v) => tip.getWorldPosition(v),
    flash() {},
    kick() {},
    pose(st, o) {
      const a = st.aimW, act = st.act, k = st.ak
      o.pos.set(...guardP); o.quat.copy(guardQ)
      o.rGrip.set(0, 0, 0); o.lGrip.set(0, 0, -0.13)
      o.hold = 1 - a; o.holdQuat.copy(relaxQ).multiply(E(-st.armR * 0.5, 0, 0))
      o.rW = a; o.lW = a
      o.crouch += a * -0.05; o.spineX += a * 0.06
      if (T[act]) {
        const w = play(T[act], k, o, 0.1)
        o.hold *= 1 - w; o.rW += (1 - o.rW) * w; o.lW += ((act === 'slash2' ? 1 - bump(k, 0.2, 1) : 1) - o.lW) * w
      }
      else if (act === 'dash') {
        o.hold = 0; o.rW = 1; o.lW = 0
        o.pos.set(-0.3, 1.02, -0.05); o.quat.copy(BLADE(-2.7, -0.35))
        o.spineX += 0.55 * bump(k, 0, 1.4); o.crouch -= 0.18 * bump(k, 0, 1.2)
        o.lT = 1; o.lTarget.set(0.42, 1.12, -0.2)
      } else if (act === 'spin') {
        o.hold = 0; o.rW = 1; o.lW = 0
        o.pos.set(-0.42, 1.22, 0.22); o.quat.copy(BLADE(-1.45, -0.05))
        o.yaw += Math.PI * 2 * smooth(clamp(k / 0.85, 0, 1))
        o.crouch -= 0.14 * bump(k)
        o.lT = 1; o.lTarget.set(0.5, 1.25, 0.05)
      }
    },
  }
}

// ================================================================ MAGO
const staffGeo = merge([ // origem = mão direita; cajado ao longo de +Y
  P(cyl(0.028, 0.034, 1.5, 7), 0x8a5a30, { p: [0, -0.02, 0], lit: 0.15, grad: [0.8, 1.05] }),
  ...[0.18, -0.3].map((y) => P(cyl(0.04, 0.04, 0.04, 8), 0xe0b23c, { p: [0, y, 0] })),
  P(cyl(0.035, 0.07, 0.12, 6), 0x6a4022, { p: [0, 0.76, 0] }), // garra
  ...[0, 2.1, 4.2].map((a) => box(0.02, 0.16, 0.02, 0x6a4022, [Math.sin(a) * 0.06, 0.86, Math.cos(a) * 0.06], { r: [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4] })),
])
const crystalGeo = merge([P(new THREE.OctahedronGeometry(0.085, 0), 0xffd86a, { p: [0, 0.9, 0], s: [1, 1.5, 1] })])

function mage(holder) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(staffGeo, MAT.solid))
  const crystal = new THREE.Mesh(crystalGeo, MAT.glow)
  g.add(crystal)
  holder.add(g)
  const tip = new THREE.Object3D(); tip.position.set(0, 0.9, 0); g.add(tip)
  const aimP = [-0.2, 1.24, 0.32], aimQ = E(0.55, 0, 0)
  const T = {
    cast: track([[0, aimP, aimQ], [0.35, [-0.16, 1.3, 0.52], E(1.15, 0, 0), { spineX: 0.12 }], [1, aimP, aimQ]]),
    meteor: track([
      [0, aimP, aimQ],
      [0.55, [-0.02, 1.86, 0.1], E(-0.15, 0, 0), { spineX: -0.22, armsUp: 1 }],
      [0.72, [-0.04, 1.38, 0.56], E(1.3, 0, 0), { spineX: 0.35, crouch: -0.1 }],
      [1, aimP, aimQ],
    ]),
    nova: track([
      [0, aimP, aimQ],
      [0.35, [0, 1.5, 0.34], E(0, 0, 0), { spineX: -0.1 }],
      [0.55, [0, 0.98, 0.42], E(0.05, 0, 0), { spineX: 0.3, crouch: -0.26 }],
      [1, aimP, aimQ],
    ]),
  }
  return {
    setWeapon() {},
    muzzle: (v) => tip.getWorldPosition(v),
    flash() {},
    kick() {},
    pose(st, o) {
      const a = st.aimW
      o.pos.set(...aimP); o.quat.copy(aimQ)
      o.rGrip.set(0, 0, 0); o.lGrip.set(0, -0.27, 0)
      o.hold = 1 - a; o.holdQuat.copy(E(0.12 - st.armR * 0.55, 0, 0))
      o.rW = a; o.lW = a
      crystal.scale.setScalar(1 + Math.sin(st.t * 5) * 0.08 + st.recoil * 0.5)
      if (T[st.act]) { const w = play(T[st.act], st.ak, o, 0.15); o.hold *= 1 - w; o.rW += (1 - o.rW) * w; o.lW += (1 - o.lW) * w }
    },
  }
}

// ================================================================ BARDO
const luteGeo = merge([ // origem = centro do corpo; braço do alaúde para +Y, cordas para +Z
  P(sph(0.2, 12, 10), 0xc4843e, { s: [1, 1.25, 0.55], lit: 0.2, fn: (c, nx, ny, nz) => { if (nz < -0.3) c.multiplyScalar(0.7) } }),
  P(cyl(0.065, 0.065, 0.02, 12).rotateX(Math.PI / 2), 0x3a2414, { p: [0, 0.03, 0.105] }), // boca
  box(0.06, 0.5, 0.03, 0x6a4022, [0, 0.42, 0.06]), // braço
  box(0.08, 0.14, 0.04, 0x5a341a, [0, 0.72, 0.03], { r: [-0.5, 0, 0] }), // cabeça (cravelhas)
  ...[-0.015, 0, 0.015].map((x) => box(0.004, 0.62, 0.005, 0xf6eedb, [x, 0.33, 0.112])), // cordas
  box(0.09, 0.03, 0.02, 0x3a2414, [0, -0.13, 0.1]), // cavalete
])

function bard(holder) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(luteGeo, MAT.solid))
  holder.add(g)
  const hole = new THREE.Object3D(); hole.position.set(0, 0.03, 0.12); g.add(hole)
  const backQ = E(0, Math.PI, 0.75), playQ = E(-0.2, 0.18, -1.05), tmp = V(0, 0, 0)
  const T = {
    song: track([
      [0, [-0.02, 1.13, 0.25], playQ],
      [0.25, [0, 1.58, 0.32], E(-0.85, 0, -0.55), { spineX: -0.3 }],
      [0.8, [0, 1.58, 0.32], E(-0.85, 0, -0.55), { spineX: -0.3 }],
      [1, [-0.02, 1.13, 0.25], playQ],
    ]),
    courage: track([
      [0, [-0.02, 1.13, 0.25], playQ],
      [0.35, [0, 2.0, 0.12], E(-0.2, 0, -1.5), { spineX: -0.18, armsUp: 1 }],
      [0.75, [0, 2.0, 0.12], E(-0.2, 0, -1.5), { spineX: -0.18, armsUp: 1 }],
      [1, [-0.02, 1.13, 0.25], playQ],
    ]),
  }
  return {
    setWeapon() {},
    muzzle: (v) => hole.getWorldPosition(v),
    flash() {},
    kick() {},
    pose(st, o) {
      const a = st.aimW
      tmp.set(0.02, 1.2 + st.bob, -0.25)
      o.pos.set(-0.02, 1.13, 0.25).lerp(tmp, 1 - a)
      o.quat.slerpQuaternions(backQ, playQ, a)
      const strum = Math.sin(st.t * 26) * 0.055 * a
      o.rGrip.set(0, -0.03 + strum, 0.1); o.lGrip.set(0, 0.4 + Math.sin(st.t * 3) * 0.04, 0.07)
      o.rW = a; o.lW = a
      o.neckX += Math.sin(st.t * 9) * 0.05 * a // balança a cabeça no ritmo
      if (T[st.act]) { const w = play(T[st.act], st.ak, o, 0.2); o.rW += (1 - o.rW) * w; o.lW += (1 - o.lW) * w; o.spineY += Math.sin(st.t * 7) * 0.15 * w }
    },
  }
}

export const KITS = { gunner, samurai, mage, bard }
