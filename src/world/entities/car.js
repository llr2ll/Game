import * as THREE from "three";

const geometry = new THREE.BoxGeometry(2, 1, 4);

const material = new THREE.MeshStandardMaterial({
  color: 0x444444,
});

export function CreateCar(obj) {
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.copy(obj);

  return {
    mesh,

    collider: true,
  };
}
