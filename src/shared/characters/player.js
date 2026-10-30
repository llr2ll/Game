import * as THREE from 'three'
import { MAT } from '../../engine/render/style'
import { LOOK, BONES as B } from './looks'
import { KITS } from './kits'

// Personagem articulado (estilo Project Zomboid, em versão "brinquedo"):
//   root (posição + direção do tronco/mira)
//    └ tilt (giro extra, queda, nado, inclinação na curva)
//       ├ hips ─ coxa > joelho > tornozelo (x2) ─ spine ─ pescoço/cabeça, ombro > cotovelo > mão (x2)
//       └ holder: o objeto da classe (arma/katana/cajado/alaúde)
// Pernas: cinemática direta guiada pela DISTÂNCIA andada (o pé não escorrega). O quadril vira para onde o corpo anda
// e o tronco continua na mira: anda de lado e de costas mirando. Braços: IK de dois ossos até a empunhadura do objeto.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const lerp = (a, b, t) => a + (b - a) * t
const damp = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt))
const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI }
// 0 → 1 → 0, com o pico em `peak` (empurrão: sai rápido, volta devagar)
const pulse = (k, peak) => Math.sin(clamp(k < peak ? (k / peak) * 0.5 : 0.5 + ((k - peak) / (1 - peak)) * 0.5, 0, 1) * Math.PI)

// ---- pés no chão: quanto a sola mais baixa (caixa das malhas dos pés) está abaixo do chão + FOOT_CLEAR ----
// em unidades locais do root (o zumbi tem escala); 0 se nenhuma está. Precisa das matrizes de mundo em dia.
export const FOOT_CLEAR = 0.02 // asfalto e decalques da rua ficam até ~2 cm acima do terreno
const _fb = new THREE.Box3()
export function SoleDepth(root, feet) {
  let lo = Infinity
  for (const f of feet) lo = Math.min(lo, _fb.setFromObject(f).min.y)
  return Math.max(0, root.matrixWorld.elements[13] + FOOT_CLEAR - lo) / root.scale.y
}

// ---- IK de dois ossos no espaço do tronco: ombro em S, mão em T, cotovelo puxado para `pole` ----
const _d = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3()
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _t = new THREE.Vector3(), _m = new THREE.Matrix4()
function solveArm(sh, el, S, T, pole, a, b) {
  _d.subVectors(T, S)
  const d = clamp(_d.length(), 0.08, a + b - 0.002)
  _d.normalize()
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1))
  _n.crossVectors(_d, pole)
  if (_n.lengthSq() < 1e-8) _n.set(1, 0, 0)
  _n.normalize()
  _u.copy(_d).applyAxisAngle(_n, A) // braço: gira a direção do alvo em direção ao polo
  _t.copy(S).addScaledVector(_d, d) // alvo alcançável
  _f.copy(_t).sub(S).addScaledVector(_u, -a).normalize() // antebraço
  const bend = Math.acos(clamp(_u.dot(_f), -1, 1))
  _y.copy(_u).negate()
  _z.copy(_f).addScaledVector(_u, -_u.dot(_f))
  if (_z.lengthSq() < 1e-6) _z.copy(pole).addScaledVector(_u, -_u.dot(pole)).negate()
  _z.normalize()
  _x.crossVectors(_y, _z)
  sh.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z))
  el.rotation.x = -bend
}

