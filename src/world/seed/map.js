const CHUNK_SIZE = 16;

const cache = new Map();

function chunkId(cx, cz) {
  return `${cx},${cz}`;
}

export function Seed(cx, cz) {

  const id = chunkId(cx, cz);

  // CACHE

  if (cache.has(id)) {
    return cache.get(id);
  }

  // GERA

  const objects = [];

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x;

      const wz = cz * CHUNK_SIZE + z;

      objects.push({
        type: "road",

        x: wx,

        z: wz,
      });

      if (x === 0 || z === 0 || x === 15 || z === 15) {
        objects.push({
          type: "sidewalk",

          x: wx,

          y: 0.05,

          z: wz,
        });
      }
    }
  }

  if ((cx + cz) % 3 === 0) {
    objects.push({
      type: "wall",

      x: cx * 16 + 5,

      y: 1.5,

      z: cz * 16 + 5,
    });
  }

  if ((cx * cz) % 2 === 0) {
    objects.push({
      type: "car",

      x: cx * 16 + 8,

      y: 0.5,

      z: cz * 16 + 10,
    });
  }

  // SALVA

  cache.set(id, objects);

  return objects;
}
