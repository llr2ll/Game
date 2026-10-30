import { hash } from '../../engine/world/noise'
import { ArterialDistV, ArterialDistH, InZone, StationOf, CHUNK_SIZE } from './layout'
import { ItemsNear } from './town'
import { LimitedCache } from '../../engine/core/memo'

// Rede elétrica: postes numa grade global de 8 m ao lado das estradas principais (função pura -> chunks vizinhos concordam,
// então os fios sempre ligam um poste ao próximo e nunca terminam soltos no ar).
export const POLE_STEP = 8
export const POLE_SIDE = 4.6
const cache = LimitedCache(8000) // postes por trecho de estrada; esquece o que ficou para trás

export function PoleAt(axis, c, k) {
  const key = `${axis}${c},${k}`
  if (cache.has(key)) return cache.get(key)
  const v = axis === 'v', along = k * POLE_STEP + 4
  const x = v ? c - POLE_SIDE : along, z = v ? along : c - POLE_SIDE
  let p = null
  const own = v ? ArterialDistV(x, z) : ArterialDistH(x, z), cross = v ? ArterialDistH(x, z) : ArterialDistV(x, z)
  if (own < POLE_SIDE + 0.1 && cross > 5.6 && InZone(x, z, 0) !== 'city' && !ItemsNear(x - 1.4, x + 1.4, z - 1.4, z + 1.4).length) {
    const st = StationOf(0, Math.floor((z + 0.5) / CHUNK_SIZE))
    if (!(st && Math.abs(x - st.x) < 6.5 && Math.abs(z - st.z) < 6.5)) {
      const h = hash(Math.round(x * 4), Math.round(z * 4), 61)
      p = { x, z, ry: v ? 0 : Math.PI / 2, variant: h < 0.18 ? 'trafo' : h < 0.4 ? 'double' : 'plain', axis, c, k }
    }
  }
  cache.set(key, p)
  return p
}

// ponto de fixação de um cabo no poste (lat = deslocamento lateral na cruzeta, y = altura local)
export const Attach = (p, lat, y, base) => (p.ry ? [p.x, base + y, p.z - lat] : [p.x + lat, base + y, p.z])

// cabo de serviço: do poste até a casa mais próxima (se houver uma a menos de 15 m)
const dropCache = LimitedCache(3000)
export function PoleDrop(p) {
  const key = `${p.axis}${p.c},${p.k}`
  if (dropCache.has(key)) return dropCache.get(key)
  let out = null
  if (hash(Math.round(p.x * 3), Math.round(p.z * 3), 62) < 0.55) {
    let best = 15, tgt = null
    for (const it of ItemsNear(p.x - 15, p.x + 15, p.z - 15, p.z + 15)) {
      if (it.t !== 'b') continue
      const nx = Math.max(it.x - it.hw, Math.min(p.x, it.x + it.hw)), nz = Math.max(it.z - it.hd, Math.min(p.z, it.z + it.hd))
      const d = Math.hypot(nx - p.x, nz - p.z)
      if (d < best) { best = d; tgt = { x: nx, z: nz, it } }
    }
    if (tgt) out = { x: tgt.x, z: tgt.z, side: (p.ry ? -(tgt.z - p.z) : tgt.x - p.x) >= 0 ? 1 : -1 }
  }
  dropCache.set(key, out)
  return out
}

// vão quebrado? (um dos dois cabos arrebenta e as pontas ficam penduradas)
export function SpanBroken(p) {
  const h = hash(Math.round(p.x * 5), Math.round(p.z * 5), 63)
  return h < 0.13 ? (h < 0.065 ? -1 : 1) : 0
}

// há algum poste de luz a menos de m metros? (para placas não nascerem em cima dos postes)
export function PoleNear(x, z, m) {
  const i = Math.round(x / 64), jz = Math.round((z - 32) / 64)
  for (let k = Math.round((z - 4) / POLE_STEP) - 2; k <= Math.round((z - 4) / POLE_STEP) + 2; k++) { const p = PoleAt('v', i * 64, k); if (p && Math.hypot(p.x - x, p.z - z) < m) return true }
  for (let k = Math.round((x - 4) / POLE_STEP) - 2; k <= Math.round((x - 4) / POLE_STEP) + 2; k++) { const p = PoleAt('h', 32 + jz * 64, k); if (p && Math.hypot(p.x - x, p.z - z) < m) return true }
  return false
}
