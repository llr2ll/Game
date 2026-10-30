import * as THREE from 'three'
import { CHUNK_SIZE, GRID, ROW_Z, NodeType, NodeZ, ZONE, RoadRects, SW_ART, SW_LOC, SW_VIL, CURB_H } from './layout'
import { Height } from './terrain'
import { DeckAt } from './water-life'
import { WATER_Y } from './water'

// =====================================================================================
//  Calçadas de verdade: laje elevada (CURB_H) com meio-fio, nas avenidas e ruas das cidades e na estrada das vilas.
//  Os retângulos saem de uma função pura por chunk (SidewalkRects) — a mesma lista desenha a malha
//  e diz a altura do chão para jogadores/inimigos (GroundAt), então os dois sempre concordam.
// =====================================================================================

// trechos [lo, hi] da estrada r que têm calçada, e a largura
function spans(r) {
  if (!r.art) return [{ lo: r.a, hi: r.b, w: SW_LOC }]
  const out = []
  if (r.axis === 'v') {
    const i = Math.round(r.c / GRID), j = Math.round((r.a + 3 - ROW_Z) / GRID)
    const lo0 = NodeZ(j), hi0 = NodeZ(j + 1) // cada trecho cuida só de [nó, próximo nó) — nada se sobrepõe
    for (const jj of [j, j + 1]) {
      const t = NodeType(i, jj)
      if (!t) continue
      const L = ZONE[t] - 2, z = NodeZ(jj)
      const lo = Math.max(lo0, z - L), hi = Math.min(hi0, z + L)
      if (hi > lo) out.push({ lo, hi, w: t === 'city' ? SW_ART : SW_VIL })
    }
  } else {
    const j = Math.round((r.c - ROW_Z) / GRID), i = Math.round((r.a + 3) / GRID)
    const lo0 = i * GRID, hi0 = (i + 1) * GRID
    for (const ii of [i, i + 1]) {
      const t = NodeType(ii, j)
      if (!t) continue
      const L = ZONE[t] - 2, x = ii * GRID
      const lo = Math.max(lo0, x - L), hi = Math.min(hi0, x + L)
      if (hi > lo) out.push({ lo, hi, w: t === 'city' ? SW_ART : SW_VIL })
    }
  }
  return out
}
const widthAt = (r, t) => { for (const s of spans(r)) if (t >= s.lo && t <= s.hi) return s.w; return 0 }

const cache = new Map()
export function SidewalkRects(cx, cz) {
  const key = cx * 100003 + cz
  if (cache.has(key)) return cache.get(key)
  const ox = cx * CHUNK_SIZE - 0.5, oz = cz * CHUNK_SIZE - 0.5, ex = ox + CHUNK_SIZE, ez = oz + CHUNK_SIZE
  const roads = RoadRects(cx, cz), out = []
  for (const r of roads) {
    const v = r.axis === 'v'
    for (const sp of spans(r)) for (const side of [-1, 1]) {
      const c0 = r.c + side * r.hw, c1 = r.c + side * (r.hw + sp.w), cmin = Math.min(c0, c1), cmax = Math.max(c0, c1)
      // cortes: asfalto das ruas que cruzam esta calçada (e, nas horizontais, também a calçada delas — o canto fica com a vertical)
      let parts = [[sp.lo, sp.hi]]
      for (const p of roads) {
        if (p.axis === r.axis || p.b < cmin || p.a > cmax) continue
        const wp = r.axis === 'h' ? widthAt(p, (cmin + cmax) / 2) : 0
        const k0 = p.c - p.hw - wp, k1 = p.c + p.hw + wp
        parts = parts.flatMap(([a, b]) => (k1 <= a || k0 >= b ? [[a, b]] : [[a, k0], [k1, b]].filter(([x, y]) => y - x > 0.05)))
      }
      for (const [a, b] of parts) {
        const R = v ? { x0: cmin, x1: cmax, z0: a, z1: b } : { x0: a, x1: b, z0: cmin, z1: cmax }
        R.curb = v ? (side > 0 ? 'x0' : 'x1') : (side > 0 ? 'z0' : 'z1') // lado do meio-fio (voltado para o asfalto)
        R.x0 = Math.max(R.x0, ox); R.x1 = Math.min(R.x1, ex); R.z0 = Math.max(R.z0, oz); R.z1 = Math.min(R.z1, ez)
        if (R.x1 - R.x0 > 0.02 && R.z1 - R.z0 > 0.02) out.push(R)
      }
    }
  }
  cache.set(key, out)
  return out
}

export function SidewalkLift(x, z) {
  const rs = SidewalkRects(Math.floor((x + 0.5) / CHUNK_SIZE), Math.floor((z + 0.5) / CHUNK_SIZE))
  for (const r of rs) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return CURB_H
  return 0
}
// altura onde os pés pisam (terreno + calçada)
// altura onde os pés pisam (terreno + calçada, ou o piso de píer/ponte/pedra)
export const BaseGround = (x, z) => Height(x, z) + SidewalkLift(x, z) // sem píer/ponte
export const GroundAt = (x, z) => Math.max(BaseGround(x, z), DeckAt(x, z))
// profundidade da água sob os pés (0 = seco). Acima de SWIM_DEPTH não dá pé: nada
export const SWIM_DEPTH = 0.7
export const WaterDepth = (x, z) => Math.max(0, WATER_Y - GroundAt(x, z))
export const TooDeep = (x, z) => WaterDepth(x, z) > SWIM_DEPTH

