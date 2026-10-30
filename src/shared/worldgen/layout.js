import { hash, smooth } from '../../engine/world/noise'

// Rede de estradas + povoados (vilas e cidades pequenas). Tudo determinístico (só hash).
// Linhas verticais em x = 64·i; horizontais em z = ROW_Z + 64·j. Cada cruzamento ("nó") pode virar cidade ou vila.
export const CHUNK_SIZE = 16
export const ROAD_HALF = 3
export const GRID = 64
export const ROW_Z = 32
export const ZONE = { city: 40, village: 30 } // meia-extensão plana do povoado
export const FLAT = 11 // faixa totalmente plana ao lado das estradas principais

export const NodeX = (i) => i * GRID
export const NodeZ = (j) => ROW_Z + j * GRID

const nodeCache = new Map()
const nkey = (i, j) => (i + 2048) * 4096 + (j + 2048)

export function NodeType(i, j) {
  const k = nkey(i, j)
  let t = nodeCache.get(k)
  if (t !== undefined) return t
  if (i === 0 && j === 0) t = 'village' // vila logo ao sul da largada
  else if (i === 0 && j === 1) t = 'city' // primeira cidade
  else if (i === 0 && j === -1) t = null // norte da largada livre (posto)
  else {
    const h = hash(i, j, 103)
    t = h > 0.87 ? 'city' : h > 0.58 ? 'village' : null
  }
  nodeCache.set(k, t)
  return t
}

export const VSeg = (i, j) => i === 0 || !!NodeType(i, j) || !!NodeType(i, j + 1) || hash(i, j, 101) < 0.5
export const HSeg = (i, j) => (j === 0 && (i === 0 || i === -1)) || !!NodeType(i, j) || !!NodeType(i + 1, j) || hash(i, j, 102) < 0.65

// distância até as estradas verticais / horizontais principais (linhas centrais)
export function ArterialDistV(x, z) {
  let d = 1e9
  const i = Math.round(x / GRID), dx = Math.abs(x - i * GRID)
  if (dx < 40) {
    const j0 = Math.floor((z - ROW_Z) / GRID)
    for (let j = j0 - 1; j <= j0 + 1; j++) {
      if (!VSeg(i, j)) continue
      const z0 = NodeZ(j), z1 = z0 + GRID
      const dz = z < z0 ? z0 - z : z > z1 ? z - z1 : 0
      const dd = dz === 0 ? dx : Math.hypot(dx, dz)
      if (dd < d) d = dd
    }
  }
  return d
}
export function ArterialDistH(x, z) {
  let d = 1e9
  const j = Math.round((z - ROW_Z) / GRID), dz2 = Math.abs(z - NodeZ(j))
  if (dz2 < 40) {
    const i0 = Math.floor(x / GRID)
    for (let a = i0 - 1; a <= i0 + 1; a++) {
      if (!HSeg(a, j)) continue
      const x0 = a * GRID, x1 = x0 + GRID
      const dxx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0
      const dd = dxx === 0 ? dz2 : Math.hypot(dz2, dxx)
      if (dd < d) d = dd
    }
  }
  return d
}
export const ArterialDist = (x, z) => Math.min(ArterialDistV(x, z), ArterialDistH(x, z))

// ruas locais das cidades: 2 verticais (cx ± 20) e 2 horizontais (cz ± 20), comprimento 60
export const STREET_OFF = 22, STREET_HALF_LEN = 30, STREET_HW = 2.2
// calçadas (largura): avenidas e ruas locais das cidades; nas vilas só a estrada principal tem calçada
export const SW_ART = 2.0, SW_LOC = 1.5, SW_VIL = 1.5, CURB_H = 0.15
export function LocalDist(x, z) {
  let d = 1e9
  const i0 = Math.round(x / GRID), j0 = Math.round((z - ROW_Z) / GRID)
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      if (NodeType(i0 + di, j0 + dj) !== 'city') continue
      const cx = NodeX(i0 + di), cz = NodeZ(j0 + dj)
      for (const s of [-STREET_OFF, STREET_OFF]) {
        d = Math.min(d, Math.hypot(x - (cx + s), Math.max(0, Math.abs(z - cz) - STREET_HALF_LEN)))
        d = Math.min(d, Math.hypot(z - (cz + s), Math.max(0, Math.abs(x - cx) - STREET_HALF_LEN)))
      }
    }
  return d
}
export const RoadDist = (x, z) => Math.min(ArterialDist(x, z), LocalDist(x, z))

