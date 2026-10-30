import * as THREE from 'three'
import { resolve, Blocked } from '../world/collision'
import { Height } from '../world/terrain'

// Tema: "Os Ocos" — a floresta tomou conta de coisas abandonadas. Olhos laranja brilhando.
export const TYPES = {
  scarecrow: { name: 'Espantalho', hp: 4, speed: 1.7, dmg: 8, radius: 0.5, score: 10, rate: 1.0 },
  crow: { name: 'Corvo', hp: 1, speed: 4.4, dmg: 5, radius: 0.4, score: 15, rate: 0.8, flying: true },
  logger: { name: 'Lenhador Oco', hp: 26, speed: 1.15, dmg: 22, radius: 0.85, score: 60, rate: 1.2 },
}

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9, ...o })
const M = {
  straw: mat(0xd4b45a), sack: mat(0xb89a5e), wood: mat(0x5a3a22), cloth: mat(0x7a5b3a), patch: mat(0x4a6b8a),
  eye: new THREE.MeshBasicMaterial({ color: 0xff8a1f }), black: mat(0x1b1b24), beak: mat(0xe08a1e), plaid: mat(0xa83232),
  dark: mat(0x2a2220), steel: mat(0x9aa0a8, { metalness: 0.5, roughness: 0.4 }), skin: mat(0x6b6b5a),
}
const B = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  o.position.set(x, y, z)
  return o
}
const eyes = (y, z, s = 0.08, gap = 0.1) => [B(s, s, 0.04, M.eye, -gap, y, z), B(s, s, 0.04, M.eye, gap, y, z)]

const builders = {
  scarecrow() {
    const g = new THREE.Group(), body = new THREE.Group()
    g.add(body)
    const legs = [B(0.14, 1, 0.14, M.wood, -0.15, 0.5), B(0.14, 1, 0.14, M.wood, 0.15, 0.5)]
    body.add(...legs, B(0.6, 0.9, 0.3, M.cloth, 0, 1.4), B(0.62, 0.3, 0.32, M.patch, 0.05, 1.3))
    const arms = new THREE.Group()
    arms.position.y = 1.7
    arms.add(B(1.7, 0.12, 0.12, M.wood), B(0.25, 0.25, 0.25, M.straw, -0.95, 0), B(0.25, 0.25, 0.25, M.straw, 0.95, 0))
    body.add(arms)
    const head = new THREE.Group()
    head.position.y = 2.15
    head.add(B(0.42, 0.42, 0.42, M.sack), ...eyes(0.03, 0.22), B(0.9, 0.06, 0.9, M.wood, 0, 0.26), new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.4, 6), M.wood))
    head.children[head.children.length - 1].position.y = 0.48
    body.add(head)
    return { group: g, anim: (t, moving) => { arms.rotation.z = Math.sin(t * 4) * 0.15; body.rotation.z = Math.sin(t * 6) * 0.1 * moving; legs[0].rotation.x = Math.sin(t * 6) * 0.5 * moving; legs[1].rotation.x = -Math.sin(t * 6) * 0.5 * moving } }
  },
  crow() {
    const g = new THREE.Group(), body = new THREE.Group()
    body.position.y = 1.4
    g.add(body)
    const torso = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), M.black)
    torso.scale.set(0.8, 0.8, 1.5)
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 4), M.beak)
    beak.rotation.x = Math.PI / 2
    beak.position.z = 0.62
    const wl = B(0.9, 0.05, 0.4, M.black, -0.5, 0.05), wr = B(0.9, 0.05, 0.4, M.black, 0.5, 0.05)
    body.add(torso, beak, wl, wr, ...eyes(0.1, 0.42, 0.06, 0.1))
    return { group: g, anim: (t) => { const f = Math.sin(t * 22) * 0.7; wl.rotation.z = f; wr.rotation.z = -f; body.position.y = 1.4 + Math.sin(t * 3) * 0.15 } }
  },
  logger() {
    const g = new THREE.Group(), body = new THREE.Group()
    g.add(body)
    const legs = [B(0.4, 0.9, 0.4, M.dark, -0.28, 0.45), B(0.4, 0.9, 0.4, M.dark, 0.28, 0.45)]
    body.add(...legs, B(1.1, 1.3, 0.7, M.plaid, 0, 1.55), B(1.12, 0.12, 0.72, M.dark, 0, 0.98))
    const head = new THREE.Group()
    head.position.y = 2.5
    head.add(B(0.55, 0.55, 0.5, M.skin), B(0.58, 0.2, 0.54, M.dark, 0, 0.28), ...eyes(0.02, 0.26, 0.11, 0.13))
    body.add(head)
    const armL = B(0.3, 1, 0.3, M.plaid, -0.75, 1.6), armR = new THREE.Group()
    armR.position.set(0.75, 2, 0)
    armR.add(B(0.3, 1, 0.3, M.plaid, 0, -0.5), B(0.08, 1.4, 0.08, M.wood, 0, -1, 0.35), B(0.08, 0.35, 0.5, M.steel, 0, -1.55, 0.45))
    armR.rotation.x = -0.9
    body.add(armL, armR)
    g.scale.setScalar(1.15)
    return { group: g, anim: (t, moving) => { body.position.y = Math.abs(Math.sin(t * 3)) * 0.1 * moving; legs[0].rotation.x = Math.sin(t * 3) * 0.4 * moving; legs[1].rotation.x = -Math.sin(t * 3) * 0.4 * moving; armR.rotation.x = -0.9 + Math.sin(t * 3) * 0.2 } }
  },
}

