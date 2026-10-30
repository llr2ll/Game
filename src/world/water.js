import { hash, smooth } from './noise'
import { GRID, ROW_Z, NodeType, NodeZ, VSeg, StationOf, CHUNK_SIZE } from './layout'

// =====================================================================================
//  Lagos e rios (determinístico: só hash). O mundo é dividido em "células" entre as estradas principais:
//  x ∈ [64·i, 64·i + 64], z ∈ [NodeZ(j), NodeZ(j) + 64]. Cada célula pode ter um lago no meio ou um rio
//  que corre no sentido x pelo meio dela. Rios de células vizinhas se ligam passando por baixo da estrada
//  (ponte); onde não se ligam, terminam num laguinho. Nada disso entra em cidades.
// =====================================================================================
export const WATER_Y = -0.45 // nível da água (o chão plano das estradas fica em 0)

const cellCache = new Map()
const ckey = (i, j) => (i + 2048) * 4096 + (j + 2048)
const isTown = (i, j) => !!NodeType(i, j)
const cityAround = (i, j) => [[0, 0], [1, 0], [0, 1], [1, 1]].some(([a, b]) => NodeType(i + a, j + b) === 'city')
const villageAround = (i, j) => [[0, 0], [1, 0], [0, 1], [1, 1]].some(([a, b]) => NodeType(i + a, j + b) === 'village')

function riverCell(i, j) {
  if (cityAround(i, j)) return false
  if ((i === 0 || i === -1) && j === -1) return false // células da largada: lago
  return hash(i, j, 701) < 0.34
}
// o rio da célula (i,j) atravessa a estrada x = 64·(i+1) e continua na célula (i+1,j)?
function crossEast(i, j) {
  if (!riverCell(i, j) || !riverCell(i + 1, j)) return false
  if (isTown(i + 1, j) || isTown(i + 1, j + 1)) return false
  const X = (i + 1) * GRID, zm = NodeZ(j) + GRID / 2
  if (X === 0) for (let c = Math.floor((zm - 24) / CHUNK_SIZE); c <= Math.floor((zm + 24) / CHUNK_SIZE); c++) if (StationOf(0, c)) return false
  return true
}

function lake(x, z, R, s) {
  return { type: 'lake', x, z, R, p1: s * 6.28, p2: s * 17.1, x0: x - R * 1.3 - 1, x1: x + R * 1.3 + 1, z0: z - R * 1.3 - 1, z1: z + R * 1.3 + 1 }
}

export function CellWater(i, j) {
  const k = ckey(i, j)
  if (cellCache.has(k)) return cellCache.get(k)
  const out = []
  cellCache.set(k, out)
  const x0 = i * GRID, zm = NodeZ(j) + GRID / 2
  if (riverCell(i, j)) {
    const W = crossEast(i - 1, j), E = crossEast(i, j)
    const r = {
      type: 'river', x0, zm, A: 3.5 + hash(i, j, 703) * 3, ph: hash(i, j, 704) * 6.28, w: 1.6 + hash(i, j, 705) * 0.6,
      xs: W ? x0 - 3 : x0 + 19, xe: E ? x0 + GRID + 3 : x0 + GRID - 19, W, E,
    }
    r.x0b = r.xs - 3; r.x1b = r.xe + 3; r.z0 = zm - r.A - r.w * 1.3 - 1; r.z1 = zm + r.A + r.w * 1.3 + 1
    out.push(r)
    if (!W) out.push(lake(r.xs, RiverZ(r, r.xs), 4.5 + hash(i, j, 706) * 1.8, hash(i, j, 707)))
    if (!E) out.push(lake(r.xe, RiverZ(r, r.xe), 4.5 + hash(i, j, 708) * 1.8, hash(i, j, 709)))
  } else if (!cityAround(i, j) && (((i === 0 || i === -1) && j === -1) || hash(i, j, 702) < 0.3)) {
    const big = villageAround(i, j) ? 8.5 : 12
    out.push(lake(x0 + GRID / 2 + (hash(i, j, 710) - 0.5) * 8, zm + (hash(i, j, 711) - 0.5) * 8, 6.5 + hash(i, j, 712) * (big - 6.5), hash(i, j, 713)))
  }
  return out
}

// linha central do rio (fica reta perto das estradas, para a ponte ser perpendicular)
export function RiverZ(r, x) {
  const taper = smooth(5, 18, Math.min(x - r.x0, r.x0 + GRID - x)) // reto ~5 m de cada lado da ponte
  return r.zm + r.A * Math.sin(x * 0.085 + r.ph) * taper + 1.2 * Math.sin(x * 0.23 + r.ph * 2) * taper
}
export const riverW = (r, x) => r.w * (1 + 0.18 * Math.sin(x * 0.13 + r.ph))

function bodySD(b, x, z) {
  if (b.type === 'lake') {
    const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx)
    return d - b.R * (1 + 0.17 * Math.sin(2 * a + b.p1) + 0.09 * Math.sin(3 * a + b.p2))
  }
  const xc = Math.max(b.xs, Math.min(b.xe, x)), zc = RiverZ(b, xc)
  const s = RiverZ(b, xc + 0.5) - RiverZ(b, xc - 0.5), dz = z - zc
  const d = x === xc ? Math.abs(dz) / Math.sqrt(1 + s * s) : Math.hypot(x - xc, dz)
  return d - riverW(b, xc)
}

// distância (com sinal) até a margem da água mais próxima: negativo = dentro da água
export function WaterSD(x, z) {
  const i0 = Math.floor(x / GRID), j0 = Math.floor((z - ROW_Z) / GRID)
  let best = 99
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++)
      for (const b of CellWater(i0 + di, j0 + dj)) {
        const bx0 = b.type === 'lake' ? b.x0 : b.x0b, bx1 = b.type === 'lake' ? b.x1 : b.x1b
        if (x < bx0 - 8 || x > bx1 + 8 || z < b.z0 - 8 || z > b.z1 + 8) continue
        const d = bodySD(b, x, z)
        if (d < best) best = d
      }
  return best
}
// água funda demais para andar (o raso da margem dá para atravessar)
export const Deep = (x, z) => WaterSD(x, z) < -1.15

// pontes: onde um rio passa por baixo de uma estrada vertical que existe
export function BridgesNear(x0, x1, z0, z1) {
  const out = []
  for (let i = Math.floor(x0 / GRID) - 1; i <= Math.ceil(x1 / GRID); i++)
    for (let j = Math.floor((z0 - ROW_Z) / GRID) - 1; j <= Math.ceil((z1 - ROW_Z) / GRID); j++) {
      if (!crossEast(i, j)) continue
      const X = (i + 1) * GRID, zm = NodeZ(j) + GRID / 2
      if (!VSeg(i + 1, j)) continue
      if (X + 8 < x0 || X - 8 > x1 || zm + 8 < z0 || zm - 8 > z1) continue
      const r = CellWater(i, j)[0]
      out.push({ x: X, z: zm, half: riverW(r, X) + 2.6 })
    }
  return out
}

// rebaixa o terreno base para formar o leito (chamado por TerrainNoise)
export function Carve(base, x, z, roadDist, roadHalf) {
  const sd = WaterSD(x, z)
  if (sd > 7) return base
  const bed = sd < 0 ? Math.max(WATER_Y - 1.4, WATER_Y + 0.3 + sd * 0.6) : WATER_Y + 0.3 + sd * 0.05
  // perto da estrada o leito some (a pista continua por cima: é a ponte)
  const w = (1 - smooth(0, 7, sd)) * smooth(roadHalf + 1.3, roadHalf + 2.2, roadDist)
  return base + (bed - base) * w
}
