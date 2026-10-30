import { hash } from '../noise'
import { CHUNK_SIZE, ROAD_HALF, StationOf } from '../layout'
import { Dirt } from '../terrain'

export { hash, CHUNK_SIZE, ROAD_HALF, StationOf }

function rng(seed) {
  let s = seed | 0 || 1
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

// Árvores numa grade global (células de 3.5, com leve deslocamento): nunca nascem coladas,
// e como dependem só da célula, os chunks vizinhos concordam entre si.
const TREE_CELL = 3.5
export function TreeAt(i, j) {
  if (hash(i, j, 41) > 0.8) return null
  return {
    x: (i + 0.5) * TREE_CELL + (hash(i, j, 42) - 0.5) * 1.4,
    z: (j + 0.5) * TREE_CELL + (hash(i, j, 43) - 0.5) * 1.4,
    s: 0.75 + hash(i, j, 44) * 0.35,
    k: hash(i, j, 45),
  }
}
function nearTree(x, z, d) {
  const ci = Math.floor(x / TREE_CELL), cj = Math.floor(z / TREE_CELL), n = Math.ceil((d + 0.8) / TREE_CELL)
  for (let i = ci - n; i <= ci + n; i++)
    for (let j = cj - n; j <= cj + n; j++) {
      const t = TreeAt(i, j)
      if (t && Math.hypot(t.x - x, t.z - z) < d) return true
    }
  return false
}

const cache = new Map()

export function Seed(cx, cz) {
  const id = `${cx},${cz}`
  if (cache.has(id)) return cache.get(id)

  const r = rng(Math.floor(hash(cx, cz, 1) * 4294967295))
  const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE
  const station = StationOf(cx, cz)
  const onRoad = cx === 0
  const trees = [], rocks = [], props = [], fences = []
  const bushes = [], tufts = [], flowers = [], litter = [], logs = [], stumps = []

  const free = (x, z) => {
    if (onRoad && Math.abs(x) < ROAD_HALF + 1.6) return false
    if (station && Math.abs(x - station.x) < 5.6 && Math.abs(z - station.z) < 5.6) return false
    return true
  }
  const nearFence = (x, z, d) => fences.some((f) => Math.abs(x - f.x) < d && Math.abs(z - f.z) < 1.25 + d)
  const at = () => [ox - 0.5 + r() * CHUNK_SIZE, oz - 0.5 + r() * CHUNK_SIZE]

  // cercas de madeira ao longo da estrada (dá para pular)
  if (onRoad) {
    for (const side of [-1, 1]) {
      if (r() > 0.55) continue
      const x = side * (7 + r() * 1.2), z0 = oz + r() * 5, n = 2 + Math.floor(r() * 3)
      for (let i = 0; i < n; i++) {
        const z = z0 + i * 2.5 + 1.25
        if (free(x, z) && z < oz + 15) fences.push({ x, z })
      }
    }
  }

  // árvores
  const i0 = Math.floor((ox - 0.5) / TREE_CELL) - 1, i1 = Math.floor((ox + 15.5) / TREE_CELL) + 1
  const j0 = Math.floor((oz - 0.5) / TREE_CELL) - 1, j1 = Math.floor((oz + 15.5) / TREE_CELL) + 1
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const t = TreeAt(i, j)
      if (!t || t.x < ox - 0.5 || t.x >= ox + 15.5 || t.z < oz - 0.5 || t.z >= oz + 15.5) continue
      if (free(t.x, t.z) && !nearFence(t.x, t.z, 1.0) && Dirt(t.x, t.z) < 0.6) trees.push(t)
    }

  // pedras, troncos e tocos nunca nascem dentro de árvores (para ninguém ficar preso)
  for (let i = 0; i < 6; i++) {
    const [x, z] = at(), s = 0.6 + r() * 0.9
    if (free(x, z) && !nearTree(x, z, 1.6) && !nearFence(x, z, 1.0) && !rocks.some((o) => Math.hypot(o.x - x, o.z - z) < 2)) rocks.push({ x, z, s, ry: r() * 6 })
  }
  for (let i = 0, n = Math.floor(r() * 2.3); i < n; i++) {
    const [x, z] = at(), len = 2 + r() * 1.6, t = 0.8 + r() * 0.4, ry = r() > 0.5 ? 0 : Math.PI / 2
    if (free(x, z) && !nearTree(x, z, 2.4) && !nearFence(x, z, 1.6)) logs.push({ x, z, len, t, ry })
  }
  for (let i = 0, n = Math.floor(r() * 3.2); i < n; i++) {
    const [x, z] = at()
    if (free(x, z) && !nearTree(x, z, 1.6) && !nearFence(x, z, 1.0)) stumps.push({ x, z, s: 0.8 + r() * 0.6 })
  }

  // vegetação rasteira
  const plantOk = (x, z) => free(x, z) && Math.abs(x) > 4.8 && Dirt(x, z) < 0.5
  for (let i = 0; i < 10; i++) { const [x, z] = at(); if (plantOk(x, z)) bushes.push({ x, z, s: 0.6 + r() * 0.7, c: r() }) }
  for (let i = 0; i < 55; i++) { const [x, z] = at(); if (plantOk(x, z)) tufts.push({ x, z, s: 0.7 + r() * 0.8, ry: r() * 6.3, c: r() }) }
  for (let k = 0; k < 3; k++) {
    const [qx, qz] = at(), c = Math.floor(r() * 5)
    for (let j = 0; j < 9; j++) {
      const x = qx + (r() - 0.5) * 3.5, z = qz + (r() - 0.5) * 3.5
      if (plantOk(x, z)) flowers.push({ x, z, s: 0.8 + r() * 0.5, ry: r() * 6.3, c: r() < 0.2 ? Math.floor(r() * 5) : c })
    }
  }
  for (const t of trees) {
    if (t.k > 0.55) continue
    for (let j = 0; j < 3; j++) {
      const x = t.x + (r() - 0.5) * 4, z = t.z + (r() - 0.5) * 4
      if (free(x, z)) litter.push({ x, z, ry: r() * 6.3, c: Math.floor(r() * 4), s: 0.8 + r() * 0.8 })
    }
  }

  if (onRoad) {
    props.push({ type: 'pole', x: -4.6, z: oz + 4 }, { type: 'pole', x: -4.6, z: oz + 12 })
    if (!station && r() > 0.5) {
      props.push({ type: 'car', x: r() > 0.5 ? 1.5 : -1.5, z: oz + 2 + r() * 12, ry: (r() - 0.5) * 0.3, c: Math.floor(r() * 4) })
    }
  }
  if (station) props.push({ type: 'gas', x: station.x, z: station.z })

  const data = { trees, rocks, props, fences, bushes, tufts, flowers, litter, logs, stumps, tone: Math.floor(hash(cx, cz, 2) * 3), onRoad }
  cache.set(id, data)
  return data
}
