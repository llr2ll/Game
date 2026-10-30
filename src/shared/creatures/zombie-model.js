import * as THREE from 'three'
import { MAT, P, merge, box, sph, cyl, cap } from '../../engine/render/style'
import { SoleDepth } from '../characters/player'

// Zumbi articulado (mesmas medidas do jogador, ver characters/looks.js), 9 malhas fundidas com cor por vértice:
//   root (posição + direção)
//    └ body (queda: gira em volta dos pés)
//       └ hips ─ coxa > joelho (canela + sapato) (x2) ─ spine ─ pescoço/cabeça, ombro > braço inteiro (x2)
// Animação procedural guiada pelo estado da IA (zombies.js): arrasta os pés mancando, braços estendidos na
// perseguição, bote, agarrão com mordida, tropeço, queda de costas/de bruços, levantar, comer o corpo, morrer.
const B = { hipY: 0.86, legX: 0.1, legY: -0.04, knee: 0.38, spineY: 0.1, shX: 0.24, shY: 0.44, neckY: 0.54 }
export const GETUP_T = 0.9

const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const lerp = (a, b, t) => a + (b - a) * t
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt))
const smooth = (t) => t * t * (3 - 2 * t)

// ---------------------------------------------------------------- visual (variações de roupa, pele, sangue)
const SKINS = [0x9fae86, 0xb3b49b, 0x8e9b7a, 0xa79f8a, 0x8a977f, 0xbdb59f]
const SHIRTS = [0x4f6f94, 0x9c4636, 0xcfc6ab, 0x657447, 0x45454e, 0xbf9238, 0x6e5480, 0x3f7a74, 0xb8b4ac]
const PANTS = [0x34456a, 0x56463a, 0x2c2c33, 0x857b62, 0x4a5a3a, 0x2f3d58]
const HAIR = [null, 0x2e2118, 0x6e5232, 0x1c1c20, 0xa49c88, 0x8a4a2a, null]
const BLOOD = new THREE.Color(0x5e1612), DIRT = new THREE.Color(0x4a3e30), GORE = 0x7a1c16
export const VARIANTS = 12

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const hash = (x, y, z, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.3) * 43758.5453; return v - Math.floor(v) }
// sujeira por triângulo (visual facetado): manchas de sangue, terra e rasgos que mostram a pele
const grime = (seed, blood, dirt, hole = 0, skin = 0) => (c, cx, cy, cz) => {
  const h = hash(cx, cy, cz, seed)
  if (h < hole) c.set(skin).multiplyScalar(0.8)
  else if (h < hole + blood) c.lerp(BLOOD, 0.7)
  else if (h < hole + blood + dirt) c.lerp(DIRT, 0.35)
}

