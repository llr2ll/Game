import { hash } from './noise'
import { NodeX, NodeZ, NodeType, NodeArms, ARMS, StationOf, ZONE, ROAD_HALF, GRID, ROW_Z, VSeg, HSeg, STREET_HW, STREET_OFF, CHUNK_SIZE, ArterialDist, SW_ART, SW_LOC } from './layout'
import { SPECS, VariantCount } from './buildings'
import { WaterSD } from './water'
// nada de casa/decoração/plantação dentro ou colado na água
const dry = (it) => WaterSD(it.x, it.z) > Math.hypot(it.hw, it.hd) + 1.2

// Colocação determinística de casas e decoração (por nó e por trecho de estrada).
// item: { t:'b', id, v, x, z, ry, hw, hd }  casa   |   { t:'d', type, x, z, ry, hw, hd }  decoração
//       { t:'f', x, z, hw, hd, ax, crop, scare, seed }  horta (ax = fileiras no sentido x)
function rng(seed) {
  let s = (Math.floor(seed * 4294967295) | 0) || 1
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
}
export const DECOR = {
  lamp: { hw: 0.25, hd: 0.25 }, lamp2: { hw: 0.25, hd: 0.25 }, lantern: { hw: 0.28, hd: 0.28 }, bench: { hw: 0.95, hd: 0.35 }, cruceiro: { hw: 0.9, hd: 0.9 }, well: { hw: 0.95, hd: 0.95 }, horreo: { hw: 0.8, hd: 2.3 },
}
const swap = (ry) => Math.abs(Math.sin(ry)) > 0.5
const HOUSE_GAP = 3.2, FRONT = 2.4 // vão livre entre paredes de casas vizinhas; jardim entre a estrada e a fachada
function house(id, rnd, x, z, ry) {
  const s = SPECS[id], sw = swap(ry)
  return { t: 'b', id, v: Math.floor(rnd() * VariantCount(id)), x, z, ry, hw: (sw ? s.d : s.w) / 2, hd: (sw ? s.w : s.d) / 2 }
}
function decor(type, x, z, ry = 0) {
  const D = DECOR[type], sw = swap(ry)
  return { t: 'd', type, x, z, ry, hw: sw ? D.hd : D.hw, hd: sw ? D.hw : D.hd }
}
const pick = (rnd, list) => list[Math.floor(rnd() * list.length)]

// ---------- iluminação pública: postes em posições fixas ao longo da rua, encostados no meio-fio, longe dos cruzamentos ----------
// rua no eixo axis ('v' = rua em x = c, correndo em z), hw = meia-largura do asfalto, o = início da contagem ao longo da rua,
// at = [[t, lado]] posições ao longo da rua e lado (-1/+1). O braço do poste (+z do modelo) aponta para a rua.
function streetLamps(out, homes, kind, axis, c, o, hw, at) {
  for (const [t, sd] of at) {
    const k = kind(t, sd), off = sd * (hw + 0.45)
    const l = axis === 'v' ? decor(k, c + off, o + t, -sd * Math.PI / 2) : decor(k, o + t, c + off, sd > 0 ? Math.PI : 0)
    if (dry(l) && !nearRect(homes, l.x, l.z, 0.4)) out.push(l)
  }
}
const both = (ts) => ts.flatMap((t) => [[t, -1], [t, 1]])

