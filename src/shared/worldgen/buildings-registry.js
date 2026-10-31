import { FLOOR_H, FLOOR0, SLAB, CUT_H, DOOR_H } from './buildings'
import { events } from '../../engine/core/events'

// Casas carregadas. Cada uma tem a malha fechada + um recorte por andar (meshes[0] = fechada, meshes[1 + k] = andar k)
// e uma porta que abre sozinha quando alguém chega perto.
const set = new Set()
export const AddBuildings = (arr) => arr.forEach((b) => set.add(b))
export const RemoveBuildings = (arr) => arr.forEach((b) => set.delete(b))
export const ResetBuildings = () => set.clear()
const inRect = (b, x, z) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1

// A câmera fica atrás (+z) e acima do jogador: a linha de visada sobe CAM_SLOPE por metro em direção à câmera.
// Uma casa entre a câmera e o jogador (que o esconderia) vira recorte do térreo enquanto ele estiver ali atrás.
const CAM_SLOPE = 1.45
const hides = (b, p) => {
  if (p.x < b.x0 - 1 || p.x > b.x1 + 1 || b.z1 < p.z) return false
  const dz = Math.max(0, b.z0 - p.z)
  return dz < 16 && (p.gy || 0) + 1.2 + CAM_SLOPE * dz < b.y + b.pr.top
}
// Chamado antes de desenhar cada tela: quem está dentro vê o recorte do andar mais baixo ocupado por alguém daquela tela
export function UpdateBuildings(players) {
  for (const b of set) {
    let mode = 0
    for (const p of players) if (!p.dead && inRect(b, p.x, p.z)) { const m = 1 + (p.lv || 0); if (!mode || m < mode) mode = m }
    if (!mode) for (const p of players) if (!p.dead && hides(b, p)) { mode = 1; break }
    if (mode === b.mode) continue
    b.meshes[b.mode].visible = false
    b.meshes[mode].visible = true
    b.mode = mode
    // no recorte do térreo a porta fica baixinha como as paredes (não tapa a visão)
    b.door.leaf.scale.y = mode === 1 ? CUT_H / DOOR_H : 1
    b.door.leaf.updateMatrix()
  }
}

// Portas: abrem para dentro quando jogador ou inimigo chega a menos de OPEN_R da soleira; fechadas bloqueiam passagem e tiro
const OPEN_R = 2.2, OPEN_ANG = 1.65
export function UpdateDoors(dt, players, enemies) {
  for (const b of set) {
    const d = b.door
    let near = false
    for (const p of players) if (!p.dead && (p.x - d.x) ** 2 + (p.z - d.z) ** 2 < OPEN_R * OPEN_R) { near = true; break }
    if (!near && !d.lock) for (const e of enemies) if (e.dying <= 0 && (e.x - d.x) ** 2 + (e.z - d.z) ** 2 < OPEN_R * OPEN_R) { near = true; break }
    const goal = near ? OPEN_ANG : 0
    if (d.ang === goal) continue
    if (goal && !d.ang) events.emit('door-open', { x: d.x, z: d.z }) // começou a abrir (o jogo toca trinco + rangido)
    d.ang = goal > d.ang ? Math.min(goal, d.ang + dt * 5) : Math.max(goal, d.ang - dt * 4)
    if (!goal && !d.ang) events.emit('door-close', { x: d.x, z: d.z }) // bateu
    d.pivot.rotation.y = b.ry + d.ang
    d.pivot.updateMatrix()
    d.col.off = d.ang > 0.35
  }
}

// casa ainda carregada? (o objeto some quando o chunk sai; volta outro quando o chunk volta)
export const HasBuilding = (b) => set.has(b)
// portas das casas carregadas a menos de r de (x, z): { id (posição), x, z, y, ry, ox, oz (para fora), w (largura), d (porta), b (casa) }
// d.lock = true: zumbi não abre (gente abre)
export function DoorsNear(x, z, r) {
  const out = []
  for (const b of set) {
    const d = b.door
    if (Math.hypot(d.x - x, d.z - z) >= r) continue
    out.push({ id: `${d.x.toFixed(1)},${d.z.toFixed(1)}`, x: d.x, z: d.z, y: b.y, ry: b.ry, ox: b.sn, oz: b.cs, w: 2 * Math.max(d.col.hw, d.col.hd), d, b })
  }
  return out
}

// casa que contém o ponto (ou null)
export function BuildingAt(x, z) {
  for (const b of set) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return b
  return null
}
// janelas do térreo das casas carregadas a menos de r de (x, z): { id, x, z, nx, nz (para fora), w, y, b }
export function WindowsNear(x, z, r) {
  const out = []
  for (const b of set) {
    if (x < b.x0 - r || x > b.x1 + r || z < b.z0 - r || z > b.z1 + r) continue
    for (const w of b.windows) if (Math.hypot(w.x - x, w.z - z) < r) out.push({ ...w, b })
  }
  return out
}

// móveis das casas carregadas a menos de r de (x, z), no andar lv (cada um: { x, z, y, lv, key, room, r, id })
export function SpotsNear(x, z, lv, r) {
  const out = []
  for (const b of set) {
    if (x < b.x0 - r || x > b.x1 + r || z < b.z0 - r || z > b.z1 + r) continue
    for (const s of b.spots) if (s.lv === lv && Math.hypot(s.x - x, s.z - z) < r) out.push(s)
  }
  return out
}

