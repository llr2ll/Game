import * as THREE from "three";

export function Light(scene) {
  scene.background = new THREE.Color(0xb58d78);
  scene.fog = new THREE.Fog(0xb58d78, 12, 55);
  const ambient = new THREE.AmbientLight(0xf0d6c5, 1.2);

  scene.add(ambient);

  const sunset = new THREE.DirectionalLight(0xffc89a, 1.4);

  sunset.position.set(-12, 8, 10);

  scene.add(sunset);

  const sky = new THREE.DirectionalLight(0x8a8d9c, 0.5);

  sky.position.set(10, 15, -15);

  scene.add(sky);

  const bounce = new THREE.DirectionalLight(0xd9b49f, 0.25);

  bounce.position.set(0, -5, 0);

  scene.add(bounce);
}
