import { hash } from '../../engine/world/noise'
import { NodeX, NodeZ, NodeType, GRID, ROW_Z, ROAD_HALF, SW_ART, SW_LOC, STREET_OFF, STREET_HW } from './layout'
import { CityLots, Town, nearRect } from './town'
import { SPECS } from './buildings'
import { SignsNear } from './signs'

// Conteúdo dos lotes vagos das cidades (estacionamento, jardim, praça, terraço de café, banca, chafariz, quintal)
// e o mobiliário das calçadas (lixeiras, hidrantes). Função pura por lote (cache): os chunks só pegam o que cai neles.
// Saída igual à dos finais de estrada: objs, rects (chão), paint (faixas), trees/bushes/flowers/tufts, signs e cars (vagas).
// Toda peça passa por put(): caixa ocupada não recebe outra (nada nasce em cima de nada).
function rng(seed) {
  let s = Math.floor(seed * 4294967295) | 0 || 1
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
}
// meia-extensão de cada peça no espaço dela (x = largura, z = profundidade; frente = +z)
const FOOT = {
  bench: [0.95, 0.4], bin: [0.28, 0.28], hydrant: [0.2, 0.2], planter: [0.66, 0.66], hedge: [1.2, 0.4], kiosk: [1.3, 1.5], fountain: [1.9, 1.9],
  busstop: [1.65, 0.8], wheelstop: [0.8, 0.13], picnic: [0.95, 0.95], cafe: [0.6, 1.05], glamp: [0.18, 0.18], lamp: [0.3, 0.3], bikerack: [0.8, 0.35],
  tree: [0.7, 0.7], pole: [0.15, 0.15], car: [1.2, 2.5],
}
const NAMES = ['Xardín da Fonte', 'Praza do Concello', 'Parque do Carme', 'Xardín de Rosalía', 'Praza da Feira', 'Alameda Vella', 'Parque da Estación', 'Xardín do Pazo', 'Praza das Flores']