function variant(i) {
  const R = rng(i * 7919 + 13), pick = (a) => a[Math.floor(R() * a.length)]
  const skin = pick(SKINS), shirt = pick(SHIRTS), pants = pick(PANTS), hair = pick(HAIR), shoes = R() < 0.5 ? 0x2a2420 : 0x6a5a4a
  const short = R() < 0.5, bald = !hair, gash = R() < 0.6, s = i * 1.37
  const cloth = grime(s, 0.16 + R() * 0.14, 0.18, 0.06, skin), legs = grime(s + 3, 0.08, 0.25, 0.04, skin), flesh = grime(s + 7, 0.1, 0.12)
  const head = [
    P(sph(0.185, 12, 9), skin, { p: [0, 0.17, 0.01], s: [0.95, 1.05, 1], lit: 0.12, tri: flesh }),
    P(cyl(0.11, 0.09, 0.09, 8), skin, { p: [0, 0.03, 0.06], lit: 0.1, tri: flesh }), // queixo caído
    box(0.1, 0.055, 0.04, 0x34100e, [0, 0.075, 0.155]), // boca aberta
    box(0.08, 0.014, 0.014, 0xd8ceb0, [0, 0.1, 0.17]), // dentes
    P(sph(0.026, 6, 4), skin, { p: [0, 0.155, 0.19], s: [0.9, 1, 1.1], fn: (c) => c.multiplyScalar(0.85) }), // nariz
  ]
  for (const k of [-1, 1]) {
    head.push(
      P(sph(0.042, 6, 4), 0x3c3a2e, { p: [k * 0.068, 0.2, 0.158], s: [1, 0.85, 0.5] }), // olheira funda
      P(sph(0.024, 6, 4), 0xeee6b8, { p: [k * 0.068, 0.2, 0.175], s: [1, 0.85, 0.6] }), // olho leitoso
      P(sph(0.042, 6, 5), skin, { p: [k * 0.18, 0.16, 0], s: [0.5, 1, 0.8] }), // orelha
    )
  }
  if (!bald) head.push(P(new THREE.SphereGeometry(0.195, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.46), hair, { p: [0, 0.18, -0.01], s: [0.97, 1, 1.02], tri: grime(s + 9, 0, 0, 0.2, skin) }))
  if (gash) head.push(P(sph(0.05, 6, 4), GORE, { p: [R() < 0.5 ? 0.11 : -0.11, 0.26, 0.11], s: [1, 0.55, 0.5] }))
  return {
    pelvis: merge([
      P(sph(0.165, 10, 8), pants, { p: [0, 0, 0], s: [1.2, 0.8, 0.9], lit: 0.1, tri: legs }),
      P(cyl(0.18, 0.18, 0.06, 12), 0x2e2620, { p: [0, 0.08, 0], s: [1.1, 1, 0.85] }), // cinto
    ]),
    thigh: merge([P(cap(0.088, 0.22, 8), pants, { p: [0, -0.19, 0], lit: 0.12, grad: [0.85, 1.05], tri: legs })]),
    shin: merge([
      P(cap(0.074, 0.22, 8), pants, { p: [0, -0.18, 0], lit: 0.12, tri: legs }),
      box(0.13, 0.1, 0.25, shoes, [0, -0.415, 0.05], { lit: 0.2 }),
      box(0.135, 0.025, 0.27, 0x221c1a, [0, -0.455, 0.05]), // sola
    ]),
    torso: merge([
      P(cap(0.19, 0.2, 10), shirt, { p: [0, 0.24, 0], s: [1.15, 1, 0.82], lit: 0.18, grad: [0.8, 1.05], tri: cloth }),
      P(sph(0.095, 8, 6), shirt, { p: [0.22, 0.42, 0], lit: 0.2, tri: cloth }), P(sph(0.095, 8, 6), shirt, { p: [-0.22, 0.42, 0], lit: 0.2, tri: cloth }),
      P(cyl(0.062, 0.07, 0.12, 8), skin, { p: [0, 0.54, 0] }), // pescoço
      P(sph(0.07, 6, 4), GORE, { p: [R() < 0.5 ? 0.1 : -0.12, 0.2 + R() * 0.15, 0.17], s: [1, 0.8, 0.4] }), // ferida aberta
    ]),
    head: merge(head),
    arm: merge([ // braço inteiro (ombro em 0, mão em -0.62), cai em -Y
      P(cap(0.068, 0.2, 7), shirt, { p: [0, -0.15, 0], lit: 0.15, tri: cloth }),
      P(cap(0.058, 0.2, 7), short ? skin : shirt, { p: [0, -0.42, 0.01], lit: 0.15, tri: short ? flesh : cloth }),
      P(sph(0.064, 8, 6), skin, { p: [0, -0.62, 0.015], s: [0.85, 1.2, 0.9], tri: flesh }),
      box(0.075, 0.07, 0.03, skin, [0, -0.695, 0.03], { r: [0.3, 0, 0] }), // dedos em garra
    ]),
  }
}
const VARS = []
// toco de carne (ombro, pescoço, joelho) que aparece quando a parte é arrancada: carne + osso
let STUMP = null
const stumpGeo = () => (STUMP ||= merge([
  P(sph(0.075, 8, 6), GORE, { p: [0, 0, 0], s: [1, 0.7, 1], tri: (c, cx, cy, cz) => { if (hash(cx, cy, cz, 5) < 0.4) c.multiplyScalar(0.7) } }),
  P(cyl(0.022, 0.026, 0.07, 6), 0xe8dcc0, { p: [0, 0.035, 0] }),
]))

