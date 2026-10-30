import * as THREE from 'three'
import { MAT, SHADOW_GEO } from './style'

// Sombras de contato dos jogadores e inimigos: UM InstancedMesh com tamanho fixo, reescrito a cada frame.
// Substitui shadow maps (que custariam muito, ainda mais com várias câmeras no split screen).
export function CreateEntityShadows(scene, max = 96) {
  const mesh = new THREE.InstancedMesh(SHADOW_GEO, MAT.shadow, max)
  mesh.frustumCulled = false
  mesh.renderOrder = 1
  mesh.count = 0
  scene.add(mesh)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3()
  let n = 0
  const put = (x, y, z, r) => {
    if (n >= max) return
    m.compose(p.set(x - 0.3 * r, y + 0.08, z), q.identity(), s.set(r * 2.3, 1, r * 1.8))
    mesh.setMatrixAt(n++, m)
  }
  const up = new THREE.Vector3(0, 1, 0)
  return {
    update(players, enemies, vehicles = []) {
      n = 0
      for (const pl of players) if (!pl.vehicle) put(pl.x, pl.gy || 0, pl.z, pl.dead ? 0.65 : 0.5 / (1 + pl.jy * 0.35)) // pulando: a sombra encolhe
      for (const v of vehicles) {
        if (n >= max || v.sleep) continue
        m.compose(p.set(v.x - 0.25, v.y + 0.08, v.z), q.setFromAxisAngle(up, v.yaw), s.set(v.d.W * 1.35, 1, v.d.L * 1.12))
        mesh.setMatrixAt(n++, m)
      }
      for (const e of enemies) if (e.dying <= 0) put(e.x, e.group.position.y, e.z, e.radius * 1.05)
      mesh.count = n
      mesh.instanceMatrix.needsUpdate = true
    },
  }
}