const cache = new Map()
export function LotContent(L) {
  if (cache.has(L.id)) return cache.get(L.id)
  const R = rng(hash(L.seed * 1e3, L.x0 + L.z0, 720))
  const out = { objs: [], rects: [], paint: [], trees: [], bushes: [], flowers: [], tufts: [], signs: [], cars: [], area: L }
  const taken = []
  // referencial do lote: u ao longo da frente, v para dentro (0 = frente, D = fundo)
  const fx = L.fx, fz = L.fz, ex = -fz, ez = fx
  const W0 = fx ? L.z1 - L.z0 : L.x1 - L.x0, D0 = fx ? L.x1 - L.x0 : L.z1 - L.z0
  const Fx = (L.x0 + L.x1) / 2 + fx * D0 / 2, Fz = (L.z0 + L.z1) / 2 + fz * D0 / 2
  const face = Math.atan2(fx, fz) // ry de quem olha para a frente do lote
  let v0 = 0 // início útil (o ponto de ônibus / o prédio ocupam a frente)
  const at = (u, v) => [Fx + ex * u - fx * (v + v0), Fz + ez * u - fz * (v + v0)]
  const box = (type, x, z, ry) => {
    const [a, b] = FOOT[type], sw = Math.abs(Math.sin(ry)) > 0.7
    return { x0: x - (sw ? b : a), x1: x + (sw ? b : a), z0: z - (sw ? a : b), z1: z + (sw ? a : b) }
  }
  const fits = (bb, m) => bb.x0 >= L.x0 - 0.01 && bb.x1 <= L.x1 + 0.01 && bb.z0 >= L.z0 - 0.01 && bb.z1 <= L.z1 + 0.01 &&
    taken.every((o) => bb.x0 >= o.x1 + m || bb.x1 <= o.x0 - m || bb.z0 >= o.z1 + m || bb.z1 <= o.z0 - m)
  // põe uma peça (rot = giro em relação à frente do lote); devolve false se não coube
  const put = (type, u, v, rot = 0, m = 0.12) => {
    const [x, z] = at(u, v), ry = face + rot, bb = box(type, x, z, ry)
    if (!fits(bb, m)) return false
    taken.push(bb)
    if (type === 'tree') out.trees.push({ x, z, s: 0.8 + R() * 0.25, k: 0.35 + R() * 0.55 })
    else if (type !== 'pole' && type !== 'car') out.objs.push({ type, x, z, ry, s: 1 })
    return true
  }
  // tenta as posições na ordem até uma caber
  const put1 = (type, cands, rot = 0) => cands.some(([u, v]) => put(type, u, v, rot))
  // área reservada sem peça (caminho, fileira de vagas)
  const reserve = (u0, u1, va, vb) => { const [ax, az] = at(u0, va), [bx, bz] = at(u1, vb); taken.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz) }) }
  const rect = (u0, u1, va, vb, mat) => {
    const [ax, az] = at(u0, va), [bx, bz] = at(u1, vb)
    out.rects.push({ x: (ax + bx) / 2, z: (az + bz) / 2, w: Math.abs(bx - ax), d: Math.abs(bz - az), mat })
  }
  const line = (u0, u1, va, vb) => { const [ax, az] = at(u0, va), [bx, bz] = at(u1, vb); out.paint.push({ x: (ax + bx) / 2, z: (az + bz) / 2, w: Math.abs(bx - ax), d: Math.abs(bz - az), color: 0xf2f2f0 }) }
  // placa num poste (frente do lote), também ocupa espaço
  const sign = (u, v, key, w, h, postH = 2.6) => {
    if (!put('pole', u, v)) return
    const [x, z] = at(u, v)
    out.signs.push({ kind: 'sign', poles: [[x, z]], postH, plates: [{ cx: x, cz: z, y: postH - h / 2 - 0.12, fx, fz, w, h, key }] })
  }
  // flores e capim só no gramado livre
  const scatter = (n, u0, u1, va, vb, list) => {
    for (let k = 0; k < n; k++) {
      const u = u0 + R() * (u1 - u0), v = va + R() * (vb - va), [x, z] = at(u, v)
      if (taken.some((o) => x > o.x0 - 0.15 && x < o.x1 + 0.15 && z > o.z0 - 0.15 && z < o.z1 + 0.15)) continue
      if (list === out.flowers) out.flowers.push({ x, z, s: 0.8 + R() * 0.4, ry: R() * 6.3, c: Math.floor(R() * 5) })
      else out.tufts.push({ x, z, s: 0.55 + R() * 0.35, ry: R() * 6.3, c: R() })
    }
  }

  // ---------- tipos ----------
  function parking(W, D) {
    const SW = 2.6, SD = 5.0, n = Math.floor((W - 0.5) / SW)
    if (n < 2 || D < SD + 0.4) return garden(W, D)
    rect(-W / 2 + 0.1, W / 2 - 0.1, 0.1, D - 0.1, 'lot')
    const vb = D - 0.25, va = vb - SD, u0 = -n * SW / 2
    for (let k = 0; k <= n; k++) line(u0 + k * SW - 0.05, u0 + k * SW + 0.05, va, vb)
    line(u0, u0 + n * SW, vb - 0.1, vb)
    let cars = 0
    for (let k = 0; k < n; k++) {
      const uc = u0 + (k + 0.5) * SW
      put('wheelstop', uc, vb - 0.45, 0, 0)
      // carro estacionado (dirigível): de frente para o batente ou de ré; a vaga fica ocupada mesmo vazia
      if (cars < 2 && R() < 0.45) {
        const [x, z] = at(uc, (va + vb) / 2 - 0.25), nose = R() < 0.7 ? Math.PI : 0
        out.cars.push({ x, z, ry: face + nose, c: Math.floor(R() * 5) })
        cars++
      }
    }
    reserve(u0, u0 + n * SW, va, vb) // a fileira de vagas inteira fica reservada (carros nascem ali depois)
    const side = W / 2 - 0.4
    sign(side, 0.4, 'park', 0.6, 0.6)
    put('lamp', -side, 0.4)
    put('bin', side - 0.7, 0.4)
    // sobras nas pontas da fileira: floreiras
    for (const s of [-1, 1]) put('planter', s * (W / 2 - 0.75), va + 0.8)
    if (va > 3) for (const s of [-1, 1]) put('planter', s * (W / 2 - 0.75), va - 1.2)
  }

  function garden(W, D, opts = {}) {
    rect(-W / 2 + 0.25, W / 2 - 0.25, 0.25, D - 0.25, 'grass')
    const wide = W >= 5.5, path = wide && D >= 4
    if (path) { const pv = Math.min(D - 1.2, D * 0.62); rect(-0.7, 0.7, 0.25, pv, 'path'); reserve(-0.7, 0.7, 0, pv) }
    // cerca viva no fundo (e nas laterais, se for fundo o bastante)
    for (let u = -W / 2 + 1.5; u + 1.2 <= W / 2 - 0.25; u += 2.45) put('hedge', u, D - 0.6, 0, 0.02)
    if (D >= 7) for (const s of [-1, 1]) for (let v = D - 2.4; v - 1.2 >= 1.4; v -= 2.45) put('hedge', s * (W / 2 - 0.6), v, Math.PI / 2, 0.02)
    // árvores
    const tv = D - (D >= 5 ? 2.3 : 1.9)
    if (W >= 7) { for (const s of [-1, 1]) if (R() < 0.85) put('tree', s * (W / 2 - 2.1), tv) }
    else if (D >= 3.4) put('tree', path ? 1.8 : 0, tv)
    // bancos virados para o caminho (ou para a frente, nos lotes estreitos)
    if (path) for (const s of [-1, 1]) { if (R() < 0.8) put('bench', s * 1.65, Math.min(D * 0.38, D - 2.4), s * Math.PI / 2) }
    else put('bench', 0, Math.min(1.2, D - 0.8))
    if (opts.picnic || (W >= 9 && D >= 7 && R() < 0.6)) put1('picnic', [[-1.8, D * 0.62], [1.8, D * 0.62], [-W / 4 - 0.4, D * 0.55], [W / 4 + 0.4, D * 0.55]], Math.PI / 2)
    put('bin', path ? 2.0 : 1.5, 0.45)
    if (path) for (const s of [-1, 1]) put('glamp', s * 1.05, 0.4)
    // arbustos nos cantos do fundo, flores e capim no gramado
    for (const s of [-1, 1]) if (R() < 0.7) { const [x, z] = at(s * (W / 2 - 0.7), D - 1.5); if (fits({ x0: x - 0.4, x1: x + 0.4, z0: z - 0.4, z1: z + 0.4 }, 0)) out.bushes.push({ x, z, s: 0.7 + R() * 0.3, c: R() }) }
    scatter(Math.round(W * D * 0.35), -W / 2 + 0.5, W / 2 - 0.5, 0.5, D - 0.5, out.flowers)
    scatter(Math.round(W * D * 0.12), -W / 2 + 0.5, W / 2 - 0.5, 0.5, D - 0.5, out.tufts)
    if (opts.name && path) sign(-2.0, 0.4, `name:${NAMES[Math.floor(L.seed * 97) % NAMES.length]}`, 1.4, 0.35, 2.2)
  }

  function plaza(W, D) {
    rect(-W / 2 + 0.1, W / 2 - 0.1, 0.1, D - 0.1, 'plaza')
    const vc = D / 2
    if (Math.min(W, D) >= 4.6 && put('fountain', 0, vc)) {
      put('bench', 0, vc - 2.75, Math.PI) // de frente para o chafariz
      put('bench', 0, vc + 2.75, 0)
      put('bench', -2.85, vc, -Math.PI / 2)
      put('bench', 2.85, vc, Math.PI / 2)
    } else for (let u = -W / 2 + 1.3; u <= W / 2 - 1.3; u += 2.4) put('cafe', u, vc)
    for (const [su, sv] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) put('planter', su * (W / 2 - 0.8), sv ? D - 0.8 : 0.8)
    for (const s of [-1, 1]) put('glamp', s * (W / 2 - 1.8), 0.35)
    put('bin', W / 2 - 2.5, D - 0.4)
    if (W * D > 60) for (const s of [-1, 1]) put('tree', s * (W / 2 - 1.2), vc)
  }

  function terrace(W, D) {
    rect(-W / 2 + 0.1, W / 2 - 0.1, 0.1, D - 0.1, 'plaza')
    for (const s of [-1, 1]) put('planter', s * (W / 2 - 0.8), 0.8)
    for (let u = -W / 2 + 2.6; u <= W / 2 - 2.2; u += 2.5) put('cafe', u, D / 2 + 0.2)
    put('bikerack', -W / 2 + 1.1, D - 0.6)
    put('bin', W / 2 - 0.5, D - 0.5)
    for (const s of [-1, 1]) put('tree', s * (W / 2 - 1.0), D - 1.2)
  }

  function kiosk(W, D) {
    rect(-W / 2 + 0.1, W / 2 - 0.1, 0.1, D - 0.1, 'plaza')
    put('kiosk', 0, D - 1.7)
    put('bench', -W / 2 + 0.5, 1.3, -Math.PI / 2)
    put('bin', W / 2 - 0.45, 0.45)
    put1('planter', [[W / 2 - 0.8, 1.5], [-W / 2 + 0.8, D - 0.8]])
    put('glamp', -W / 2 + 0.45, D - 0.45)
  }

  function fountain(W, D) {
    rect(-W / 2 + 0.1, W / 2 - 0.1, 0.1, D - 0.1, 'plaza')
    put('fountain', 0, D / 2)
    for (const [su, sv] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) put('glamp', su * (W / 2 - 0.4), sv ? D - 0.4 : 0.4)
    put('bin', W / 2 - 0.4, D / 2)
  }

  // sobra ao lado de um prédio: canteiro com árvore, floreira + lixeira, ou bicicletário
  function nook(W, D) {
    const k = Math.floor(L.seed * 3)
    if (k === 0) {
      rect(-W / 2 + 0.15, W / 2 - 0.15, 0.4, D - 0.4, 'grass')
      put('tree', 0, D / 2 + 0.3)
      scatter(Math.round(W * D * 0.5), -W / 2 + 0.3, W / 2 - 0.3, 0.6, D - 0.6, out.flowers)
    } else if (k === 1) { put('planter', 0, 1.0); put('bin', 0, 2.2) }
    else { put('bikerack', 0, D / 2, Math.PI / 2); put('bin', 0, 0.45) }
  }

  // quintal atrás do prédio da periferia
  function yard(W, D) {
    if (D < 2) return
    rect(-W / 2 + 0.25, W / 2 - 0.25, 0.1, D - 0.25, 'grass')
    for (let u = -W / 2 + 1.5; u + 1.2 <= W / 2 - 0.25; u += 2.45) put('hedge', u, D - 0.6, 0, 0.02)
    if (D >= 3) put('tree', (R() < 0.5 ? -1 : 1) * (W / 2 - 1.5), D - 1.9)
    scatter(Math.round(W * D * 0.3), -W / 2 + 0.5, W / 2 - 0.5, 0.4, D - 0.4, out.flowers)
  }

  // ---------- montagem ----------
  let W = W0, D = D0
  if (L.type === 'building' && L.home) {
    const sp = SPECS[L.home.id]
    v0 = 0.4 + sp.d + 0.3
    yard(W, D - v0)
  } else {
    // ponto de ônibus na frente dos lotes do anel que dão para a avenida
    if (L.kind === 'ring' && L.bus && (L.type === 'garden' || L.type === 'plaza') && avenueFront(L)) {
      put('busstop', W / 2 - 1.9, 0.85)
      sign(W / 2 - 4.0, 0.35, 'bus', 0.55, 0.55, 2.7)
      put('bin', W / 2 - 4.0 - 0.6, 0.35)
      rect(-W / 2 + 0.1, W / 2 - 0.1, 0.05, 1.75, 'plaza')
      v0 = 1.8; D -= v0
    }
    if (L.type === 'parking') parking(W, D)
    else if (L.type === 'garden') garden(W, D, { name: L.kind === 'ring' })
    else if (L.type === 'park') garden(W, D, { name: true, picnic: true })
    else if (L.type === 'plaza') plaza(W, D)
    else if (L.type === 'terrace') terrace(W, D)
    else if (L.type === 'kiosk') kiosk(W, D)
    else if (L.type === 'fountain') fountain(W, D)
    else if (L.type === 'nook') nook(W, D)
  }
  cache.set(L.id, out)
  return out
}
// a frente do lote encosta na calçada da avenida? (lotes do anel do meio; os de canto dão para o fim de uma rua local)
function avenueFront(L) {
  const i = Math.round(((L.x0 + L.x1) / 2) / GRID), j = Math.round(((L.z0 + L.z1) / 2 - ROW_Z) / GRID)
  const cx = NodeX(i), cz = NodeZ(j), e = ROAD_HALF + SW_ART + 0.7
  return L.fx ? Math.abs((L.fx > 0 ? L.x1 : L.x0) - cx) < e : Math.abs((L.fz > 0 ? L.z1 : L.z0) - cz) < e
}