const cache = new Map(), lotCache = new Map()
// lotes vagos de uma cidade: { id, kind, type, x0, x1, z0, z1, fx, fz, seed, bus, home? } (o conteúdo é montado em city-lots.js)
export function CityLots(i, j) { Town(i, j); return lotCache.get(`${i},${j}`) || [] }
export function Town(i, j) {
  const k = `${i},${j}`
  if (cache.has(k)) return cache.get(k)
  const type = NodeType(i, j), items = []
  cache.set(k, items)
  if (!type) return items
  const cx = NodeX(i), cz = NodeZ(j), rnd = rng(hash(i, j, 200))

  if (type === 'village') {
    // casas ao longo dos 4 braços da estrada, viradas para a estrada, com um jardinzinho na frente e HOUSE_GAP livre
    // entre paredes vizinhas (dá para passar entre elas); atrás, espigueiro OU horta
    for (const arm of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const side of [-1, 1]) {
      let t = 9.5
      for (let slot = 0; slot < 2; slot++) {
        const id = rnd() < 0.62 ? pick(rnd, ['stone1', 'stone2', 'stone3', 'stone_s']) : pick(rnd, ['house1', 'house2', 'house3'])
        const s = SPECS[id], tc = t + s.w / 2
        if (tc + s.w / 2 > ZONE.village - 0.5) break
        t += s.w + HOUSE_GAP
        if (rnd() > 0.62) continue
        const off = ROAD_HALF + FRONT + s.d / 2
        if (arm[0]) items.push(house(id, rnd, cx + arm[0] * tc, cz + side * off, side > 0 ? Math.PI : 0))
        else items.push(house(id, rnd, cx + side * off, cz + arm[1] * tc, -side * Math.PI / 2))
        const r2 = rnd()
        if (r2 < 0.3) { // espigueiro atrás da casa
          const o2 = ROAD_HALF + FRONT + s.d + 2.2
          if (arm[0]) items.push(decor('horreo', cx + arm[0] * tc, cz + side * o2, Math.PI / 2))
          else items.push(decor('horreo', cx + side * o2, cz + arm[1] * tc, 0))
        } else if (r2 < 0.85) items.push(fieldBehind(rnd, arm[0] ? 'h' : 'v', arm[0] ? cx + arm[0] * tc : cx, arm[0] ? cz : cz + arm[1] * tc, side, off + s.d / 2))
      }
    }
    items.push(decor('cruceiro', cx + 7.8, cz + 7.8), decor('well', cx - 7.8, cz - 7.8))
    items.push(decor('bench', cx + 7.8, cz + 5.6, 0), decor('bench', cx - 7.8, cz - 5.6, Math.PI)) // banco olhando para o cruzeiro / o poço
    // cantos onde dois braços se encontram: o primeiro item ganha, o resto some
    const kept = []
    for (const it of items) if (dry(it) && fieldOk(it) && !kept.some((o) => { const g = o.t === 'b' && it.t === 'b' ? HOUSE_GAP : 0.6; return Math.abs(o.x - it.x) < o.hw + it.hw + g && Math.abs(o.z - it.z) < o.hd + it.hd + g })) kept.push(it)
    items.length = 0
    items.push(...kept)
    // lanternas nos braços da estrada que existem, alternando os lados, a partir de 7,5 m do cruzamento
    const homes = kept.filter((it) => it.t === 'b')
    NodeArms(i, j).forEach((on, k) => {
      if (!on) return
      const [ax, az] = ARMS[k], dir = ax + az
      streetLamps(items, homes, () => 'lantern', az ? 'v' : 'h', az ? cx : cz, az ? cz : cx, ROAD_HALF, [7.5, 15.5, 23.5].map((t, n) => [dir * t, (n % 2 ? 1 : -1) * dir]))
    })
  } else {
    // quarteirões entre as calçadas: avenida (calçada SW_ART) e ruas locais (calçada SW_LOC)
    const A = ROAD_HALF + SW_ART + 0.2, L1 = STREET_OFF - STREET_HW - SW_LOC - 0.2, L2 = STREET_OFF + STREET_HW + SW_LOC + 0.2
    const INT = [[-31.5, -L2], [-L1, -A], [A, L1], [L2, 31.5]]
    const homes = [], lots = []
    // lote vago (coordenadas locais à cidade); f = para onde fica a frente (a rua). O tipo sai de outro sorteio (lr),
    // então as casas que já existiam continuam iguais
    const lr = rng(hash(i, j, 207))
    // nbs = vizinhos (di, dj) que podem disputar o espaço: cidade vizinha mata o lote; vila só se algo dela encostar
    const lot = (kind, x0, x1, z0, z1, fx, fz, types, nbs = []) => {
      let u = lr(), type = types[types.length - 1][0]
      for (const [t, p] of types) { if (u < p) { type = t; break } u -= p }
      lots.push({ id: `${i},${j},${lots.length}`, kind, type, x0: cx + x0, x1: cx + x1, z0: cz + z0, z1: cz + z1, fx, fz, seed: lr(), bus: lr() < 0.5, nbs })
    }
    const EDGE = [['parking', 0.45], ['garden', 0.35], ['terrace', 0.2]], NOOK = [['nook', 1]]
    // sobras ao lado de um prédio (u = eixo da fachada): vira canteiro/bicicletário se tiver pelo menos 1,5 m
    const nooks = (horiz, lo, hi, b0, b1, c0, c1, fx, fz) => {
      for (const [a0, a1] of [[lo, b0 - 0.5], [b1 + 0.5, hi]]) if (a1 - a0 >= 1.5) horiz ? lot('nook', a0, a1, c0, c1, fx, fz, NOOK) : lot('nook', c0, c1, a0, a1, fx, fz, NOOK)
    }
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const [bx0, bx1] = INT[a], [bz0, bz1] = INT[b], mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2, W = bx1 - bx0, D = bz1 - bz0
      const dc = Math.max(Math.abs(mx), Math.abs(mz)), fill = dc < 15 ? 0.95 : dc < 25 ? 0.85 : 0.6
      if (W > 10 && D > 10) {
        // quarteirão do miolo: um prédio por fileira, costas com costas, cada um virado para a sua rua; laterais livres
        for (const row of [-1, 1]) {
          if (rnd() > fill) { lot('edge', bx0, bx1, row < 0 ? bz0 : bz1 - 5.6, row < 0 ? bz0 + 5.6 : bz1, 0, row, EDGE); continue }
          const id = pick(rnd, ['city_gal', 'city_shop', 'city_stone', 'city_shop']), sp = SPECS[id]
          const x = mx + (rnd() - 0.5) * Math.max(0, W - sp.w - 2 * 1.6)
          homes.push(house(id, rnd, cx + x, cz + (row < 0 ? bz0 + sp.d / 2 : bz1 - sp.d / 2), row < 0 ? Math.PI : 0))
          nooks(true, bx0, bx1, x - sp.w / 2, x + sp.w / 2, row < 0 ? bz0 : bz1 - 5.6, row < 0 ? bz0 + 5.6 : bz1, 0, row)
        }
      } else if (W > 10 || D > 10) {
        // faixa da borda: uma loja térrea virada para a rua de dentro da cidade (ou, se sobrar, um lote)
        const fx = W > D ? 0 : a === 0 ? 1 : -1, fz = W > D ? (b === 0 ? 1 : -1) : 0
        if (rnd() > fill) { lot('edge', bx0, bx1, bz0, bz1, fx, fz, EDGE); continue }
        const sp = SPECS.short
        if (W > D) homes.push(house('short', rnd, cx + mx, cz + (b === 0 ? bz1 - sp.d / 2 : bz0 + sp.d / 2), b === 0 ? 0 : Math.PI))
        else homes.push(house('short', rnd, cx + (a === 0 ? bx1 - sp.d / 2 : bx0 + sp.d / 2), cz + mz, a === 0 ? Math.PI / 2 : -Math.PI / 2))
        if (W > D) nooks(true, bx0, bx1, mx - sp.w / 2, mx + sp.w / 2, bz0, bz1, fx, fz)
        else nooks(false, bz0, bz1, mz - sp.w / 2, mz + sp.w / 2, bx0, bx1, fx, fz)
      } else {
        // esquina de fora (5,6 x 5,6): banca de jornal, jardinzinho ou chafariz, de frente para uma das ruas
        const toX = lr() < 0.5
        lot('corner', bx0, bx1, bz0, bz1, toX ? (a === 0 ? 1 : -1) : 0, toX ? 0 : (b === 0 ? 1 : -1), [['kiosk', 0.35], ['garden', 0.4], ['fountain', 0.25]])
      }
    }
    // anel de fora (entre o fim das ruas locais e a borda da cidade); cidade vizinha usa o espaço, vila só onde não tem nada dela
    const RING = [32.0, 39.8], MID = [5.6, 15.6], SIDE = [28.2, 39.8]
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r0 = Math.min(RING[0] * (nx + nz), RING[1] * (nx + nz)), r1 = Math.max(RING[0] * (nx + nz), RING[1] * (nx + nz))
      for (const s of [-1, 1]) {
        // ao lado da avenida: prédio da periferia, estacionamento, jardim ou praça, de frente para a avenida
        const l0 = Math.min(MID[0] * s, MID[1] * s), l1 = Math.max(MID[0] * s, MID[1] * s)
        if (nx) lot('ring', r0, r1, l0, l1, 0, -s, [['building', 0.35], ['parking', 0.3], ['garden', 0.2], ['plaza', 0.15]], [[nx, nz]])
        else lot('ring', l0, l1, r0, r1, -s, 0, [['building', 0.35], ['parking', 0.3], ['garden', 0.2], ['plaza', 0.15]], [[nx, nz]])
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const nbs = [[sx, 0], [0, sz], [sx, sz]]
      const X = [Math.min(SIDE[0] * sx, SIDE[1] * sx), Math.max(SIDE[0] * sx, SIDE[1] * sx)], Z = [Math.min(RING[0] * sz, RING[1] * sz), Math.max(RING[0] * sz, RING[1] * sz)]
      lot('ring', X[0], X[1], Z[0], Z[1], -sx, 0, [['park', 0.5], ['parking', 0.3], ['plaza', 0.2]], nbs)
      const X2 = [Math.min(RING[0] * sx, RING[1] * sx), Math.max(RING[0] * sx, RING[1] * sx)], Z2 = [Math.min(28.2 * sz, 31.6 * sz), Math.max(28.2 * sz, 31.6 * sz)]
      lot('strip', X2[0], X2[1], Z2[0], Z2[1], 0, -sz, [['garden', 1]], nbs)
    }
    // fora d'água e sem disputar espaço com o povoado vizinho
    const clash = (L) => L.nbs.some(([di, dj]) => {
      const t = NodeType(i + di, j + dj)
      return t === 'city' || (t === 'village' && Town(i + di, j + dj).some((it) => it.x + it.hw > L.x0 - 1.2 && it.x - it.hw < L.x1 + 1.2 && it.z + it.hd > L.z0 - 1.2 && it.z - it.hd < L.z1 + 1.2))
    })
    const wet = (L) => [[L.x0, L.z0], [L.x1, L.z0], [L.x0, L.z1], [L.x1, L.z1], [(L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2]].some(([x, z]) => WaterSD(x, z) <= 1.5)
    const okLots = lots.filter((L) => !wet(L) && !clash(L))
    lots.length = 0
    lots.push(...okLots)
    // lote com prédio: a casa entra na lista (ItemsNear, postes, placas a enxergam); o quintal fica com city-lots.js
    for (const L of lots) {
      if (L.type !== 'building') continue
      const id = L.seed < 0.7 ? 'city_corner' : 'stone_s', sp = SPECS[id], ry = Math.atan2(L.fx, L.fz)
      const front = L.fx > 0 ? L.x1 : L.fx < 0 ? L.x0 : L.fz > 0 ? L.z1 : L.z0, c = front - (L.fx + L.fz) * (0.4 + sp.d / 2) // fachada 0,4 m atrás da frente do lote
      const b = L.fx ? house(id, rnd, c, (L.z0 + L.z1) / 2, ry) : house(id, rnd, (L.x0 + L.x1) / 2, c, ry)
      if (dry(b)) { homes.push(b); L.home = b } else L.type = 'garden'
    }
    items.push(...homes.filter(dry))
    lotCache.set(k, lots)
    // postes de luz: um par (os dois lados) no meio de cada quadra; avenida até a borda da cidade, ruas locais entre os cruzamentos.
    // Alguns têm vaso de flores pendurado (sorteio fixo por posição)
    const kind = (axis, c) => (t, sd) => (hash(c * 3 + sd, t, axis === 'v' ? 233 : 234) < 0.4 ? 'lamp2' : 'lamp')
    for (const axis of ['v', 'h']) {
      const c0 = axis === 'v' ? cx : cz, o = axis === 'v' ? cz : cx
      streetLamps(items, homes, kind(axis, c0), axis, c0, o, ROAD_HALF, both([-32, -11, 11, 32]))
      for (const s of [-STREET_OFF, STREET_OFF]) streetLamps(items, homes, kind(axis, c0 + s), axis, c0 + s, o, STREET_HW, both([-11, 11]))
    }
  }
  return items
}

