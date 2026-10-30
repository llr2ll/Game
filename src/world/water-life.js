import { hash } from './noise'
import { GRID, ROW_Z, ArterialDist, InZone } from './layout'
import { CellWater, RiverZ, riverW, WaterSD, WATER_Y } from './water'

// =====================================================================================
//  Estruturas da água (determinísticas, por célula): píeres nos lagos, pontezinhas de madeira e pedras de
//  travessia nos rios, barcos. DeckAt diz a altura do piso dessas estruturas -> GroundAt usa isso, então dá
//  para andar no píer, atravessar a ponte e pular de pedra em pedra.
// =====================================================================================
export const DECK_Y = WATER_Y + 0.5 // piso do píer
const cache = new Map()
const ckey = (i, j) => (i + 2048) * 4096 + (j + 2048)

export function WaterLife(i, j) {
  const k = ckey(i, j)
  if (cache.has(k)) return cache.get(k)
  const out = { piers: [], bridges: [], stones: [], boats: [] }
  cache.set(k, out)
  let n = 0
  for (const b of CellWater(i, j)) {
    n++
    const H = (s) => hash(i * 7 + n, j, 900 + s)
    if (b.type === 'lake' && b.R >= 5.5) {
      // píer: procura uma margem seca, longe da estrada, e avança para o centro
      if (H(1) < 0.8) {
        for (let t = 0; t < 8; t++) {
          const a = H(2) * 6.283 + t * 0.785, ux = Math.cos(a), uz = Math.sin(a)
          let r = b.R * 0.5
          while (r < b.R * 2 && WaterSD(b.x + ux * r, b.z + uz * r) < 0.35) r += 0.25
          const sx = b.x + ux * r, sz = b.z + uz * r
          if (ArterialDist(sx, sz) < 8 || InZone(sx, sz, 0) === 'city') continue
          const L = Math.min(6.5, r - 2)
          const ex = sx - ux * L, ez = sz - uz * L
          if (L < 3 || WaterSD(ex, ez) > -1.2) continue
          const p = { x: sx, z: sz, th: Math.atan2(-ux, -uz), L, ux: -ux, uz: -uz }
          out.piers.push(p)
          // barco amarrado ao lado da ponta do píer
          const side = H(3) < 0.5 ? -1 : 1, nx = uz * side, nz = -ux * side
          const bx = sx - ux * (L - 1.4) + nx * 1.55, bz = sz - uz * (L - 1.4) + nz * 1.55
          if (WaterSD(bx, bz) < -1.0) out.boats.push({ x: bx, z: bz, th: p.th + (H(4) - 0.5) * 0.25, c: Math.floor(H(5) * 3) })
          break
        }
      }
      // barco solto no meio de lago grande
      if (b.R >= 8 && H(6) < 0.6) {
        const a = H(7) * 6.283, rr = b.R * 0.35
        const x = b.x + Math.cos(a) * rr, z = b.z + Math.sin(a) * rr
        if (WaterSD(x, z) < -2 && !out.boats.some((o) => Math.hypot(o.x - x, o.z - z) < 4)) out.boats.push({ x, z, th: H(8) * 6.283, c: Math.floor(H(9) * 3) })
      }
    } else if (b.type === 'river' && b.xe - b.xs > 18) {
      // travessia no meio do rio: ponte de madeira em arco ou pedras
      const bx = b.xs + 7 + H(10) * (b.xe - b.xs - 14), zc = RiverZ(b, bx), w = riverW(b, bx)
      const s = RiverZ(b, bx + 0.5) - RiverZ(b, bx - 0.5)
      if (ArterialDist(bx, zc) > 12) {
        if (H(11) < 0.6) out.bridges.push({ x: bx, z: zc, H: w * Math.sqrt(1 + s * s) + 2.3 })
        else {
          const half = w * Math.sqrt(1 + s * s) + 0.4
          for (let t = -half; t <= half + 0.01; t += 0.85) out.stones.push({ x: bx + (hash(Math.round(t * 10), i, 931) - 0.5) * 0.3, z: zc + t, r: 0.42 + hash(Math.round(t * 10), j, 932) * 0.08 })
        }
      }
    }
  }
  return out
}
const cellOf = (x, z) => [Math.floor(x / GRID), Math.floor((z - ROW_Z) / GRID)]

// altura do arco da ponte de madeira (t = posição ao longo dela, a partir do centro)
export const BridgeY = (b, t) => WATER_Y + 0.55 + 0.55 * (1 - (t / b.H) ** 2)
export const STONE_Y = WATER_Y + 0.2

// piso de alguma estrutura em (x,z), ou -Infinity
export function DeckAt(x, z) {
  const [i, j] = cellOf(x, z)
  const L = WaterLife(i, j)
  for (const p of L.piers) {
    const dx = x - p.x, dz = z - p.z, along = dx * p.ux + dz * p.uz, across = dx * p.uz - dz * p.ux
    if (along >= -0.3 && along <= p.L && Math.abs(across) <= 0.8) return DECK_Y
  }
  for (const b of L.bridges) if (Math.abs(x - b.x) <= 0.8 && Math.abs(z - b.z) <= b.H) return BridgeY(b, z - b.z)
  for (const s of L.stones) if ((x - s.x) ** 2 + (z - s.z) ** 2 <= s.r * s.r) return STONE_Y
  return -Infinity
}

// perto da ponta em terra de alguma estrutura (para não nascer árvore/pedra bloqueando a entrada)
export function NearWaterStruct(x, z, m) {
  const [i, j] = cellOf(x, z)
  const L = WaterLife(i, j)
  for (const p of L.piers) if (Math.hypot(x - p.x, z - p.z) < m + 1 || Math.hypot(x - (p.x + p.ux * p.L / 2), z - (p.z + p.uz * p.L / 2)) < m + p.L / 2) return true
  for (const b of L.bridges) if (Math.abs(x - b.x) < m + 1 && Math.abs(z - b.z) < b.H + m + 1) return true
  for (const s of L.stones) if (Math.hypot(x - s.x, z - s.z) < m + 1) return true
  for (const b of L.boats) if (Math.hypot(x - b.x, z - b.z) < m + 1.5) return true
  return false
}
