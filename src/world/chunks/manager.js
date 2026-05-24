import { GenerateChunk } from "./generator";

const chunks = new Map();

const queue = [];

const VIEW_DISTANCE = 3;
const CHUNK_SIZE = 16;

function chunkId(x, z) {
  return `${x},${z}`;
}

export function LoadChunk(scene, player, colliders) {
  const centerX = Math.floor(player.position.x / CHUNK_SIZE);

  const centerZ = Math.floor(player.position.z / CHUNK_SIZE);

  const active = new Set();

  // CARREGA

  for (let x = -VIEW_DISTANCE; x <= VIEW_DISTANCE; x++) {
    for (let z = -VIEW_DISTANCE; z <= VIEW_DISTANCE; z++) {
      const cx = centerX + x;

      const cz = centerZ + z;

      const id = chunkId(cx, cz);

      active.add(id);

      if (!chunks.has(id)) {
        const exists = queue.some((q) => q.cx === cx && q.cz === cz);

        if (!exists) {
          queue.push({
            scene,

            colliders,

            cx,

            cz,
          });
        }
      }
    }
  }

  // DESCARREGA

  for (const [id] of chunks) {
    if (!active.has(id)) {
      const [x, z] = id

        .split(",")

        .map(Number);

      UnloadChunk(
        scene,

        colliders,

        x,

        z,
      );
    }
  }
}

function UnloadChunk(scene, colliders, cx, cz) {
  const id = chunkId(cx, cz);

  const chunk = chunks.get(id);

  if (!chunk) return;

  // remove colliders

  for (const collider of chunk.userData.colliders) {
    const index = colliders.indexOf(collider);

    if (index !== -1) {
      colliders.splice(index, 1);
    }
  }

  scene.remove(chunk);

  chunks.delete(id);
}

export function ProcessChunkQueue() {
  if (queue.length === 0) return;

  const { scene, colliders, cx, cz } = queue.shift();

  const group = GenerateChunk(scene, colliders, cx, cz);

  chunks.set(chunkId(cx, cz), group);
}
