import * as THREE from "three";

const geometry = new THREE.BoxGeometry(2, 3, 0.4);

const material = new THREE.MeshStandardMaterial({
  color: 0x5d5d5d,
});

export function CreateWall(obj) {
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(obj.x, obj.y, obj.z);

  return {
    mesh,

    collider: true,
  };
}
