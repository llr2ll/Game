import { GenerateChunk } from './generator'
import { CHUNK_SIZE } from '../seed/map'
import { AddColliders, RemoveColliders } from '../collision'

const chunks = new Map()
const queue = new Map()
const VIEW_DISTANCE = 3

const id = (x, z) => `${x},${z}`

// positions: lista de {x, z} (todos os jogadores) — carrega o entorno de cada um
export function UpdateChunks(scene, colliders, positions) {
  const active = new Set()
  for (const p of positions) {
    const cx0 = Math.floor((p.x + 0.5) / CHUNK_SIZE), cz0 = Math.floor((p.z + 0.5) / CHUNK_SIZE)
    for (let x = -VIEW_DISTANCE; x <= VIEW_DISTANCE; x++)
      for (let z = -VIEW_DISTANCE; z <= VIEW_DISTANCE; z++) {
        const cx = cx0 + x, cz = cz0 + z, k = id(cx, cz)
        active.add(k)
        if (!chunks.has(k) && !queue.has(k)) queue.set(k, { cx, cz })
      }
  }
  for (const k of [...queue.keys()]) if (!active.has(k)) queue.delete(k)
  for (const [k, chunk] of chunks) if (!active.has(k)) Unload(scene, colliders, k, chunk)
}

function Unload(scene, colliders, k, chunk) {
  RemoveColliders(chunk.userData.colliders)
  for (const c of chunk.userData.colliders) {
    const i = colliders.indexOf(c)
    if (i !== -1) colliders.splice(i, 1)
  }
  for (const d of chunk.userData.dispose) d.dispose()
  scene.remove(chunk)
  chunks.delete(k)
}

export function ProcessChunkQueue(scene, colliders, max = 2) {
  for (let n = 0; n < max && queue.size; n++) {
    const [k, { cx, cz }] = queue.entries().next().value
    queue.delete(k)
    const chunk = GenerateChunk(cx, cz)
    scene.add(chunk)
    colliders.push(...chunk.userData.colliders)
    AddColliders(chunk.userData.colliders)
    chunks.set(k, chunk)
  }
}
