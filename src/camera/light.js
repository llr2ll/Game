import * as THREE from 'three'

// fim de tarde na floresta
export function Light(scene) {
  scene.background = new THREE.Color(0xb58d78)
  scene.fog = new THREE.Fog(0xb58d78, 24, 75)
  scene.add(new THREE.AmbientLight(0xf0d6c5, 1.1))
  const sunset = new THREE.DirectionalLight(0xffc89a, 1.6)
  sunset.position.set(-12, 10, 10)
  scene.add(sunset)
  const sky = new THREE.DirectionalLight(0x8a8d9c, 0.5)
  sky.position.set(10, 15, -15)
  scene.add(sky)
}