// ---------- calçadas: lixeiras ao lado dos postes de luz e hidrantes do outro lado da rua ----------
const streetCache = new Map()
function StreetFurniture(i, j) {
  const k = `${i},${j}`
  if (streetCache.has(k)) return streetCache.get(k)
  const out = { objs: [], rects: [], paint: [], trees: [], bushes: [], flowers: [], tufts: [], signs: [], cars: [] }
  streetCache.set(k, out)
  const cx = NodeX(i), cz = NodeZ(j), items = Town(i, j), homes = items.filter((it) => it.t === 'b')
  const poles = []
  for (const s of SignsNear(cx - 34, cx + 34, cz - 34, cz + 34)) {
    if (s.kind === 'sign') poles.push(...s.poles)
    else if (s.kind === 'light' || s.kind === 'km') poles.push([s.x, s.z])
  }
  const used = items.filter((it) => it.t === 'd').map((it) => [it.x, it.z])
  const ok = (x, z, r) => !nearRect(homes, x, z, r) && poles.every(([px, pz]) => Math.hypot(px - x, pz - z) > r + 0.5) && used.every(([px, pz]) => Math.hypot(px - x, pz - z) > r + 0.35)
  const add = (type, x, z, ry, r) => { if (ok(x, z, r)) { out.objs.push({ type, x, z, ry, s: 1 }); used.push([x, z]) } }
  for (const s of [-STREET_OFF, 0, STREET_OFF]) {
    const e = s === 0 ? ROAD_HALF + SW_ART - 0.35 : STREET_HW + SW_LOC - 0.3 // mesma linha dos postes de luz (Town)
    for (const t of [-10, 10]) {
      const h = hash(i * 7 + s, j * 7 + t, 730)
      // lixeira 0,8 m depois do poste
      if (h < 0.6) { add('bin', cx + s + e, cz + t + 0.8, 0, 0.3); add('bin', cx + t + 0.8, cz + s + e, 0, 0.3) }
      // hidrante na outra calçada
      if (h > 0.45) { add('hydrant', cx + s - e, cz + t - 4, 0, 0.25); add('hydrant', cx + t - 4, cz + s - e, Math.PI / 2, 0.25) }
    }
  }
  return out
}

// tudo de cidade (lotes + calçadas) perto do retângulo
export function CityStuffNear(x0, x1, z0, z1) {
  const out = []
  for (let i = Math.round((x0 - 40) / GRID); i <= Math.round((x1 + 40) / GRID); i++)
    for (let j = Math.round((z0 - 40 - ROW_Z) / GRID); j <= Math.round((z1 + 40 - ROW_Z) / GRID); j++) {
      if (NodeType(i, j) !== 'city') continue
      const cx = NodeX(i), cz = NodeZ(j)
      if (cx + 41 < x0 || cx - 41 > x1 || cz + 41 < z0 || cz - 41 > z1) continue
      out.push(StreetFurniture(i, j))
      for (const L of CityLots(i, j)) if (L.x1 >= x0 && L.x0 <= x1 && L.z1 >= z0 && L.z0 <= z1) out.push(LotContent(L))
    }
  return out
}
