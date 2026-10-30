import { Blocked } from './collision'

// rota dentro de casas (porta, escada, andar do alvo) — vem do jogo; o motor não conhece casas. null = vai reto
let indoorRoute = () => null
export const SetIndoorRoute = (fn) => { indoorRoute = fn }

export const wrap = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI }
// gira em direção ao alvo com velocidade máxima (rad/s)
export const turnTo = (a, b, rate, dt) => { const d = wrap(b - a); return a + Math.sign(d) * Math.min(Math.abs(d), rate * dt) }

// "Olho" do zumbi: testa a direção do alvo e, se tiver obstáculo, tenta desviar para os lados
const OFFSETS = [0, 0.6, -0.6, 1.1, -1.1, 1.7, -1.7, 2.4, -2.4]
function steer(e, want) {
  const r = e.radius * 0.8 + 0.15
  for (const o of OFFSETS) {
    const off = o * e.side, a = want + off
    const dx = Math.sin(a), dz = Math.cos(a)
    if (!Blocked(e.x + dx * 0.9, e.z + dz * 0.9, r, e.lv) && !Blocked(e.x + dx * 1.8, e.z + dz * 1.8, r, e.lv)) {
      if (o !== 0) e.side = Math.sign(off)
      return a
    }
  }
  return want + e.side * 1.7
}

// Busca de caminho (A*) numa grade local — só roda quando o zumbi trava (bolsões entre obstáculos).
const GC = 1.2, GN = 17, GW = GN * 2 + 1
function findPath(e, tx, tz) {
  const r = e.radius * 0.8 + 0.12, ox = e.x, oz = e.z
  const idx = (i, j) => (i + GN) * GW + (j + GN)
  const blk = new Int8Array(GW * GW), g = new Float32Array(GW * GW).fill(Infinity), from = new Int32Array(GW * GW).fill(-1), done = new Uint8Array(GW * GW)
  const free = (i, j) => {
    const k = idx(i, j)
    if (!blk[k]) blk[k] = Blocked(ox + i * GC, oz + j * GC, r, e.lv) ? 2 : 1
    return blk[k] === 1
  }
  const gi = Math.max(-GN, Math.min(GN, Math.round((tx - ox) / GC))), gj = Math.max(-GN, Math.min(GN, Math.round((tz - oz) / GC)))
  const h = (i, j) => { const a = Math.abs(i - gi), b = Math.abs(j - gj); return Math.max(a, b) + 0.41 * Math.min(a, b) }
  const heap = [] // [f, i, j]
  const push = (n) => { heap.push(n); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p } }
  const pop = () => {
    const top = heap[0], last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let c = 0
      for (;;) { let m = c; const l = 2 * c + 1, rr = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m }
    }
    return top
  }
  g[idx(0, 0)] = 0
  push([h(0, 0), 0, 0])
  let best = [0, 0], bestH = h(0, 0), it = 0
  while (heap.length && it++ < 1800) {
    const [, i, j] = pop(), k = idx(i, j)
    if (done[k]) continue
    done[k] = 1
    const hv = h(i, j)
    if (hv < bestH) { bestH = hv; best = [i, j] }
    if (i === gi && j === gj) break
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue
        const ni = i + di, nj = j + dj
        if (ni < -GN || ni > GN || nj < -GN || nj > GN || !free(ni, nj)) continue
        if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue
        const nk = idx(ni, nj), ng = g[k] + (di && dj ? 1.41 : 1)
        if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push([ng + h(ni, nj), ni, nj]) }
      }
  }
  const pts = []
  for (let k = idx(best[0], best[1]); k !== -1 && k !== idx(0, 0); k = from[k]) pts.push({ x: ox + (Math.floor(k / GW) - GN) * GC, z: oz + ((k % GW) - GN) * GC })
  return pts.reverse()
}

// Anda até (tx, tz) e para a `stop` metros: casas (porta, escada, andar do alvo), desvio de obstáculos e A* quando trava.
// turn = giro máximo (rad/s): zumbi lento vira devagar. Retorna a distância em linha reta até o alvo.
export function Navigate(e, tx, tz, tfeet, speed, stop, dt, turn = 6) {
  const dist = Math.hypot(tx - e.x, tz - e.z) || 0.001
  let go = Math.atan2(tx - e.x, tz - e.z)
  // casas: alvo lá dentro (vai pela porta), em outro andar (escada) ou lá fora (desce e sai) — segue o ponto da rota
  const rt = indoorRoute(e.x, e.z, e.fy ?? 0, tx, tz, tfeet)
  const gx = rt ? rt.x : tx, gz = rt ? rt.z : tz, gd = Math.hypot(gx - e.x, gz - e.z), gw = Math.atan2(gx - e.x, gz - e.z)
  if (rt && rt.inside) { go = e.unstick > 0 ? ((e.unstick -= dt), gw + e.side * 1.5) : gw; e.path = null } else if (e.path) {
    // seguindo o caminho calculado depois de travar
    const w = e.path[0]
    if (!w || (e.pathT -= dt) <= 0) e.path = null
    else if (Math.hypot(w.x - e.x, w.z - e.z) < 0.8) e.path.shift()
    else go = Math.atan2(w.x - e.x, w.z - e.z)
  } else if (rt ? gd > 1.2 : dist > 2.2) {
    if (e.unstick > 0) { e.unstick -= dt; go = gw + e.side * 1.5 } else go = steer(e, gw)
  } else if (rt) go = gw
  e.heading = turnTo(e.heading, go, turn, dt)
  const walking = dist > stop || !!rt
  if (walking) {
    e.x += Math.sin(e.heading) * speed * dt
    e.z += Math.cos(e.heading) * speed * dt
  }
  // se andou muito pouco por 0.6s, está preso: sai de lado por um instante ou calcula um caminho
  if ((e.stuckT += dt) >= 0.6) {
    if (walking && speed > 0.2 && Math.hypot(e.x - e.sx, e.z - e.sz) < speed * 0.15) {
      if (rt && rt.inside) { e.unstick = 0.6; e.side = -e.side } // dentro de casa: só um passo de lado
      else { e.path = findPath(e, gx, gz); e.pathT = 6; if (!e.path.length) { e.path = null; e.unstick = 0.8; e.side = -e.side } }
    }
    e.stuckT = 0; e.sx = e.x; e.sz = e.z
  }
  return dist
}
