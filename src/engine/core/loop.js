import * as THREE from 'three'

// Laço de desenho: chama fn(dt) uma vez por quadro. dt em segundos, limitado a maxDt (evita saltos depois de uma travada).
export function StartLoop(renderer, fn, maxDt = 0.05) {
  const timer = new THREE.Timer()
  return renderer.setAnimationLoop(() => {
    timer.update()
    fn(Math.min(timer.getDelta(), maxDt))
  })
}