// horta atrás de uma casa: fileiras perpendiculares à estrada. axis = eixo da estrada ('v' ou 'h'); back = distância da estrada até o fundo da casa
function fieldBehind(rnd, axis, x, z, side, back) {
  const along = 6 + rnd() * 3.5, deep = 5 + rnd() * 3.5, o = back + 1.4 + deep / 2
  const crop = pick(rnd, ['cabbage', 'cabbage', 'corn', 'carrot'])
  const f = axis === 'v' ? { t: 'f', x: x + side * o, z, hw: deep / 2, hd: along / 2, ax: true } : { t: 'f', x, z: z + side * o, hw: along / 2, hd: deep / 2, ax: false }
  f.crop = crop; f.scare = rnd() < 0.35; f.seed = rnd()
  return f
}
const fieldOk = (it) => it.t !== 'f' || [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([a, b]) => ArterialDist(it.x + a * it.hw, it.z + b * it.hd) > ROAD_HALF + 2.5)

// casas isoladas à beira das estradas principais (fora dos povoados)
const rsCache = new Map()
function Roadside(axis, i, j) {
  const k = `${axis}${i},${j}`
  if (rsCache.has(k)) return rsCache.get(k)
  const items = []
  rsCache.set(k, items)
  const h = hash(i, j, axis === 'v' ? 301 : 311)
  const seg = axis === 'v' ? VSeg(i, j) : HSeg(i, j)
  if (!seg || h < 0.4) return items
  const nA = axis === 'v' ? NodeType(i, j) : NodeType(i, j), nB = axis === 'v' ? NodeType(i, j + 1) : NodeType(i + 1, j)
  const zA = nA ? ZONE[nA] + 6 : 22, zB = nB ? ZONE[nB] + 6 : 22
  const lo = zA, hi = GRID - zB
  if (hi - lo < 4) return items
  const rnd = rng(hash(i, j, 320 + (axis === 'v' ? 0 : 1)))
  const along = lo + rnd() * (hi - lo), side = rnd() < 0.5 ? -1 : 1
  const id = rnd() < 0.7 ? pick(rnd, ['stone1', 'stone2', 'stone_s', 'house1']) : pick(rnd, ['house2', 'house3'])
  const s = SPECS[id], off = ROAD_HALF + FRONT + s.d / 2
  const r2 = rnd()
  if (axis === 'v') {
    const x = NodeX(i), z = NodeZ(j) + along
    if (i === 0) for (let c = Math.floor((z - 14) / CHUNK_SIZE); c <= Math.floor((z + 14) / CHUNK_SIZE); c++) { const st = StationOf(0, c); if (st && Math.abs(st.z - z) < 14) return items }
    items.push(house(id, rnd, x + side * off, z, -side * Math.PI / 2))
    if (r2 < 0.35) items.push(decor('horreo', x + side * (off + s.d / 2 + 2.2), z, 0))
    else if (r2 < 0.9) items.push(fieldBehind(rnd, 'v', x, z, side, off + s.d / 2))
  } else {
    const x = i * GRID + along, z = NodeZ(j)
    items.push(house(id, rnd, x, z + side * off, side > 0 ? Math.PI : 0))
    if (r2 < 0.35) items.push(decor('horreo', x, z + side * (off + s.d / 2 + 2.2), Math.PI / 2))
    else if (r2 < 0.9) items.push(fieldBehind(rnd, 'h', x, z, side, off + s.d / 2))
  }
  // casa na água some junto com tudo; horta na água/estrada some sozinha
  if (!dry(items[0])) items.length = 0
  else { const ok = items.filter((it) => dry(it) && fieldOk(it)); items.length = 0; items.push(...ok) }
  return items
}

