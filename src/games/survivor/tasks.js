import * as THREE from 'three'

// Tarefas "parado fazendo algo" (revistar, desmontar, barricar…): uma por jogador, em p.task.
// Mexer (mais de 0,6 m), atacar, ser agarrado, cair (menos no levantar sozinho), entrar no carro ou `valid()` falso cancela. A cada segundo faz barulho
// (e toca o som `beat`, se houver). Um anel branco cresce sob quem está trabalhando.
const PROG_GEO = new THREE.RingGeometry(0.82, 1, 32).rotateX(-Math.PI / 2)
const PROG_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false }) // aparece até atrás de móveis

// ctx: { scene, noise(x, z, r), sfx(nome, opções) }
export function CreateTasks({ scene, noise, sfx }) {
  const progs = new Map() // id do jogador -> anel de progresso
  return {
    // o = { a (tipo), icon, need (segundos), at {x, z} (de onde sai o barulho), noise (raio), beat (som a cada segundo, opcional), done(p),
    //       down (vale caído), valid() (opcional: falso = cancela) }
    start(p, o) { p.task = { ...o, t: 0, noiseT: 0, x: p.x, z: p.z } },
    tick(p, dt) {
      const k = p.task
      if (!k) return
      if ((p.dead && !k.down) || p.vehicle || p.held || p.firing || Math.hypot(p.x - k.x, p.z - k.z) > 0.6 || (k.valid && !k.valid())) { p.task = null; return }
      if ((k.noiseT -= dt) <= 0) {
        k.noiseT = 1
        noise(k.at.x, k.at.z, k.noise)
        if (k.beat && k.t > 0) sfx(k.beat, { x: k.at.x, z: k.at.z })
      }
      if ((k.t += dt) >= k.need) { p.task = null; k.done(p) }
    },
    // anel de progresso sob quem está trabalhando (cresce até completar)
    update(list) {
      for (const p of list) {
        let r = progs.get(p.id)
        if (!p.task) { if (r) r.visible = false; continue }
        if (!r) { r = new THREE.Mesh(PROG_GEO, PROG_MAT); r.renderOrder = 3; scene.add(r); progs.set(p.id, r) }
        r.visible = true
        r.scale.setScalar(0.35 + 0.6 * (p.task.t / p.task.need))
        r.position.set(p.x, (p.y || 0) - (p.jy || 0) + 0.13, p.z)
      }
    },
    clear(players) {
      for (const r of progs.values()) scene.remove(r)
      progs.clear()
      for (const p of players) p.task = null
    },
  }
}
