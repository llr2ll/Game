import * as THREE from "three";

const geometry =
new THREE.BoxGeometry(
  1,
  0.12,
  1
);

const material =
new THREE.MeshStandardMaterial({
  color: 0x807c79,
});

export function CreateSidewalk() {

  return {

    instanced: true,

    geometry,

    material,

    collider: false,

  };

}