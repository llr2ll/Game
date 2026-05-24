import * as THREE from "three";

import { Seed } from "../seed/map";

import { Entities } from "../entities/entities";

export function GenerateChunk(
  scene,
  colliders,
  cx,
  cz
) {

  const chunk =
    new THREE.Group();

  chunk.userData.colliders =
    [];

  const data =
    Seed(
      cx,
      cz
    );

  const instanced =
    {};

  const matrix =
    new THREE.Matrix4();

  for (
    const obj
    of data
  ) {

    const factory =
      Entities[
        obj.type
      ];

    if (
      !factory
    ) continue;

    const result =
      factory(
        obj
      );

    if (
      result.instanced
    ) {

      if (
        !instanced[
          obj.type
        ]
      ) {

        instanced[
          obj.type
        ] = {

          mesh:

          new THREE.InstancedMesh(

            result.geometry,

            result.material,

            512

          ),

          index: 0

        };

      }

      const current =
        instanced[
          obj.type
        ];

      matrix.identity();

      if (
        obj.type ===
        "road"
      ) {

        matrix.makeRotationX(
          -Math.PI / 2
        );

      }

      matrix.setPosition(

        obj.x,

        obj.y ?? 0,

        obj.z

      );

      current.mesh.setMatrixAt(

        current.index++,

        matrix

      );

      continue;

    }

    chunk.add(
      result.mesh
    );

    if (
      result.collider
    ) {

      colliders.push(
        result.mesh
      );

      chunk.userData.colliders.push(
        result.mesh
      );

    }

  }

  for (
    const key
    in instanced
  ) {

    const obj =
      instanced[
        key
      ];

    obj.mesh.count =
      obj.index;

    chunk.add(
      obj.mesh
    );

  }

  scene.add(
    chunk
  );

  return chunk;

}