import * as THREE from 'three'
import { P, merge, box, sph } from '../world/style'

// Efeitos rápidos das habilidades: anéis no chão, arcos (corte de espada / onda sonora), clarões, faíscas, fumaça e notas musicais.
// Geometrias compartilhadas; só o que precisa sumir aos poucos (opacidade) ganha um material próprio, descartado no fim.
const ringGeo = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2)
const discGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2)
const sparkGeo = new THREE.OctahedronGeometry(0.09, 0)
const puffGeo = new THREE.IcosahedronGeometry(0.5, 1)
const flashGeo = new THREE.IcosahedronGeometry(1, 1)
const noteGeo = merge([
  P(sph(0.09, 8, 6), 0xffffff, { p: [0, 0, 0], s: [1.25, 0.9, 0.7] }),
  box(0.03, 0.3, 0.03, 0xffffff, [0.1, 0.15, 0]),
  box(0.12, 0.05, 0.03, 0xffffff, [0.15, 0.28, 0], { r: [0, 0, -0.5] }),
])
const solids = new Map()
const solid = (c) => { if (!solids.has(c)) solids.set(c, new THREE.MeshBasicMaterial({ color: c })); return solids.get(c) }
const lamb = new Map()
const smoke = (c) => { if (!lamb.has(c)) lamb.set(c, new THREE.MeshLambertMaterial({ color: c, flatShading: true })); return lamb.get(c) }
const fade = (c, add = false) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })

export function CreateFX(scene) {
  const live = [] // { mesh, t, life, step(k, dt), own: material próprio? geo própria? }
  const add = (mesh, life, step, own = {}) => { scene.add(mesh); live.push({ mesh, t: 0, life, step, ...own }); return mesh }

  return {
    // anel que se expande no chão (cura, gelo, explosão, alvo do meteoro)
    ring(x, y, z, color, r0, r1, life = 0.5, { add: additive = true, fill = false } = {}) {
      const mat = fade(color, additive)
      const m = new THREE.Mesh(fill ? discGeo : ringGeo, mat)
      m.position.set(x, y + 0.06, z)
      m.renderOrder = 2
      return add(m, life, (k) => { const r = r0 + (r1 - r0) * (1 - (1 - k) ** 2); m.scale.set(r, 1, r); mat.opacity = (1 - k) * (fill ? 0.35 : 0.9) }, { mat })
    },
    // arco plano (rastro da espada, onda do bardo): centro no jogador, abre `span` radianos em volta de `ang`
    arc(x, y, z, ang, r0, r1, span, color, life = 0.22, width = 0.45) {
      const geo = new THREE.RingGeometry(1 - width, 1, 24, 1, -span / 2, span).rotateX(-Math.PI / 2)
      const mat = fade(color, true)
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.rotation.y = ang - Math.PI / 2 // RingGeometry começa em +X; gira para o ângulo da mira
      m.renderOrder = 2
      return add(m, life, (k) => { const r = r0 + (r1 - r0) * (1 - (1 - k) ** 3); m.scale.set(r, 1, r); mat.opacity = (1 - k) * 0.85 }, { mat, geo })
    },
    // clarão esférico (explosão, impacto mágico)
    flash(x, y, z, r, color, life = 0.3) {
      const mat = fade(color, true)
      const m = new THREE.Mesh(flashGeo, mat)
      m.position.set(x, y, z)
      return add(m, life, (k) => { m.scale.setScalar(r * (0.4 + 0.6 * Math.sqrt(k))); mat.opacity = 1 - k }, { mat })
    },
    // faíscas/estilhaços que voam e caem
    burst(x, y, z, color, n = 8, speed = 4, life = 0.5, size = 1) {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(sparkGeo, solid(color))
        const a = Math.random() * Math.PI * 2, sp = speed * (0.5 + Math.random() * 0.7)
        const v = { x: Math.cos(a) * sp, y: speed * (0.4 + Math.random() * 0.8), z: Math.sin(a) * sp }
        m.position.set(x, y, z)
        m.rotation.set(Math.random() * 3, Math.random() * 3, 0)
        add(m, life * (0.7 + Math.random() * 0.5), (k, dt) => {
          v.y -= 14 * dt
          m.position.x += v.x * dt; m.position.y += v.y * dt; m.position.z += v.z * dt
          m.rotation.x += dt * 9
          m.scale.setScalar(size * (1 - k))
        })
      }
    },
    // fumaça: cresce, sobe e encolhe (sem transparência: barato)
    puff(x, y, z, color = 0x8a8a90, size = 0.6, life = 1, vy = 1.2) {
      const m = new THREE.Mesh(puffGeo, smoke(color))
      m.position.set(x + (Math.random() - 0.5) * 0.2, y, z + (Math.random() - 0.5) * 0.2)
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0)
      const dx = (Math.random() - 0.5) * 0.6, dz = (Math.random() - 0.5) * 0.6
      return add(m, life, (k, dt) => { m.position.y += vy * dt; m.position.x += dx * dt; m.position.z += dz * dt; m.scale.setScalar(size * Math.sin(Math.min(1, k * 1.3) * Math.PI) + 0.01) })
    },
    // nota musical que sobe balançando
    note(x, y, z, color = 0xffe26a, life = 1.1) {
      const m = new THREE.Mesh(noteGeo, solid(color))
      m.position.set(x, y, z)
      const ph = Math.random() * 6, x0 = x
      return add(m, life, (k, dt) => { m.position.y += 1.4 * dt; m.position.x = x0 + Math.sin(ph + k * 9) * 0.25; m.rotation.y += dt * 2; m.scale.setScalar(Math.min(1, k * 6) * (1 - k * k) + 0.01) })
    },
    // qualquer malha que vive `life` segundos com um passo próprio (projéteis usam isso para sumir)
    custom(mesh, life, step) { return add(mesh, life, step) },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const f = live[i]
        f.t += dt
        const k = Math.min(1, f.t / f.life)
        f.step(k, dt)
        if (k >= 1) {
          scene.remove(f.mesh)
          if (f.mat) f.mat.dispose()
          if (f.geo) f.geo.dispose()
          live.splice(i, 1)
        }
      }
    },
    clear() {
      for (const f of live) { scene.remove(f.mesh); if (f.mat) f.mat.dispose(); if (f.geo) f.geo.dispose() }
      live.length = 0
    },
  }
}