// todos os itens cujo retângulo toca [x0,x1]×[z0,z1]
export function ItemsNear(x0, x1, z0, z1) {
  const out = [], seen = new Set()
  const add = (it) => { if (!seen.has(it) && it.x + it.hw >= x0 && it.x - it.hw <= x1 && it.z + it.hd >= z0 && it.z - it.hd <= z1) { seen.add(it); out.push(it) } }
  for (let i = Math.round((x0 - 50) / GRID); i <= Math.round((x1 + 50) / GRID); i++)
    for (let j = Math.round((z0 - 50 - ROW_Z) / GRID); j <= Math.round((z1 + 50 - ROW_Z) / GRID); j++) Town(i, j).forEach(add)
  for (let i = Math.floor((x0 - 16) / GRID); i <= Math.ceil((x1 + 16) / GRID); i++)
    for (let j = Math.floor((z0 - 16 - ROW_Z) / GRID) - 1; j <= Math.ceil((z1 + 16 - ROW_Z) / GRID); j++) Roadside('v', i, j).forEach(add)
  for (let i = Math.floor((x0 - 16) / GRID) - 1; i <= Math.ceil((x1 + 16) / GRID); i++)
    for (let j = Math.floor((z0 - 16 - ROW_Z) / GRID); j <= Math.ceil((z1 + 16 - ROW_Z) / GRID); j++) Roadside('h', i, j).forEach(add)
  return out
}
export const nearRect = (list, x, z, m) => list.some((it) => Math.abs(x - it.x) < it.hw + m && Math.abs(z - it.z) < it.hd + m)
