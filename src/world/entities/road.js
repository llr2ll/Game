import * as THREE from "three";

const geometry =
new THREE.PlaneGeometry(
  1,
  1
);

const material =
new THREE.MeshStandardMaterial({
  color: 0x4a7c59,
});

export function CreateRoad() {

  return {

    instanced: true,

    geometry,

    material,

    collider: false,

  };

}