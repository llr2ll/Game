// Colisores são caixas no plano XZ: { x, z, hw, hd, h?, lv?, door?, off? }
//  h = altura do topo (sem h = intransponível)   lv = só vale para quem está naquele andar da casa
//  door = porta (off = aberta, não bloqueia; o "olho"/A* dos inimigos ignora portas porque elas abrem sozinhas)
//  veh = caixa de um veículo (dinâmica: o veículo tira e põe a cada quadro); o próprio veículo não colide com ela
// Ficam num grid espacial para consultas rápidas.
const CELL = 4
const grid = new Map()
const key = (i, j) => (i + 4096) * 8192 + (j + 4096)

function cellsOf(c, fn) {
  const i1 = Math.floor((c.x + c.hw) / CELL), j1 = Math.floor((c.z + c.hd) / CELL)
  for (let i = Math.floor((c.x - c.hw) / CELL); i <= i1; i++)
    for (let j = Math.floor((c.z - c.hd) / CELL); j <= j1; j++) fn(key(i, j))
}

export function AddColliders(list) {
  for (const c of list) cellsOf(c, (k) => { let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(c) })
}
export function RemoveColliders(list) {
  for (const c of list) cellsOf(c, (k) => {
    const a = grid.get(k)
    if (!a) return
    const i = a.indexOf(c)
    if (i !== -1) a.splice(i, 1)
    if (!a.length) grid.delete(k)
  })
}

function forNear(x, z, r, fn) {
  const i1 = Math.floor((x + r) / CELL), j1 = Math.floor((z + r) / CELL)
  for (let i = Math.floor((x - r) / CELL); i <= i1; i++)
    for (let j = Math.floor((z - r) / CELL); j <= j1; j++) {
      const a = grid.get(key(i, j))
      if (a) for (let n = 0; n < a.length; n++) fn(a[n])
    }
}

// Empurra um círculo (obj.x/obj.z, raio r) para fora das caixas.
// feet = altura dos pés acima do chão: obstáculos baixos (cerca, tronco, pedra) deixam de bloquear quando se pula por cima.
export function resolve(obj, r, _colliders, feet = 0) {
  const lv = obj.lv || 0
  forNear(obj.x, obj.z, r, (c) => {
    if (c.off || (c.lv !== undefined && c.lv !== lv) || (c.veh && c.veh === obj.veh)) return
    if (c.h !== undefined && feet >= c.h - 0.02) return
    const nx = Math.max(c.x - c.hw, Math.min(obj.x, c.x + c.hw))
    const nz = Math.max(c.z - c.hd, Math.min(obj.z, c.z + c.hd))
    const dx = obj.x - nx, dz = obj.z - nz
    const d2 = dx * dx + dz * dz
    if (d2 >= r * r) return
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), p = r - d
      obj.x += (dx / d) * p; obj.z += (dz / d) * p
    } else {
      const px = c.hw - Math.abs(obj.x - c.x), pz = c.hd - Math.abs(obj.z - c.z)
      if (px < pz) obj.x += (obj.x >= c.x ? 1 : -1) * (px + r)
      else obj.z += (obj.z >= c.z ? 1 : -1) * (pz + r)
    }
  })
}

// "água funda demais neste ponto?" — vem do jogo (o motor não conhece rios e lagos). Água funda também bloqueia.
let deep = () => false
export const SetDeepTest = (fn) => { deep = fn }

// Tem algum obstáculo (de chão) neste ponto, considerando um círculo de raio r?
export function Blocked(x, z, r, lv = 0) {
  if (deep(x, z)) return true
  let hit = false
  forNear(x, z, r, (c) => {
    if (hit || c.door || (c.lv !== undefined && c.lv !== lv)) return
    const nx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw)), nz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd))
    if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) hit = true
  })
  return hit
}

// Distância em que um raio (origem + direção unitária) bate numa caixa; Infinity se não bater
export function rayBox(ox, oz, dx, dz, c) {
  let t0 = 0, t1 = Infinity
  for (const [o, d, mn, mx] of [[ox, dx, c.x - c.hw, c.x + c.hw], [oz, dz, c.z - c.hd, c.z + c.hd]]) {
    if (Math.abs(d) < 1e-9) { if (o < mn || o > mx) return Infinity; continue }
    let a = (mn - o) / d, b = (mx - o) / d
    if (a > b) [a, b] = [b, a]
    t0 = Math.max(t0, a); t1 = Math.min(t1, b)
    if (t0 > t1) return Infinity
  }
  return t0
}

// Parede alta neste ponto? (projéteis mágicos: ignoram água e obstáculos baixos, que passam por cima)
export function HitWall(x, z, lv = 0) {
  let hit = false
  forNear(x, z, 0.1, (c) => {
    if (hit || c.off || c.veh || (c.lv !== undefined && c.lv !== lv) || (c.h !== undefined && c.h < 1.2)) return
    if (Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd) hit = true
  })
  return hit
}

// Caixa de parede/obstáculo fixo neste ponto (o sangue gruda nela); h = altura do topo, null se não tem
export function WallAt(x, z, lv = 0) {
  let hit = null
  forNear(x, z, 0.1, (c) => {
    if (hit || c.off || c.veh || (c.lv !== undefined && c.lv !== lv)) return
    if (Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd) hit = c
  })
  return hit
}
