import { hash, vnoise } from '../../engine/world/noise'
import { CHUNK_SIZE, ROAD_HALF, StationOf, RoadRects, ArterialDist, LocalDist, InZone } from './layout'
import { Dirt } from './terrain'
import { ItemsNear } from './town'
import { PoleAt, PoleDrop, SpanBroken, POLE_STEP } from './poles'
import { PlacesNear } from './endings'
import { CityStuffNear } from './city-lots'
import { SignsNear, SignPos } from './signs'
import { WearFor } from './roadwear'
import { WaterSD, WATER_Y } from './water'
import { WaterLife, NearWaterStruct } from './water-life'
import { GRID as WGRID, ROW_Z as WROW } from './layout'

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
  const roads = RoadRects(cx, cz)
  const arts = roads.filter((q) => q.art)
  const near = ItemsNear(ox - 6, ox + CHUNK_SIZE + 6, oz - 6, oz + CHUNK_SIZE + 6) // casas/decoração que tocam este chunk (+margem)
  const inChunk = (it) => it.x >= ox - 0.5 && it.x < ox + CHUNK_SIZE - 0.5 && it.z >= oz - 0.5 && it.z < oz + CHUNK_SIZE - 0.5
  const buildings = near.filter((it) => it.t === 'b' && inChunk(it))
  const decor = near.filter((it) => it.t === 'd' && inChunk(it))
  const trees = [], rocks = [], props = [], fences = []
  // finais de estrada (obra / praça / mato) e sinalização que tocam este chunk
  const places = PlacesNear(ox - 16, ox + 32, oz - 16, oz + 32)
  const allSigns = SignsNear(ox - 10, ox + 26, oz - 10, oz + 26)
  const signPoles = []
  for (const sg of allSigns) { if (sg.kind === 'sign') signPoles.push(...sg.poles); else if (sg.kind === 'km' || sg.kind === 'light') signPoles.push([sg.x, sg.z]) }
  for (const pl of places) for (const sg of pl.p.signs) signPoles.push(...sg.poles)
  const bushes = [], tufts = [], flowers = [], litter = [], logs = [], stumps = []

  // retângulo da casa/decoração aumentado em m (e mais 3m na frente da porta, para a entrada ficar livre)
  const nearItem = (x, z, m) => near.some((it) => {
    let x0 = it.x - it.hw - m, x1 = it.x + it.hw + m, z0 = it.z - it.hd - m, z1 = it.z + it.hd + m
    if (it.t === 'b') {
      const fx = Math.round(Math.sin(it.ry)), fz = Math.round(Math.cos(it.ry))
      if (fx > 0) x1 += 3; else if (fx < 0) x0 -= 3
      if (fz > 0) z1 += 3; else if (fz < 0) z0 -= 3
    }
    return x > x0 && x < x1 && z > z0 && z < z1
  })
  const inC = (x, z) => x >= ox - 0.5 && x < ox + CHUNK_SIZE - 0.5 && z >= oz - 0.5 && z < oz + CHUNK_SIZE - 0.5
  // lotes das cidades (onde vila e cidade se encostam, InZone pode responder 'vila' dentro de um lote da cidade)
  const cityStuff = CityStuffNear(ox - 1, ox + CHUNK_SIZE, oz - 1, oz + CHUNK_SIZE)
  const lotAreas = cityStuff.filter((c) => c.area).map((c) => c.area)
  const roadFree = (x, z, extra = 0) => ArterialDist(x, z) > ROAD_HALF + 1.6 + extra && LocalDist(x, z) > 3.6 + extra
  const free = (x, z) => {
    if (!roadFree(x, z)) return false
    if (station && Math.abs(x - station.x) < 5.6 && Math.abs(z - station.z) < 5.6) return false
    if (InZone(x, z, 0) === 'city' || lotAreas.some((L) => x > L.x0 - 1 && x < L.x1 + 1 && z > L.z0 - 1 && z < L.z1 + 1)) return false
    if (WaterSD(x, z) < 1.2 || NearWaterStruct(x, z, 0.6)) return false
    for (const pl of places) { const b = pl.p.block; if (Math.hypot(x - b.x, z - b.z) < b.r) return false }
    for (const q of signPoles) if (Math.abs(x - q[0]) < 1.7 && Math.abs(z - q[1]) < 1.7) return false
    return !nearItem(x, z, 1.4)
  }
  const nearFence = (x, z, d) => fences.some((f) => (f.ry ? Math.abs(z - f.z) < d && Math.abs(x - f.x) < 1.25 + d : Math.abs(x - f.x) < d && Math.abs(z - f.z) < 1.25 + d))
  const at = () => [ox - 0.5 + r() * CHUNK_SIZE, oz - 0.5 + r() * CHUNK_SIZE]

  // cercas de madeira ao longo das estradas principais (dá para pular).
  // Grade global de 2,5 m + decisão por grupo de 4 vãos (hash): determinístico, então nunca duplica nem empilha entre chunks/trechos.
  const fenceKeys = new Set()
  for (const q of arts) {
    const v = q.axis === 'v', lo = (v ? oz : ox) - 0.5, hi = lo + CHUNK_SIZE
    for (const side of [-1, 1]) {
      const off = side * 7.6
      for (let k = Math.ceil((lo - 1.25) / 2.5); k * 2.5 + 1.25 < hi; k++) {
        const along = k * 2.5 + 1.25
        if (along < lo) continue
        const kk = `${q.axis}${q.c},${side},${k}`
        if (fenceKeys.has(kk) || hash(q.c * 7 + side, Math.floor(k / 4), v ? 81 : 82) > 0.28) continue
        fenceKeys.add(kk)
        const x = v ? q.c + off : along, z = v ? along : q.c + off
        if (inC(x, z) && free(x, z) && ArterialDist(x, z) > 6.2 && !InZone(x, z, 4)) fences.push({ x, z, ry: v ? 0 : Math.PI / 2 })
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
  const plantOk = (x, z) => free(x, z) && Dirt(x, z) < 0.5
  for (let i = 0; i < 10; i++) { const [x, z] = at(); if (plantOk(x, z)) bushes.push({ x, z, s: 0.6 + r() * 0.7, c: r() }) }
  // capim alto (estilo da referência): canteiros DENSOS numa grade global de 0,8 m onde o ruído é alto; touceiras soltas no resto
  const GC = 0.8
  for (let gi = Math.ceil((ox - 0.5) / GC); gi * GC < ox + 15.5; gi++) for (let gj = Math.ceil((oz - 0.5) / GC); gj * GC < oz + 15.5; gj++) {
    const hx = hash(gi, gj, 52), x = gi * GC + (hx - 0.5) * 0.45, z = gj * GC + (hash(gi, gj, 53) - 0.5) * 0.45
    const n = vnoise(x * 0.07, z * 0.07, 51), dense = n > 0.6
    if (!(dense || hx < 0.035) || !inC(x, z) || !plantOk(x, z)) continue
    tufts.push({ x, z, s: dense ? 0.95 + hash(gi, gj, 54) * 0.45 + (n - 0.6) * 0.8 : 0.6 + hash(gi, gj, 54) * 0.35, ry: hash(gi, gj, 55) * 6.3, c: hash(gi, gj, 56) })
  }
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

  // hortas: fileiras de leiras + plantas numa grade fixa da horta (cada planta pertence ao chunk onde cai)
  const fields = near.filter((it) => it.t === 'f'), crops = [], scarecrows = []
  for (const f of fields) {
    const SP = f.crop === 'corn' ? 0.9 : 0.75, RW = 1.0
    const nRows = Math.max(1, Math.floor(((f.ax ? f.hd : f.hw) * 2 - 0.4) / RW)), nAlong = Math.floor(((f.ax ? f.hw : f.hd) * 2 - 0.4) / SP)
    for (let a = 0; a < nRows; a++) for (let b = 0; b < nAlong; b++) {
      const u = (a - (nRows - 1) / 2) * RW, w = (b - (nAlong - 1) / 2) * SP
      const x = f.x + (f.ax ? w : u), z = f.z + (f.ax ? u : w)
      if (!inC(x, z)) continue
      const hh = hash(Math.round(x * 10), Math.round(z * 10), 91)
      crops.push({ x, z, crop: hh < 0.04 ? 'none' : f.crop, ry: hh * 6.3, s: 0.85 + hh * 0.35, ax: f.ax, sp: SP })
    }
    if (f.scare && inC(f.x, f.z)) scarecrows.push({ x: f.x + 0.45, z: f.z, ry: f.seed * 6.3 })
  }
  // vida na água: vitórias-régias no fundo, juncos na margem (grade global de 1,3 m)
  const lilies = [], reeds = []
  for (let gi = Math.ceil((ox - 0.5) / 1.3); gi * 1.3 < ox + 15.5; gi++) for (let gj = Math.ceil((oz - 0.5) / 1.3); gj * 1.3 < oz + 15.5; gj++) {
    const x = gi * 1.3 + (hash(gi, gj, 92) - 0.5) * 0.8, z = gj * 1.3 + (hash(gi, gj, 93) - 0.5) * 0.8
    if (!inC(x, z)) continue
    const sd = WaterSD(x, z), hh = hash(gi, gj, 94)
    if (NearWaterStruct(x, z, 0.3)) continue
    if (sd < -2.2 && hh < 0.09) lilies.push({ x, z, ry: hash(gi, gj, 95) * 6.3, s: 0.7 + hash(gi, gj, 96) * 0.7, fl: hash(gi, gj, 97) < 0.3 })
    else if (sd > -0.7 && sd < 0.5 && hh < 0.3 && ArterialDist(x, z) > ROAD_HALF + 2.5) reeds.push({ x, z, ry: hh * 20, s: 0.7 + hash(gi, gj, 98) * 0.5 })
  }

  // estruturas da água (píer, ponte de madeira, pedras, barcos) que pertencem a este chunk + peixes e patos
  const wlife = { piers: [], bridges: [], stones: [], boats: [] }
  const cells = new Set()
  for (const [px, pz] of [[ox, oz], [ox + 15.5, oz], [ox, oz + 15.5], [ox + 15.5, oz + 15.5]]) cells.add(`${Math.floor(px / WGRID)},${Math.floor((pz - WROW) / WGRID)}`)
  for (const c of cells) {
    const [ci, cj] = c.split(',').map(Number), L = WaterLife(ci, cj)
    for (const k of Object.keys(wlife)) for (const it of L[k]) if (inC(it.x, it.z)) wlife[k].push(it)
  }
  const fish = [], ducks = []
  for (let gi = Math.ceil((ox - 0.5) / 2.4); gi * 2.4 < ox + 15.5; gi++) for (let gj = Math.ceil((oz - 0.5) / 2.4); gj * 2.4 < oz + 15.5; gj++) {
    const x = gi * 2.4 + (hash(gi, gj, 941) - 0.5), z = gj * 2.4 + (hash(gi, gj, 942) - 0.5)
    if (!inC(x, z)) continue
    const sd = WaterSD(x, z)
    if (sd > -1.1) continue
    const hh = hash(gi, gj, 943), ph = hash(gi, gj, 944), sp = 0.15 + hash(gi, gj, 945) * 0.3
    if (hh < 0.2) {
      const R = Math.min(0.5 + hash(gi, gj, 946) * 1.8, -sd - 0.7)
      if (R >= 0.45) fish.push({ x, z, R, ph, sp: ph < 0.5 ? 0.5 + sp : 0.5 - sp, s: 0.7 + hash(gi, gj, 947) * 0.6 })
    } else if (hh > 0.95 && sd < -3) {
      const R = Math.min(1.5 + hash(gi, gj, 948) * 2, -sd - 1.2)
      if (R >= 1) ducks.push({ x, z, R, ph, sp: 0.5 + (ph < 0.5 ? 0.06 : -0.06) })
    }
  }

  // postes + cabos: cada poste cuida do vão até o próximo (só existe fio se o próximo poste existe); cabos de serviço para casas
  const poleKeys = new Set()
  for (const q of arts) {
    const v = q.axis === 'v', lo = (v ? oz : ox) - 0.5, hi = lo + CHUNK_SIZE
    for (let k = Math.ceil((lo - 4) / POLE_STEP); k * POLE_STEP + 4 < hi; k++) {
      if (k * POLE_STEP + 4 < lo) continue
      const kk = `${q.axis}${q.c},${k}`
      if (poleKeys.has(kk)) continue
      poleKeys.add(kk)
      const p = PoleAt(q.axis, q.c, k)
      if (!p || !inC(p.x, p.z)) continue
      props.push({ type: 'pole', x: p.x, z: p.z, ry: p.ry, variant: p.variant })
      const nx = PoleAt(q.axis, q.c, k + 1)
      if (nx) props.push({ type: 'span', a: p, b: nx, broken: SpanBroken(p) })
      const dr = PoleDrop(p)
      if (dr) props.push({ type: 'drop', p, tx: dr.x, tz: dr.z, side: dr.side })
    }
  }
  // carro abandonado (fora de povoados). Só o chunk que contém a linha central da estrada pode pôr carro nela:
  // os dois chunks da borda enxergam a mesma estrada e antes cada um punha o seu, um em cima do outro
  const ownRoad = (q) => { const c0 = q.axis === 'v' ? ox : oz; return q.c >= c0 - 0.5 && q.c < c0 + CHUNK_SIZE - 0.5 }
  const ownArts = arts.filter(ownRoad)
  if (!station && ownArts.length && r() > 0.55) {
    const q = ownArts[Math.floor(r() * ownArts.length)], v = q.axis === 'v'
    const along = (v ? oz : ox) + 2 + r() * 12, lane = (r() > 0.5 ? 1.5 : -1.5)
    const x = v ? q.c + lane : along, z = v ? along : q.c + lane
    if (along > q.a + 3 && along < q.b - 3 && !InZone(x, z, 8) && !nearItem(x, z, 4.5) && places.every((pl) => Math.hypot(x - pl.p.block.x, z - pl.p.block.z) > pl.p.block.r + 3) && arts.every((o) => o === q || (o.axis === 'v' ? Math.abs(x - o.c) > 9 : Math.abs(z - o.c) > 9))) props.push({ type: 'car', x, z, ry: (v ? 0 : Math.PI / 2) + (r() - 0.5) * 0.3, c: Math.floor(r() * 4) })
  }
  if (station) props.push({ type: 'gas', x: station.x, z: station.z })

  // ---- peças dos finais de estrada (só o que cai neste chunk) ----
  const objs = [], endDiscs = [], endRects = [], endSoft = [], signs = [], kms = [], lights = [], paint = []
  // pedaço do retângulo (centro x/z, largura w, profundidade d) que cai neste chunk
  const clip = (c) => {
    const x0 = Math.max(c.x - c.w / 2, ox - 0.5), x1 = Math.min(c.x + c.w / 2, ox + CHUNK_SIZE - 0.5)
    const z0 = Math.max(c.z - c.d / 2, oz - 0.5), z1 = Math.min(c.z + c.d / 2, oz + CHUNK_SIZE - 0.5)
    return x1 - x0 > 0.01 && z1 - z0 > 0.01 ? { ...c, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 } : null
  }
  for (const { p } of places) {
    for (const o of p.objs) if (inC(o.x, o.z)) objs.push(o)
    for (const t of p.trees) if (inC(t.x, t.z)) trees.push(t)
    for (const t of p.bushes) if (inC(t.x, t.z)) bushes.push(t)
    for (const t of p.tufts) if (inC(t.x, t.z)) tufts.push(t)
    for (const t of p.rocks) if (inC(t.x, t.z)) rocks.push(t)
    for (const t of p.logs) if (inC(t.x, t.z)) logs.push(t)
    for (const t of p.flowers || []) if (inC(t.x, t.z)) flowers.push(t)
    // decalques de chão: um só dono (antes cada chunk tocado desenhava o seu, empilhando 2–4 cópias; a areia semitransparente escurecia)
    for (const c of p.discs) if (inC(c.x, c.z)) endDiscs.push(c)
    for (const c of p.rects) { const k = clip(c); if (k) endRects.push(k) }
    for (const c of p.softRects || []) { const k = clip(c); if (k) endSoft.push(k) }
    for (const sg of p.signs) { const [sx, sz] = SignPos(sg); if (inC(sx, sz)) signs.push(sg) }
  }
  // cidades: lotes vagos (estacionamento, jardim, praça, banca...) e mobiliário das calçadas — cada peça no chunk onde cai
  for (const c of cityStuff) {
    for (const o of c.objs) if (inC(o.x, o.z)) objs.push(o)
    for (const [src, dst] of [[c.trees, trees], [c.bushes, bushes], [c.flowers, flowers], [c.tufts, tufts]]) for (const t of src) if (inC(t.x, t.z)) dst.push(t)
    for (const q of c.rects) if (inC(q.x, q.z)) endRects.push(q)
    for (const q of c.paint) if (inC(q.x, q.z)) paint.push(q)
    for (const sg of c.signs) { const [sx, sz] = SignPos(sg); if (inC(sx, sz)) signs.push(sg) }
    for (const car of c.cars) if (inC(car.x, car.z)) props.push({ type: 'car', ...car }) // estacionado (dirigível)
  }
  for (const sg of allSigns) {
    const [sx, sz] = SignPos(sg)
    if (!inC(sx, sz)) continue
    if (sg.kind === 'sign') signs.push(sg); else if (sg.kind === 'km') kms.push(sg); else if (sg.kind === 'light') lights.push(sg); else if (sg.kind === 'paint') paint.push(sg)
  }
  const data = { wlife, fish, ducks, fields, crops, scarecrows, lilies, reeds, trees, rocks, props, fences, bushes, tufts, flowers, litter, logs, stumps, roads, buildings, decor, objs, endDiscs, endRects, endSoft, signs, kms, lights, paint, wear: WearFor(roads, ox, oz), tone: Math.floor(hash(cx, cz, 2) * 3) }
  cache.set(id, data)
  return data
}