// ---------- malha ----------
function tileTexture() {
  if (typeof document === 'undefined') return null
  try {
    const c = document.createElement('canvas'); c.width = c.height = 64
    const x = c.getContext('2d')
    if (!x) return null
    x.fillStyle = '#a99a80'; x.fillRect(0, 0, 64, 64)
    const cols = ['#e9dcc0', '#e2d3b4', '#eee3ca', '#dccdb0']
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      x.fillStyle = cols[i * 2 + j]; x.fillRect(i * 32 + 2, j * 32 + 2, 28, 28)
      x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(i * 32 + 2, j * 32 + 2, 28, 3) // brilho na borda de cima (pedra "de brinquedo")
      x.fillStyle = 'rgba(80,60,40,0.15)'; x.fillRect(i * 32 + 2, j * 32 + 27, 28, 3)
    }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  } catch { return null }
}
const tex = tileTexture()
export const SidewalkMat = new THREE.MeshLambertMaterial({ map: tex, color: tex ? 0xffffff : 0xe2d6bc })
const CurbMat = new THREE.MeshLambertMaterial({ vertexColors: true })

export function BuildSidewalks(g, cx, cz, dispose) {
  const rs = SidewalkRects(cx, cz)
  if (!rs.length) return
  const tp = [], tu = [], cp = [], cc = []
  const C = new THREE.Color()
  const quadTop = (x0, x1, z0, z1, y) => {
    tp.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0)
    for (const [x, z] of [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]]) tu.push(x * 0.9, z * 0.9)
  }
  const flip = (pts) => [pts[0], pts[2], pts[1], pts[3], pts[5], pts[4]] // inverte o sentido dos 2 triângulos
  const pushC = (pts, hex) => { C.set(hex); for (const p of pts) { cp.push(...p); cc.push(C.r, C.g, C.b) } }
  for (const r of rs) {
    const y0 = Height((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2), y = y0 + CURB_H, yb = y0 - 0.12
    let { x0, x1, z0, z1 } = r
    // faixa do meio-fio (pedra clara) + resto em ladrilho
    const K = 0.28
    if (r.curb === 'x0') { pushC([[x0, y + 0.002, z0], [x0, y + 0.002, z1], [x0 + K, y + 0.002, z1], [x0, y + 0.002, z0], [x0 + K, y + 0.002, z1], [x0 + K, y + 0.002, z0]], 0xd8dbe2); x0 += K }
    if (r.curb === 'x1') { pushC([[x1 - K, y + 0.002, z0], [x1 - K, y + 0.002, z1], [x1, y + 0.002, z1], [x1 - K, y + 0.002, z0], [x1, y + 0.002, z1], [x1, y + 0.002, z0]], 0xd8dbe2); x1 -= K }
    if (r.curb === 'z0') { pushC([[x0, y + 0.002, z0], [x0, y + 0.002, z0 + K], [x1, y + 0.002, z0 + K], [x0, y + 0.002, z0], [x1, y + 0.002, z0 + K], [x1, y + 0.002, z0]], 0xd8dbe2); z0 += K }
    if (r.curb === 'z1') { pushC([[x0, y + 0.002, z1 - K], [x0, y + 0.002, z1], [x1, y + 0.002, z1], [x0, y + 0.002, z1 - K], [x1, y + 0.002, z1], [x1, y + 0.002, z1 - K]], 0xd8dbe2); z1 -= K }
    quadTop(x0, x1, z0, z1, y)
    // laterais (meio-fio): 4 faces verticais, cinza com sombra embaixo
    const X0 = r.x0, X1 = r.x1, Z0 = r.z0, Z1 = r.z1, side = 0xb7bbc6
    pushC(flip([[X0, yb, Z0], [X1, yb, Z0], [X1, y, Z0], [X0, yb, Z0], [X1, y, Z0], [X0, y, Z0]]), side) // -z
    pushC(flip([[X1, yb, Z1], [X0, yb, Z1], [X0, y, Z1], [X1, yb, Z1], [X0, y, Z1], [X1, y, Z1]]), side) // +z
    pushC(flip([[X0, yb, Z1], [X0, yb, Z0], [X0, y, Z0], [X0, yb, Z1], [X0, y, Z0], [X0, y, Z1]]), side) // -x
    pushC(flip([[X1, yb, Z0], [X1, yb, Z1], [X1, y, Z1], [X1, yb, Z0], [X1, y, Z1], [X1, y, Z0]]), side) // +x
  }
  const mk = (pos, attr, name, n, mat) => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute(name, new THREE.Float32BufferAttribute(attr, n))
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, mat)
    g.add(m); dispose.push(geo)
  }
  mk(tp, tu, 'uv', 2, SidewalkMat)
  mk(cp, cc, 'color', 3, CurbMat)
}