// ---------------------------------------------------------------- rig + animação
export function CreateZombieModel(v = 0) {
  const g = (VARS[v] ||= variant(v))
  const R = Math.random
  const mesh = (geo) => new THREE.Mesh(geo, MAT.solid)
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o }

  const root = new THREE.Group()
  const body = grp(root)
  body.rotation.order = 'YXZ'
  const hips = grp(body, 0, B.hipY, 0)
  hips.rotation.order = 'YXZ'
  hips.add(mesh(g.pelvis))
  const leg = (s) => {
    const thigh = grp(hips, s * B.legX, B.legY, 0); thigh.add(mesh(g.thigh))
    const knee = grp(thigh, 0, -B.knee, 0); knee.add(mesh(g.shin))
    return { thigh, knee, s }
  }
  const legs = [leg(1), leg(-1)]
  const knees = legs.map((L) => L.knee) // a canela leva o sapato
  const spine = grp(hips, 0, B.spineY, 0)
  spine.rotation.order = 'YXZ'
  spine.add(mesh(g.torso))
  const neck = grp(spine, 0, B.neckY, 0)
  neck.rotation.order = 'YXZ'
  neck.add(mesh(g.head))
  const arm = (s) => { const sh = grp(spine, s * B.shX, B.shY, 0); sh.add(mesh(g.arm)); return { sh, s } }
  const arms = [arm(1), arm(-1)]

  // partes que podem ser arrancadas: malha escondida no osso + toco no lugar; dir = para onde o toco espirra
  const stump = (parent, flip) => { const m = mesh(stumpGeo()); if (flip) m.rotation.x = Math.PI; m.visible = false; parent.add(m); return m }
  const parts = {
    head: { bone: neck, mesh: neck.children[0], stump: stump(neck, false), dir: new THREE.Vector3(0, 1, 0) },
    armL: { bone: arms[0].sh, mesh: arms[0].sh.children[0], stump: stump(arms[0].sh, true), dir: new THREE.Vector3(0, -1, 0) },
    armR: { bone: arms[1].sh, mesh: arms[1].sh.children[0], stump: stump(arms[1].sh, true), dir: new THREE.Vector3(0, -1, 0) },
    legL: { bone: legs[0].knee, mesh: legs[0].knee.children[0], stump: stump(legs[0].thigh, true), dir: new THREE.Vector3(0, -1, 0) },
    legR: { bone: legs[1].knee, mesh: legs[1].knee.children[0], stump: stump(legs[1].thigh, true), dir: new THREE.Vector3(0, -1, 0) },
  }
  parts.legL.stump.position.y = parts.legR.stump.position.y = -B.knee
  // arranca: devolve a parte (para virar pedaço solto) ou null se já não tinha
  function sever(name) {
    const pt = parts[name]
    if (!pt || !pt.mesh.visible) return null
    root.updateMatrixWorld(true)
    pt.mesh.visible = false
    pt.stump.visible = true
    return pt
  }
  function restore() { for (const k in parts) { parts[k].mesh.visible = true; parts[k].stump.visible = false } }
  const has = (name) => parts[name].mesh.visible

  // jeito de cada um: manca de uma perna, curvado, cabeça caída para um lado, quantos braços estende
  const limp = R() < 0.45 ? 0.4 + R() * 0.6 : 0
  const hunch = 0.12 + R() * 0.3, tilt = (R() - 0.5) * 0.7, reach = R() < 0.2 ? 1 : 2, seed = R() * 10
  let t = R() * 10, phase = R() * 6, moveW = 0, reachW = 0, lungeW = 0, grabW = 0, staggerW = 0, crouchW = 0, fall = 0, flinch = 0

  function animate(dt, e) {
    t += dt
    const s = e.state, sp = e.vel
    moveW = damp(moveW, clamp(sp / 1.1, 0, 1), 8, dt)
    reachW = damp(reachW, s === 'chase' || s === 'lunge' || s === 'grab' ? 1 : 0, 4, dt)
    lungeW = damp(lungeW, s === 'lunge' ? 1 : 0, 14, dt)
    grabW = damp(grabW, s === 'grab' ? 1 : 0, 10, dt)
    staggerW = damp(staggerW, s === 'stagger' ? 1 : 0, 14, dt)
    crouchW = damp(crouchW, s === 'feed' ? 1 : 0, 3, dt)
    flinch = Math.max(e.hitT || 0, flinch - dt * 6)
    // deitado: cai acelerando; ao levantar segue o tempo do estado
    const lying = s === 'down' || s === 'dead' ? 1 : s === 'getup' ? 1 - smooth(clamp(e.stT / GETUP_T, 0, 1)) : 0
    fall = lying > fall ? Math.min(lying, fall + dt * (1.2 + fall * 6)) : lying
    const still = fall > 0.9 && s === 'dead' ? 0 : 1 // morto não se mexe mais

    // ---- passada arrastada: avança pela distância andada ----
    const stride = 0.4 + 0.3 * clamp(sp / 3.2, 0, 1)
    phase += (sp * dt / stride) * Math.PI
    const A = moveW * (0.42 + 0.3 * clamp(sp / 3.2, 0, 1)) * (1 - fall)
    const sn = Math.sin(phase)

    for (const L of legs) {
      const lame = L.s < 0 ? limp : 0
      const ph = L.s > 0 ? phase : phase + Math.PI
      const swing = Math.max(0, Math.cos(ph))
      let tx = -A * Math.sin(ph) * (1 - lame * 0.6) - 0.04
      let kn = 0.1 + A * 0.65 * (1 - lame * 0.85) * Math.pow(swing, 1.5)
      // tropeçando: pernas abertas, uma para trás
      tx += staggerW * (L.s > 0 ? 0.35 : -0.3); kn += staggerW * 0.25
      // ajoelhado comendo
      tx = lerp(tx, L.s > 0 ? -1.55 : -0.35, crouchW); kn = lerp(kn, L.s > 0 ? 1.6 : 2.3, crouchW)
      // deitado: pernas soltas, um joelho dobrado
      tx = lerp(tx, L.s > 0 ? 0.05 : -0.35, fall); kn = lerp(kn, L.s > 0 ? 0.08 : 0.7, fall)
      L.thigh.rotation.x = tx
      L.thigh.rotation.z = L.s * (0.04 + lame * 0.05 + staggerW * 0.15 + fall * 0.1)
      L.knee.rotation.x = kn
    }

    // ---- quadril: desce na perna manca, balança de lado ----
    hips.position.y = lerp(B.hipY - A * 0.05 * Math.abs(sn) - limp * 0.05 * Math.max(0, -sn) * moveW, 0.45, crouchW)
    hips.rotation.z = (0.08 * A + limp * 0.08 * moveW) * sn
    hips.rotation.y = -0.12 * A * sn

    // ---- tronco e cabeça ----
    const bite = e.bite || 0
    spine.rotation.x = hunch + 0.08 * moveW + lungeW * 0.35 + grabW * 0.3 + bite * 0.2 - staggerW * 0.5 + crouchW * 0.55 - flinch * 2.2 * still - fall * hunch
    spine.rotation.z = -hips.rotation.z * 0.4 + tilt * 0.25 + staggerW * Math.sin(t * 9) * 0.15 + grabW * Math.sin(t * 17) * 0.04
    spine.rotation.y = 0.15 * A * sn
    neck.rotation.x = (-hunch * 0.7 - reachW * 0.15 + crouchW * 0.25 + Math.sin(t * 1.3 + seed) * 0.06 + bite * 0.55 + crouchW * Math.max(0, Math.sin(t * 6)) * 0.3 - flinch) * still * (1 - fall * 0.7)
    neck.rotation.z = (tilt + Math.sin(t * 0.8 + seed) * 0.12) * still
    neck.rotation.y = Math.sin(t * 0.5 + seed) * 0.25 * (1 - reachW) * (1 - fall) * still

    // ---- braços (ângulo no "mundo": desconta a inclinação do tronco) ----
    const pitch = spine.rotation.x
    for (const a of arms) {
      const sd = a.s > 0 ? -1 : 1
      const up = reach === 2 ? 1 : a.s < 0 ? 1 : 0.25
      let x = 0.06 + sd * A * 0.3 * sn + Math.sin(t * 1.7 + a.s) * 0.04 // pendurado, balança com a passada
      let z = a.s * 0.08
      x = lerp(x, -1.3 + Math.sin(t * 3 + a.s * 1.3) * 0.12, reachW * up) // estende para o alvo, mãos abrindo e fechando
      x = lerp(x, -1.62, lungeW); z = lerp(z, a.s * 0.02, lungeW) // bote
      x = lerp(x, -1.4 + Math.sin(t * 15 + a.s) * 0.05, grabW); z = lerp(z, -a.s * 0.1, grabW) // agarrado nos ombros
      x = lerp(x, -2.0 + Math.sin(t * 12 + a.s) * 0.5, staggerW * 0.7); z = lerp(z, a.s * 0.6, staggerW) // abanando
      x = lerp(x, -0.9 + Math.sin(t * 5 + a.s * 2) * 0.2, crouchW) // comendo
      x = lerp(x, -0.2 + pitch, fall); z = lerp(z, a.s * 1.15, fall) // deitado: braços abertos
      a.sh.rotation.x = x - pitch
      a.sh.rotation.z = z
    }

    // ---- queda: de costas (empurrado de frente) ou de bruços ----
    body.rotation.x = (e.fallDir || -1) * fall * Math.PI / 2
    body.position.y = 0.14 * fall
    // pés no chão: mancar/abaixar o quadril não enterra o sapato (deitado ou ajoelhado comendo fica como está)
    const plant = (1 - fall) * (1 - crouchW)
    if (plant > 0.01) { root.updateMatrixWorld(true); hips.position.y += SoleDepth(root, knees) * plant }
  }

  return { root, animate, sever, restore, has }
}