export function ZoneMask(x, z) {
  let m = 1
  const i0 = Math.round(x / GRID), j0 = Math.round((z - ROW_Z) / GRID)
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      const t = NodeType(i0 + di, j0 + dj)
      if (!t) continue
      const d = Math.max(Math.abs(x - NodeX(i0 + di)), Math.abs(z - NodeZ(j0 + dj)))
      m = Math.min(m, smooth(ZONE[t], ZONE[t] + 10, d))
    }
  return m
}
export function InZone(x, z, margin = 0) {
  const i0 = Math.round(x / GRID), j0 = Math.round((z - ROW_Z) / GRID)
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      const t = NodeType(i0 + di, j0 + dj)
      if (t && Math.max(Math.abs(x - NodeX(i0 + di)), Math.abs(z - NodeZ(j0 + dj))) < ZONE[t] + margin) return t
    }
  return null
}
export function Paved(x, z) {
  let m = 0
  const i0 = Math.round(x / GRID), j0 = Math.round((z - ROW_Z) / GRID)
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      if (NodeType(i0 + di, j0 + dj) !== 'city') continue
      const d = Math.max(Math.abs(x - NodeX(i0 + di)), Math.abs(z - NodeZ(j0 + dj)))
      m = Math.max(m, 1 - smooth(37, 42, d))
    }
  return m
}

// retângulos de estrada que tocam o chunk
export function RoadRects(cx, cz) {
  const ox = cx * CHUNK_SIZE - 0.5, oz = cz * CHUNK_SIZE - 0.5, ex = ox + CHUNK_SIZE, ez = oz + CHUNK_SIZE
  const out = []
  for (let i = Math.floor((ox - 6) / GRID); i <= Math.ceil((ex + 6) / GRID); i++) {
    const x = i * GRID
    if (x + 6 < ox || x - 6 > ex) continue
    for (let j = Math.floor((oz - ROW_Z) / GRID) - 1; j <= Math.ceil((ez - ROW_Z) / GRID); j++) {
      if (!VSeg(i, j)) continue
      const a = NodeZ(j) - ROAD_HALF, b = NodeZ(j + 1) + ROAD_HALF
      if (b >= oz && a <= ez) out.push({ axis: 'v', c: x, a, b, hw: ROAD_HALF, art: true })
    }
  }
  for (let j = Math.floor((oz - ROW_Z - 6) / GRID); j <= Math.ceil((ez - ROW_Z + 6) / GRID); j++) {
    const z = NodeZ(j)
    if (z + 6 < oz || z - 6 > ez) continue
    for (let i = Math.floor(ox / GRID) - 1; i <= Math.ceil(ex / GRID); i++) {
      if (!HSeg(i, j)) continue
      const a = i * GRID - ROAD_HALF, b = (i + 1) * GRID + ROAD_HALF
      if (b >= ox && a <= ex) out.push({ axis: 'h', c: z, a, b, hw: ROAD_HALF, art: true })
    }
  }
  const i0 = Math.round((ox + 8) / GRID), j0 = Math.round((oz + 8 - ROW_Z) / GRID)
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      if (NodeType(i0 + di, j0 + dj) !== 'city') continue
      const nx = NodeX(i0 + di), nz = NodeZ(j0 + dj)
      for (const s of [-STREET_OFF, STREET_OFF]) {
        if (nx + s + 5 >= ox && nx + s - 5 <= ex && nz + STREET_HALF_LEN >= oz && nz - STREET_HALF_LEN <= ez) out.push({ axis: 'v', c: nx + s, a: nz - STREET_HALF_LEN, b: nz + STREET_HALF_LEN, hw: STREET_HW, art: false })
        if (nz + s + 5 >= oz && nz + s - 5 <= ez && nx + STREET_HALF_LEN >= ox && nx - STREET_HALF_LEN <= ex) out.push({ axis: 'h', c: nz + s, a: nx - STREET_HALF_LEN, b: nx + STREET_HALF_LEN, hw: STREET_HW, art: false })
        // ligação com a cidade vizinha (leste e sul): as duas ruas se encontram em vez de terminarem no nada
        if (NodeType(i0 + di + 1, j0 + dj) === 'city') {
          const a = nx + STREET_HALF_LEN, b = nx + GRID - STREET_HALF_LEN
          if (b >= ox && a <= ex && nz + s + 3 >= oz && nz + s - 3 <= ez) out.push({ axis: 'h', c: nz + s, a, b, hw: STREET_HW, art: false })
        }
        if (NodeType(i0 + di, j0 + dj + 1) === 'city') {
          const a = nz + STREET_HALF_LEN, b = nz + GRID - STREET_HALF_LEN
          if (b >= oz && a <= ez && nx + s + 3 >= ox && nx + s - 3 <= ex) out.push({ axis: 'v', c: nx + s, a, b, hw: STREET_HW, art: false })
        }
      }
    }
  return out
}