export function CreateEnemy(type, x, z) {
  const def = TYPES[type]
  const m = builders[type]()
  m.group.position.set(x, 0, z)
  return { type, ...def, maxHp: def.hp, x, z, group: m.group, anim: m.anim, base: m.group.scale.x, path: null, pathT: 0, heading: 0, side: Math.random() < 0.5 ? 1 : -1, unstick: 0, stuckT: 0, sx: x, sz: z, cool: 0.5, dying: 0, t: Math.random() * 10, hitT: 0, moving: 0 }
}

const angleLerp = (a, b, k) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * k
}

// "Olho" do inimigo: testa a direção do alvo e, se tiver obstáculo, tenta desviar para os lados
const OFFSETS = [0, 0.6, -0.6, 1.1, -1.1, 1.7, -1.7, 2.4, -2.4]
function steer(e, want) {
  const r = e.radius * 0.8 + 0.15
  for (const o of OFFSETS) {
    const off = o * e.side, a = want + off
    const dx = Math.sin(a), dz = Math.cos(a)
    if (!Blocked(e.x + dx * 0.9, e.z + dz * 0.9, r) && !Blocked(e.x + dx * 1.8, e.z + dz * 1.8, r)) {
      if (o !== 0) e.side = Math.sign(off)
      return a
    }
  }
  return want + e.side * 1.7
}

// Busca de caminho (A*) numa grade local — só roda quando o inimigo trava (bolsões entre obstáculos).
const GC = 1.2, GN = 17, GW = GN * 2 + 1
function findPath(e, tx, tz) {
  const r = e.radius * 0.8 + 0.12, ox = e.x, oz = e.z
  const idx = (i, j) => (i + GN) * GW + (j + GN)
  const blk = new Int8Array(GW * GW), g = new Float32Array(GW * GW).fill(Infinity), from = new Int32Array(GW * GW).fill(-1), done = new Uint8Array(GW * GW)
  const free = (i, j) => {
    const k = idx(i, j)
    if (!blk[k]) blk[k] = Blocked(ox + i * GC, oz + j * GC, r) ? 2 : 1
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

// retorna true quando o inimigo deve ser removido
export function UpdateEnemy(e, dt, players, colliders, onAttack) {
  e.t += dt
  if (e.dying > 0) {
    e.dying -= dt
    e.group.scale.setScalar(Math.max((e.dying / 0.25) * e.base, 0.001))
    return e.dying <= 0
  }
  e.cool -= dt
  let tp = null, bd = Infinity
  for (const p of players) {
    if (p.dead) continue
    const d = (p.x - e.x) ** 2 + (p.z - e.z) ** 2
    if (d < bd) { bd = d; tp = p }
  }
  e.moving = 0
  if (tp) {
    const dist = Math.sqrt(bd) || 0.001
    const dx = (tp.x - e.x) / dist, dz = (tp.z - e.z) / dist
    const reach = e.radius + 0.55
    const want = Math.atan2(dx, dz)
    let go = want
    if (e.path) {
      // seguindo o caminho calculado depois de travar
      const w = e.path[0]
      if (!w || (e.pathT -= dt) <= 0) e.path = null
      else if (Math.hypot(w.x - e.x, w.z - e.z) < 0.8) e.path.shift()
      else go = Math.atan2(w.x - e.x, w.z - e.z)
    } else if (!e.flying && dist > 2.2) {
      if (e.unstick > 0) { e.unstick -= dt; go = want + e.side * 1.5 } else go = steer(e, want)
    }
    e.heading = angleLerp(e.heading, go, Math.min(1, dt * (e.flying ? 8 : 10)))
    if (dist > reach * 0.9) {
      if (e.flying) {
        const sway = Math.sin(e.t * 5) * 1.6
        e.x += (dx * e.speed - dz * sway) * dt
        e.z += (dz * e.speed + dx * sway) * dt
      } else {
        e.x += Math.sin(e.heading) * e.speed * dt
        e.z += Math.cos(e.heading) * e.speed * dt
      }
      e.moving = 1
    }
    // se andou muito pouco por 0.6s, está preso: sai de lado por um instante
    if (!e.flying && (e.stuckT += dt) >= 0.6) {
      if (e.moving && Math.hypot(e.x - e.sx, e.z - e.sz) < e.speed * 0.15 && dist > reach) { e.path = findPath(e, tp.x, tp.z); e.pathT = 6; if (!e.path.length) { e.path = null; e.unstick = 0.8; e.side = -e.side } }
      e.stuckT = 0; e.sx = e.x; e.sz = e.z
    }
    // pular desvia de ataque corpo a corpo (menos corvos, que voam)
    if (dist <= reach && e.cool <= 0 && (e.flying || tp.jy < 0.9)) { e.cool = e.rate; onAttack(tp, e) }
    e.group.rotation.y = dist < reach * 2 ? want : e.heading
  }
  if (!e.flying) resolve(e, e.radius * 0.8, colliders, 0)
  e.group.position.set(e.x, Height(e.x, e.z), e.z)
  e.hitT = Math.max(0, e.hitT - dt)
  e.group.scale.setScalar(e.base * (1 + e.hitT * 1.2))
  e.anim(e.t, e.moving)
  return false
}
