import { hash } from './noise'

export const CHUNK_SIZE = 16
export const ROAD_HALF = 3 // estrada asfaltada em x = 0

// posto de gasolina: um colado na largada e outros espalhados ao longo da estrada
export function StationOf(cx, cz) {
  if (cx !== 0) return null
  if (cz === 0 || (Math.abs(cz) > 1 && hash(cx, cz, 7) > 0.9)) return { x: 10, z: cz * CHUNK_SIZE + 7.5 }
  return null
}
