import { vnoise, smooth } from './noise'
import { StationOf } from './layout'

// Altura do terreno em qualquer ponto do mundo (determinística, então os chunks se encaixam).
// A estrada e o posto ficam planos; o resto ondula em colinas.
export function TerrainNoise(x, z) {
  let m = smooth(5, 14, Math.abs(x))
  if (m === 0) return 0
  const cz = Math.round((z - 7.5) / 16)
  for (let k = -1; k <= 1; k++) {
    const s = StationOf(0, cz + k)
    if (s) m = Math.min(m, smooth(6, 11, Math.max(Math.abs(x - s.x), Math.abs(z - s.z))))
  }
  if (m === 0) return 0
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

// Quanto o chão é terra (0 = grama, 1 = terra): manchas naturais + encostas íngremes + beira da estrada
export function Dirt(x, z) {
  let d = smooth(0.58, 0.72, vnoise(x * 0.06, z * 0.06, 21))
  const slope = Math.abs(TerrainNoise(x + 1, z) - TerrainNoise(x - 1, z)) + Math.abs(TerrainNoise(x, z + 1) - TerrainNoise(x, z - 1))
  d = Math.max(d, smooth(0.7, 1.5, slope) * 0.9)
  return Math.max(d, 1 - smooth(4.5, 7.5, Math.abs(x)))
}