export function PointInBuilding(x, z, m = 0) {
  for (const b of set) if (x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) return true
  return false
}

// ---------------------------------------------------------------------------------
//  Andares: piso do térreo, lajes (com o vão da escada) e rampas das escadas, em coordenadas locais da casa.
//  FloorAt(x, z, pés) -> { y, lv, blocked, ceil, b } ou null (fora de qualquer interior)
//   y = superfície mais alta alcançável (até STEP acima dos pés)   blocked = há algo sólido na altura do corpo (lateral da escada)
//   ceil = teto (fundo da laje de cima)                           lv = andar
// ---------------------------------------------------------------------------------
const STEP = 0.6, BODY = 1.8
const toLocal = (b, x, z) => { const dx = x - b.x, dz = z - b.z; return [dx * b.cs - dz * b.sn, dx * b.sn + dz * b.cs] }
const inR = (r, lx, lz, m = 0) => lx > r.x0 - m && lx < r.x1 + m && lz > r.z0 - m && lz < r.z1 + m
export function FloorAt(x, z, feet) {
  for (const b of set) {
    if (x <= b.ix0 || x >= b.ix1 || z <= b.iz0 || z >= b.iz1) continue
    const pr = b.pr, [lx, lz] = toLocal(b, x, z), f = feet - b.y
    let best = -Infinity, blocked = false, ceil = Infinity
    const test = (top, bot) => {
      if (top <= f + STEP) { if (top > best) best = top } else if (bot < f + BODY) blocked = true
      else if (bot < ceil) ceil = bot
    }
    test(FLOOR0, -Infinity)
    for (let k = 1; k < pr.floors; k++) if (!inR(pr.ramps[k - 1], lx, lz)) test(k * FLOOR_H, k * FLOOR_H - SLAB)
    for (const r of pr.ramps) if (inR(r, lx, lz)) test(r.y0 + ((r.y1 - r.y0) * (lx - r.x0)) / (r.x1 - r.x0), r.y0 - 0.3)
    if (best === -Infinity) best = FLOOR0
    return { y: b.y + best, lv: Math.max(0, Math.min(pr.floors - 1, Math.round((best - FLOOR0) / FLOOR_H))), blocked, ceil: b.y + ceil, b }
  }
  return null
}

// Rota de perseguição para inimigos: próximo ponto (mundo) a seguir, ou null para ir reto no alvo.
//  alvo dentro de uma casa e inimigo fora dela -> porta (ponto na frente, depois logo dentro)
//  inimigo dentro e alvo fora                 -> desce as escadas e sai pela porta
//  mesma casa, andares diferentes            -> escada certa (pé / topo)
//  inside = o inimigo já está dentro (vai reto no ponto; lá fora ainda desvia de obstáculos até a porta)
const toWorld = (b, t, inside) => ({ x: b.x + t[0] * b.cs + t[1] * b.sn, z: b.z - t[0] * b.sn + t[1] * b.cs, inside })
export function ChaseTarget(x, z, feet, tx, tz, tfeet) {
  const me = FloorAt(x, z, feet), them = FloorAt(tx, tz, tfeet)
  if (!me && !them) return null
  const b = (me || them).b, pr = b.pr, [lx, lz] = toLocal(b, x, z)
  const near = (q, r = 0.7) => Math.hypot(lx - q[0], lz - q[1]) < r
  const out = [pr.doorX, pr.d / 2 + 1.1], inn = [pr.doorX, pr.iz - 0.9]
  if (!me || me.b !== them?.b) {
    if (!me) return toWorld(b, near(out, 0.9) || (Math.abs(lx - pr.doorX) < 0.6 && lz > pr.iz - 0.3) ? inn : out, false)
    if (me.lv === 0) return toWorld(b, near(inn, 0.9) || lz > pr.iz - 0.3 ? out : inn, true)
  } else {
    // na escada: termina de subir/descer antes de ir no alvo (o andar "vira" no meio da escada)
    const r = pr.ramps.find((q) => inR(q, lx, lz, 0.1))
    if (r && Math.abs(tfeet - feet) > 0.5) return toWorld(b, tfeet > feet ? (near(r.tin, 0.6) ? r.top : r.tin) : near(r.bin, 0.6) ? r.bot : r.bin, true)
    if (me.lv === them.lv) return null
  }
  // escada: subir se o alvo está mais alto (mesma casa); descer se está mais baixo ou do lado de fora
  const up = me.b === them?.b && tfeet > feet
  let t, r = pr.ramps.find((q) => inR(q, lx, lz, 0.1))
  if (r) t = up ? (near(r.tin, 0.6) ? r.top : r.tin) : near(r.bin, 0.6) ? r.bot : r.bin // segue a escada até a ponta antes de sair dela
  else {
    r = up ? pr.ramps[me.lv] : pr.ramps[me.lv - 1]
    if (!r) return null
    t = up ? (near(r.bot) ? r.bin : r.bot) : near(r.top) ? r.tin : r.top
  }
  return toWorld(b, t, true)
}
