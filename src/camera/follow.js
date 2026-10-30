import * as THREE from 'three'

const focus = new THREE.Vector3()
const target = new THREE.Vector3()
let lastTime = performance.now()
let frames = 0

// câmera acompanha o centro do grupo de jogadores
export function SmoothFollow(camera, points, dt) {
  if (points.length) {
    let x = 0, y = 0, z = 0
    for (const p of points) { x += p.x; y += p.gy || 0; z += p.z }
    target.set(x / points.length, y / points.length, z / points.length)
  }
  const k = 1 - Math.exp(-4 * dt)
  focus.lerp(target, k)
  camera.position.set(focus.x, focus.y + 15, focus.z + 10)
  camera.lookAt(focus.x, focus.y + 0.5, focus.z)
}

export function Fps() {
  const el = document.getElementById('fps-element')
  frames++
  const now = performance.now()
  if (now - lastTime >= 1000) {
    el.textContent = `FPS: ${frames}`
    frames = 0
    lastTime = now
  }
}