// posto de gasolina na estrada principal: um ao norte da largada e outros longe de povoados
export function StationOf(cx, cz) {
  if (cx !== 0) return null
  const z = cz * CHUNK_SIZE + 7.5
  if (cz === -1) return { x: 10, z }
  if (cz < -2 || cz > 2) {
    if (hash(cx, cz, 7) <= 0.9) return null
    const j = Math.round((z - ROW_Z) / GRID), t = NodeType(0, j), d = Math.abs(z - NodeZ(j))
    if (d > (t ? ZONE[t] + 10 : 16)) return { x: 10, z }
  }
  return null
}

// ---------------------------------------------------------------------------------
//  Pontas de estrada: onde a estrada acaba precisa de um final decente (obra, praça com bancos, mato...)
// ---------------------------------------------------------------------------------
export const ARMS = [[0, -1], [0, 1], [-1, 0], [1, 0]] // N, S, W, E (direção de cada braço, saindo do nó)
export const NodeArms = (i, j) => [VSeg(i, j - 1), VSeg(i, j), HSeg(i - 1, j), HSeg(i, j)]

const endCache = new Map()
// pontas de um nó: da estrada principal (nó vazio com um só braço) e das ruas locais (cidades)
export function EndsOfNode(i, j) {
  const k = nkey(i, j)
  if (endCache.has(k)) return endCache.get(k)
  const out = [], t = NodeType(i, j), cx = NodeX(i), cz = NodeZ(j)
  if (!t) {
    const arms = NodeArms(i, j), n = arms.filter(Boolean).length
    if (n === 1) {
      const a = ARMS[arms.indexOf(true)], u = [-a[0], -a[1]], h = hash(i, j, 401)
      // E = fim do asfalto (3 m depois do centro do nó); P = centro da praça/obra
      out.push({ kind: 'art', type: h < 0.4 ? 'work' : h < 0.75 ? 'park' : 'wild', x: cx + u[0] * ROAD_HALF, z: cz + u[1] * ROAD_HALF, ux: u[0], uz: u[1], hw: ROAD_HALF, px: cx + u[0] * 6, pz: cz + u[1] * 6, id: `${i},${j}` })
    }
  } else if (t === 'city') {
    for (const s of [-STREET_OFF, STREET_OFF]) for (const [ux, uz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const vertical = uz !== 0
      const x = vertical ? cx + s : cx + ux * STREET_HALF_LEN, z = vertical ? cz + uz * STREET_HALF_LEN : cz + s
      const nb = NodeType(i + ux, j + uz) // vizinho na direção da ponta
      if (nb === 'city') continue // cidades vizinhas: as ruas se ligam (ver RoadRects), sem ponta
      const h = hash(i * 8 + (ux + 1) * 2 + (uz + 1), j * 4 + (s > 0 ? 1 : 0), 402)
      out.push({ kind: 'local', type: h < 0.45 ? 'work' : 'pocket', x, z, ux, uz, hw: STREET_HW, px: x + ux * 4, pz: z + uz * 4, id: `${i},${j},${s},${ux},${uz}` })
    }
  }
  endCache.set(k, out)
  return out
}
export function EndsNear(x0, x1, z0, z1, m = 18) {
  const out = []
  for (let i = Math.floor((x0 - m - 40) / GRID); i <= Math.ceil((x1 + m + 40) / GRID); i++)
    for (let j = Math.floor((z0 - m - 40 - ROW_Z) / GRID); j <= Math.ceil((z1 + m + 40 - ROW_Z) / GRID); j++)
      for (const e of EndsOfNode(i, j)) if (e.px > x0 - m && e.px < x1 + m && e.pz > z0 - m && e.pz < z1 + m) out.push(e)
  return out
}
// máscara de terreno plano em volta das pontas principais (praças/obras precisam de chão plano)
export function EndMask(x, z) {
  let m = 1
  const i0 = Math.round(x / GRID), j0 = Math.round((z - ROW_Z) / GRID)
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++)
      for (const e of EndsOfNode(i0 + di, j0 + dj)) if (e.kind === 'art') m = Math.min(m, smooth(11, 19, Math.hypot(x - e.px, z - e.pz)))
  return m
}
