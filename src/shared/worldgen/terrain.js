import { vnoise, smooth } from '../../engine/world/noise'
import { StationOf, ArterialDist, RoadDist, ZoneMask, EndMask, FLAT, ROAD_HALF } from './layout'
import { Carve, WATER_Y } from './water'

// Altura do terreno em qualquer ponto do mundo (determinística, então os chunks se encaixam).
// A estrada e o posto ficam planos; o resto ondula em colinas.
export function TerrainNoise(x, z) {
  const ad = ArterialDist(x, z)
  // vales nunca descem abaixo do nível da água (senão "alagariam" fora dos lagos/rios de verdade):
  // piso suave em FLOOR (contínuo e com a mesma inclinação na emenda)
  let h = BaseNoise(x, z, ad)
  if (h < FLOOR + 0.25) h = FLOOR + 0.25 * Math.exp((h - FLOOR - 0.25) / 0.25) // chão plano (0) não é afetado
  return Carve(h, x, z, ad, ROAD_HALF) // lagos e rios cavam o leito
}
const FLOOR = WATER_Y + 0.15
function BaseNoise(x, z, ad) {
  // plano nas estradas e nos povoados; no resto, colinas
  let m = smooth(FLAT, FLAT + 9, ad)
  if (m === 0) return 0
  m = Math.min(m, ZoneMask(x, z))
  if (m === 0) return 0
  m = Math.min(m, EndMask(x, z))
  if (m === 0) return 0
  if (Math.abs(x - 10) < 20) {
    const cz = Math.round((z - 7.5) / 16)
    for (let k = -1; k <= 1; k++) {
      const s = StationOf(0, cz + k)
      if (s) m = Math.min(m, smooth(6, 11, Math.max(Math.abs(x - s.x), Math.abs(z - s.z))))
    }
    if (m === 0) return 0
  }
  const h = (vnoise(x * 0.045, z * 0.045, 11) * 2 - 1) * 4 + (vnoise(x * 0.11, z * 0.11, 12) * 2 - 1) * 0.8 + (vnoise(x * 0.3, z * 0.3, 13) - 0.5) * 0.3
  return h * m
}

// Altura da SUPERFÍCIE REAL do chão (a mesma malha de triângulos que é desenhada).
// Vértices ficam em x = n + 0.5, a cada 1 unidade; a diagonal de cada quadrado liga (0,1) a (1,0).
export function Height(x, z) {
  const gx = x - 0.5, gz = z - 0.5
  const ix = Math.floor(gx), iz = Math.floor(gz)
  const u = gx - ix, v = gz - iz
  const x0 = ix + 0.5, z0 = iz + 0.5
  const ha = TerrainNoise(x0, z0), hd = TerrainNoise(x0 + 1, z0), hb = TerrainNoise(x0, z0 + 1)
  if (u + v <= 1) return ha + u * (hd - ha) + v * (hb - ha)
  const hc = TerrainNoise(x0 + 1, z0 + 1)
  return hc + (1 - u) * (hb - hc) + (1 - v) * (hd - hc)
}

// Quanto o chão é terra (0 = grama, 1 = terra): manchas naturais + encostas íngremes + beira da estrada.
// DirtAt recebe a inclinação já calculada (o gerador de chunks reaproveita a grade de alturas e evita recalcular).
export function DirtAt(x, z, slope) {
  let d = smooth(0.58, 0.72, vnoise(x * 0.06, z * 0.06, 21))
  d = Math.max(d, smooth(0.7, 1.5, slope) * 0.9)
  return Math.max(d, 1 - smooth(4.5, 7.5, RoadDist(x, z)))
}
export function Dirt(x, z) {
  const slope = Math.abs(TerrainNoise(x + 1, z) - TerrainNoise(x - 1, z)) + Math.abs(TerrainNoise(x, z + 1) - TerrainNoise(x, z - 1))
  return DirtAt(x, z, slope)
}