export function CreatePlayerModel(cls = 'gunner') {
  const look = LOOK(cls)
  const mesh = (geo) => new THREE.Mesh(geo, MAT.solid)
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g }

  const root = new THREE.Group()
  const tilt = grp(root)
  tilt.rotation.order = 'YXZ'
  const hips = grp(tilt, 0, B.hipY, 0)
  hips.rotation.order = 'YXZ'
  hips.add(mesh(look.pelvis))
  if (look.hipsExtra) hips.add(mesh(look.hipsExtra))
  const leg = (s) => {
    const thigh = grp(hips, s * B.legX, B.legY, 0); thigh.add(mesh(look.thigh))
    const knee = grp(thigh, 0, -B.knee, 0); knee.add(mesh(look.shin))
    const ankle = grp(knee, 0, -B.ankle, 0); ankle.add(mesh(look.foot))
    return { thigh, knee, ankle, s }
  }
  const legs = [leg(1), leg(-1)] // [esquerda (+X), direita]
  const ankles = legs.map((L) => L.ankle)
  const spine = grp(hips, 0, B.spineY, 0)
  spine.rotation.order = 'YXZ'
  spine.add(mesh(look.torso))
  const neck = grp(spine, 0, B.neckY, 0)
  neck.rotation.order = 'YXZ'
  neck.add(mesh(look.head))
  const arm = (s) => {
    const sh = grp(spine, s * B.shX, B.shY, 0); sh.add(mesh(look.upper))
    const el = grp(sh, 0, -B.upper, 0); el.add(mesh(look.fore))
    const hand = grp(el, 0, -B.fore, 0)
    return { sh, el, hand, s, S: new THREE.Vector3(s * B.shX, B.shY, 0), T: new THREE.Vector3(), pole: new THREE.Vector3() }
  }
  const arms = [arm(1), arm(-1)]
  const holder = grp(tilt)
  const kit = KITS[cls](holder, { handR: arms[1].hand, handL: arms[0].hand, spine })

  root.traverse((o) => { if (o.isMesh) o.frustumCulled = false }) // partes pequenas se movem: o culling por malha só custaria CPU

  // ---- estado da animação ----
  let t = Math.random() * 10, phase = 0, aimW = 0, runW = 0, moveW = 0, airW = 0, swimW = 0, seatW = 0, legYaw = 0, sideK = 0
  let turnStep = 0, lean = 0, accLean = 0, lastSp = 0, fall = 0, fallDir = -1, hurtT = 0, recoil = 0, flashT = 0, landT = 0, wasAir = false
  let act = null, actT = 0, actDur = 1, look2 = 0, lookT = 2, heldW = 0
  const pose = {
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(), holdQuat: new THREE.Quaternion(), rGrip: new THREE.Vector3(), lGrip: new THREE.Vector3(),
    rTarget: new THREE.Vector3(), lTarget: new THREE.Vector3(),
  }
  const st = { t: 0, dt: 0, aimW: 0, bob: 0, armR: 0, recoil: 0, act: null, ak: 0 }
  const v = new THREE.Vector3(), w = new THREE.Vector3(), hp = new THREE.Vector3(), q = new THREE.Quaternion()
  const toSpine = (out, vRoot) => spine.worldToLocal(tilt.localToWorld(out.copy(vRoot)))

  function animate(dt, p) {
    t += dt
    const seat = p.seat || null
    const sp = seat ? 0 : p.speed
    const moving = sp > 0.3
    // pesos suavizados: transições sem "estalo" entre andar/correr/mirar/pular/nadar/sentar
    aimW = damp(aimW, p.aiming || (act && act !== 'swap') ? 1 : 0, 11, dt)
    runW = damp(runW, p.running && moving ? 1 : 0, 6, dt)
    moveW = damp(moveW, clamp(sp / 1.6, 0, 1), 9, dt)
    const air = !seat && !p.swim && p.jy > 0.06
    airW = damp(airW, air ? 1 : 0, 14, dt)
    if (wasAir && !air && !p.swim) landT = 0.22
    wasAir = air
    landT = Math.max(0, landT - dt)
    swimW = damp(swimW, p.swim && !p.dead ? 1 : 0, 6, dt)
    seatW = damp(seatW, seat ? 1 : 0, 10, dt)
    recoil = Math.max(0, recoil - dt * 8)
    hurtT = Math.max(0, hurtT - dt)
    if (flashT > 0 && (flashT -= dt) <= 0) kit.flash(false)
    if (act && (actT += dt) >= actDur) act = null
    // empurrão (as duas mãos/a arma vão à frente) e pisão (perna direita sobe e desce no zumbi caído)
    const ak = act ? clamp(actT / actDur, 0, 1) : 0
    const shove = act === 'shove' ? pulse(ak, 0.3) : 0
    const stompUp = act === 'stomp' ? pulse(ak, 0.45) : 0, stomp = act === 'stomp' ? Math.sin(ak * Math.PI) : 0
    heldW = damp(heldW, p.held ? 1 : 0, 8, dt) // agarrado: se debatendo
    if (p.dead) fall = Math.min(1, fall + dt * (0.6 + fall * 4)) // cai acelerando
    else fall = damp(fall, 0, 5, dt)

    // ---- direção das pernas em relação ao tronco (andar de lado / de costas mirando) ----
    let rel = 0, dir = 1
    if (moving) {
      rel = wrap(Math.atan2(p.vx, p.vz) - p.facing)
      if (Math.abs(rel) > 1.95) { dir = -1; rel = wrap(rel - Math.PI) }
    }
    const legT = clamp(rel, -1.1, 1.1) * (moving ? 1 : 0)
    legYaw = damp(legYaw, legT, 10, dt)
    sideK = damp(sideK, Math.sin(rel - legT) * dir, 8, dt) // o que sobra vira passo lateral

    // ---- fase da passada: avança pela distância (um ciclo = dois passos) ----
    const stride = lerp(0.5, 0.92, clamp(sp / 4.2, 0, 1)) + runW * 0.55
    phase += (dir * sp * dt / stride) * Math.PI
    // girando parado: passinhos no lugar
    turnStep = damp(turnStep, !moving && !seat && Math.abs(p.turn || 0) > 1.4 ? 1 : 0, 10, dt)
    if (turnStep > 0.05) phase += Math.abs(p.turn) * dt * 1.3
    const A = Math.max(moveW * lerp(0.5, 0.88, runW) * clamp(sp / 3.2, 0.45, 1), turnStep * 0.2) * (1 - seatW) * (1 - swimW)
    const sn = Math.sin(phase), cs = Math.cos(phase)

    // aceleração: inclina para a frente ao arrancar e para trás ao frear; inclina para dentro da curva
    accLean = damp(accLean, clamp((sp - lastSp) / Math.max(dt, 1e-3) * 0.02, -0.18, 0.18), 6, dt)
    lastSp = sp
    lean = damp(lean, clamp(-(p.turn || 0) * sp * 0.014, -0.2, 0.2), 6, dt)

    // ---- objeto da classe (decide pose do tronco e das mãos) ----
    st.t = t; st.dt = dt; st.aimW = aimW; st.recoil = recoil; st.act = act; st.ak = act ? clamp(actT / actDur, 0, 1) : 0
    st.bob = -A * 0.05 * sn * sn
    st.armR = A * 0.6 * sn * (1 - runW * 0.4) // balanço do braço direito (vai à frente quando a perna esquerda vai)
    Object.assign(pose, { rW: 0, lW: 0, hold: 0, rT: 0, lT: 0, spineX: 0, spineY: 0, spineZ: 0, neckX: 0, neckY: 0, crouch: 0, yaw: 0, armsUp: 0 })
    kit.pose(st, pose)
    if (shove) { pose.pos.z += shove * 0.3; pose.pos.y += shove * 0.06; pose.spineX += shove * 0.32 }
    if (stomp) { pose.spineX += stomp * 0.22; pose.neckX += stomp * 0.45 }
    const driving = seat && seat.mode === 'drive'
    holder.visible = !driving && swimW < 0.5 && fall < 0.5

    // ---- quadril ----
    const breath = Math.sin(t * 1.9)
    const idle = (1 - moveW) * (1 - seatW)
    const sitY = seat && seat.mode !== 'stand' ? -0.4 : -0.06
    hips.position.y = B.hipY + st.bob - runW * 0.06 * moveW + pose.crouch + seatW * sitY - airW * 0.05 - landT * 0.5
    hips.rotation.y = legYaw - 0.13 * A * sn + idle * Math.sin(t * 0.6) * 0.04
    hips.rotation.z = 0.06 * A * sn + idle * Math.sin(t * 0.7) * 0.03
    hips.rotation.x = runW * 0.1 * moveW

    // ---- pernas ----
    for (const L of legs) {
      const ph = L.s > 0 ? phase : phase + Math.PI
      const s = Math.sin(ph), c = Math.cos(ph)
      const swing = Math.max(0, dir * Math.cos(ph + 0.45 * runW * dir))
      let tx = -A * s * (1 - Math.abs(sideK) * 0.6) - 0.03
      let tz = L.s * 0.03 + sideK * A * s * 0.6
      let kn = 0.07 + A * (0.75 + runW * 1.1) * Math.pow(swing, 1.4) + idle * Math.max(0, Math.sin(t * 0.7) * L.s) * 0.1
      let ft = -(tx + kn) * 0.9 + A * 0.5 * Math.max(0, -s) * Math.max(0, dir * c) - A * 0.25 * Math.max(0, s) * Math.max(0, -dir * c)
      // pulo: uma perna dobrada à frente, a outra estendida
      tx = lerp(tx, L.s > 0 ? -0.95 : -0.2, airW); kn = lerp(kn, L.s > 0 ? 1.35 : 0.55, airW); ft = lerp(ft, 0.15, airW)
      kn += landT * 2.2; tx -= landT * 1.0; ft -= landT * 1.1
      // sentado (banco do carro) ou de pé na caçamba
      if (seat) {
        if (seat.mode === 'stand') { tz = L.s * 0.16; kn = 0.18; tx = -0.06; ft = -0.12 }
        else { tx = -1.45; kn = 1.35; ft = 0.1; tz = L.s * 0.12 }
      }
      tx = lerp(tx, -pose.crouch * 1.8, Math.min(1, -pose.crouch * 3)) // agachado: dobra os joelhos
      kn += -pose.crouch * 3.2
      ft += pose.crouch * 1.5
      // nadando: perna batendo
      if (swimW > 0.01) { tx = lerp(tx, Math.sin(t * 9 + L.s) * 0.35, swimW); kn = lerp(kn, 0.35 + Math.sin(t * 9 + L.s + 1) * 0.25, swimW); ft = lerp(ft, 0.8, swimW) }
      // caindo morto: joelhos cedem e depois as pernas relaxam
      if (fall > 0) { const b = Math.sin(Math.min(1, fall * 1.6) * Math.PI); kn += b * 1.1 * (1 - fall * 0.5); tx -= b * 0.5 }
      if (stomp && L.s < 0) { tx -= stompUp * 1.0; kn += stompUp * 1.3; ft += stompUp * 0.3 }
      L.thigh.rotation.x = tx; L.thigh.rotation.z = tz
      L.knee.rotation.x = kn
      L.ankle.rotation.x = ft
    }

    // ---- tronco, cabeça ----
    const back = dir < 0 && moving ? 1 : 0
    spine.rotation.y = -legYaw + 0.2 * A * sn + pose.spineY
    spine.rotation.x = 0.05 * moveW + 0.24 * runW * moveW + accLean - back * 0.07 + breath * 0.012 + pose.spineX - hurtT * 1.1 + airW * 0.1 + seatW * (seat && seat.mode !== 'stand' ? -0.06 : 0)
    spine.rotation.z = -hips.rotation.z * 0.6 + pose.spineZ + heldW * Math.sin(t * 23) * 0.07
    // olhar em volta quando parado
    if ((lookT -= dt) <= 0) { lookT = 2 + Math.random() * 3.5; look2 = idle > 0.5 && aimW < 0.2 ? (Math.random() - 0.5) * 1.3 : 0 }
    neck.rotation.y = damp(neck.rotation.y, -spine.rotation.y * 0.55 + look2 * idle * (1 - aimW) + pose.neckY, 5, dt)
    neck.rotation.x = -spine.rotation.x * 0.6 + 0.04 * A * Math.cos(phase * 2) + pose.neckX - hurtT * 0.5 - swimW * 0.9 + fall * 0.3

    tilt.rotation.y = pose.yaw
    tilt.rotation.z = lean * (1 - seatW)
    // nado gira em volta do quadril (corpo deitado na superfície); a queda gira em volta dos pés
    const swimX = 1.15 * swimW
    tilt.rotation.x = swimX + fallDir * fall * Math.PI / 2
    tilt.position.set(0, B.hipY * (1 - Math.cos(swimX)) + 0.15 * swimW + 0.13 * fall, -B.hipY * Math.sin(swimX))
    root.updateMatrixWorld(true)
    // de pé, nenhuma pose (agachar mirando, balanço do quadril, aterrissagem) enfia a sola no chão: só levanta o quadril, nunca abaixa
    const plant = (1 - airW) * (1 - swimW) * (1 - seatW) * (1 - fall)
    if (plant > 0.01) {
      const sink = SoleDepth(root, ankles) * plant
      if (sink > 1e-4) { hips.position.y += sink; root.updateMatrixWorld(true) }
    }

    // ---- objeto na mão/corpo + braços por IK ----
    holder.position.copy(pose.pos); holder.quaternion.copy(pose.quat)
    holder.updateMatrixWorld(true)
    const free = 1 - Math.max(seatW * (driving ? 1 : 0), swimW, fall)
    for (const a of arms) {
      const s = a.s, right = s < 0
      // braço livre: balança oposto à perna do mesmo lado; correndo, cotovelo dobrado "bombeando"
      const f = (right ? 1 : -1) * A * 0.6 * sn * (1 - runW * 0.4)
      const rf = (right ? 1 : -1) * sn * moveW
      v.set(s * 0.07, -0.56 * Math.cos(f) + breath * 0.008, 0.56 * Math.sin(f) + 0.03)
      w.set(s * 0.02, -0.32 + 0.1 * Math.max(0, rf), 0.12 + 0.3 * rf)
      v.lerp(w, runW).add(a.S)
      if (airW > 0.01) { w.set(s * 0.3, -0.25, 0.12).add(a.S); v.lerp(w, airW) }
      if (pose.armsUp) { w.set(s * 0.18, 0.5, 0.15).add(a.S); v.lerp(w, pose.armsUp * (right ? 0 : 1)) }
      if (hurtT > 0) v.z -= hurtT * 0.6
      if (heldW > 0.01) { w.set(s * 0.22, -0.05 + Math.sin(t * 19 + s) * 0.08, 0.32).add(a.S); v.lerp(w, heldW * 0.7) } // empurrando o zumbi para longe
      a.T.copy(v)
      // mãos no objeto
      const gw = (right ? pose.rW : pose.lW) * free
      if (gw > 0) { hp.copy(right ? pose.rGrip : pose.lGrip).applyQuaternion(holder.quaternion).add(holder.position); toSpine(w, hp); a.T.lerp(w, gw) }
      const tw = (right ? pose.rT : pose.lT) * free
      if (tw > 0) { toSpine(w, right ? pose.rTarget : pose.lTarget); a.T.lerp(w, tw) }
      // empurrão de mão livre: palmas à frente, na altura do peito (mão na arma: a arma é que vai à frente)
      if (shove > 0.01 && gw < 0.5) { w.set(s * 0.14, 0.02, 0.5).add(a.S); a.T.lerp(w, shove * (1 - gw)) }
      // volante (dirigindo)
      if (driving) {
        const ang = (right ? 2.6 : 0.54) + (seat.steer || 0) * 1.1
        toSpine(w, hp.set(Math.cos(ang) * 0.17, 0.92 + Math.sin(ang) * 0.17, 0.4))
        a.T.lerp(w, seatW)
      }
      // nadando: braçada alternada (crawl: a mão volta à frente por cima da água e puxa por baixo do corpo até o quadril)
      if (swimW > 0.01) {
        const sa = -t * 4.2 + (right ? Math.PI : 0)
        w.set(s * 0.12, -0.45 * Math.cos(sa), 0.5 * Math.sin(sa) + 0.1).add(a.S)
        a.T.lerp(w, swimW)
      }
      if (fall > 0) { w.set(s * 0.55, -0.15, -0.05).add(a.S); a.T.lerp(w, fall) }
      // cotovelo: para trás quando o braço está solto, para fora/baixo quando segura algo à frente
      const hold = Math.max(gw, tw, driving ? 1 : 0)
      a.pole.set(s * lerp(0.25, 0.7, hold), lerp(-0.15, -1, hold), lerp(-1, -0.25, hold)).normalize()
      solveArm(a.sh, a.el, a.S, a.T, a.pole, B.upper, B.fore)
    }
    // objeto "na mão": depois do IK, segue a mão direita
    if (pose.hold > 0.001) {
      arms[1].el.updateMatrixWorld(true)
      arms[1].hand.getWorldPosition(hp); tilt.worldToLocal(hp)
      q.slerpQuaternions(pose.quat, pose.holdQuat, pose.hold)
      w.copy(pose.rGrip).applyQuaternion(q)
      holder.position.lerp(hp.sub(w), pose.hold)
      holder.quaternion.copy(q)
    }
  }

  return {
    root,
    setWeapon: (w) => kit.setWeapon(w),
    muzzle: (out) => { root.updateMatrixWorld(true); return kit.muzzle(out) },
    kick() { recoil = 1; flashT = 0.05; kit.flash(true); kit.kick() },
    play(name, dur) { act = name; actT = 0; actDur = dur },
    acting: () => act,
    hurt() { hurtT = 0.22 },
    die() { fallDir = Math.random() < 0.6 ? -1 : 1 },
    animate,
  }
}
