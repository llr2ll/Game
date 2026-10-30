import { hash } from '../../engine/world/noise'
import { NodeX, NodeZ, NodeType, NodeArms, ARMS, ZONE, GRID, ROW_Z, ROAD_HALF, STREET_OFF, STREET_HW, StationOf, ArterialDistV, ArterialDistH, InZone, CHUNK_SIZE } from './layout'
import { ItemsNear } from './town'
import { PoleNear } from './poles'
import { NodeName, RoadCode, StreetName, Destination } from './names'

// Sinalização (função pura do mundo): placas de rua nas cidades, semáforos, faixas de pedestre, entradas de povoado,
// painéis de direção e marcos de quilômetro nas estradas. Cada item é um descritor; o gerador de chunks desenha só os do seu chunk.
//  { kind:'sign', poles:[[x,z],..], postH, plates:[{cx,cz,y,fx,fz,w,h,key}] }
//  { kind:'km', x, z, ry, plates:[...] }     { kind:'light', x, z, ry, grp }     { kind:'paint', x, z, w, d, color }
//  grp = fase do semáforo (0/1): as duas vias de um cruzamento ficam em fases opostas (world/streetlights.js)
const WHITE = 0xf2f2f0
const cache = new Map()

const stationNear = (x, z, m) => { const st = StationOf(0, Math.floor((z + 0.5) / CHUNK_SIZE)); return !!st && Math.abs(x - st.x) < m && Math.abs(z - st.z) < m }
const blocked = (x, z, m) => ItemsNear(x - m, x + m, z - m, z + m).length > 0 || stationNear(x, z, 7)

function nodeSigns(i, j) {
  const key = `${i},${j}`
  if (cache.has(key)) return cache.get(key)
  const out = []
  cache.set(key, out)
  const t = NodeType(i, j), cx = NodeX(i), cz = NodeZ(j), arms = NodeArms(i, j)

  // ----- na beira de cada braço: entrada do povoado + limite de velocidade + painel de direção -----
  arms.forEach((on, k) => {
    if (!on) return
    const [ax, az] = ARMS[k], rx = az, rz = -ax // a = braço (sentido nó -> estrada); direita de quem chega
    const ze = t ? ZONE[t] : 0
    if (t) {
      let dd = ze + 3, x = cx + ax * dd + rx * 4.9, z = cz + az * dd + rz * 4.9
      for (let tries = 0; tries < 3 && PoleNear(x, z, 2.2); tries++) { dd += 3; x = cx + ax * dd + rx * 4.9; z = cz + az * dd + rz * 4.9 }
      if (!blocked(x, z, 2) && !InZone(x, z, 0) && !PoleNear(x, z, 1.6)) {
        out.push({ kind: 'sign', poles: [[x, z]], postH: 2.6, plates: [
          { cx: x, cz: z, y: 2.3, fx: ax, fz: az, w: 1.8, h: 0.45, key: `city:${NodeName(i, j)}` },
          { cx: x, cz: z, y: 1.65, fx: ax, fz: az, w: 0.6, h: 0.6, key: `speed:${t === 'city' ? 30 : 50}` },
        ] })
      }
    }
    let dd = t ? ze + 14 : 26
    const lines = []
    const dx = -ax, dz = -az // sentido de quem chega
    const arrowOf = (kk) => { const [bx, bz] = ARMS[kk], dot = dx * bx + dz * bz, cross = dx * bz - dz * bx; return dot > 0.5 ? '↑' : cross > 0 ? '→' : '←' }
    const kmAhead = Math.max(1, Math.round(dd / 32))
    if (t) lines.push({ o: 0, s: `↑~${NodeName(i, j)}~${kmAhead} km` })
    const order = [0, 1, 2, 3].filter((kk) => kk !== k && arms[kk]).map((kk) => ({ kk, dot: ARMS[kk][0] * dx + ARMS[kk][1] * dz })).sort((p, q) => q.dot - p.dot)
    for (const { kk } of order) {
      const dest = Destination(i, j, kk)
      const ar = arrowOf(kk)
      lines.push({ o: ar === '↑' ? 0 : 1, s: dest ? `${ar}~${dest.name}~${dest.km + kmAhead} km` : `${ar}~${RoadCode(ARMS[kk][0] ? 'h' : 'v', ARMS[kk][0] ? j : i)}~` })
    }
    if (lines.length) {
      let x = cx + ax * dd + rx * 5.2, z = cz + az * dd + rz * 5.2
      for (let tries = 0; tries < 4 && (PoleNear(x - rx * 1.35, z - rz * 1.35, 1.7) || PoleNear(x + rx * 1.35, z + rz * 1.35, 1.7) || PoleNear(x, z, 1.7)); tries++) { dd += 3.5; x = cx + ax * dd + rx * 5.2; z = cz + az * dd + rz * 5.2 }
      // postes dos dois lados do painel (largura 3,2 m, na direção do vetor "direita")
      if (!blocked(x, z, 3) && !InZone(x, z, 4)) {
        out.push({ kind: 'sign', poles: [[x - rx * 1.35, z - rz * 1.35], [x + rx * 1.35, z + rz * 1.35]], postH: 3.7, plates: [
          { cx: x, cz: z, y: 2.85, fx: ax, fz: az, w: 3.2, h: 1.6, key: `dir:${lines.slice(0, 3).map((l) => l.s).join('|')}` },
        ] })
      }
    }
  })

  // ----- marcos de quilômetro: só nas estradas fora de povoados são tratados em kmPosts() -----

  if (t === 'city') {
    const G = [-STREET_OFF, 0, STREET_OFF]
    const flip = hash(i, j, 510) > 0.5
    for (const a of G) for (const b of G) {
      const ix = cx + a, iz = cz + b, hwV = a === 0 ? ROAD_HALF : STREET_HW, hwH = b === 0 ? ROAD_HALF : STREET_HW
      const nV = StreetName(i, j, 'v', a === 0 ? 0 : a > 0 ? 1 : -1), nH = StreetName(i, j, 'h', b === 0 ? 0 : b > 0 ? 1 : -1)
      const center = a === 0 && b === 0
      // faixas de pedestre nos 4 braços + linhas de retenção onde a rua local encontra a avenida
      for (const [ex, ez] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const vertical = ez !== 0, cross = vertical ? hwH : hwV, lane = vertical ? hwV : hwH, dist = cross + 1.5
        const px = ix + ex * dist, pz = iz + ez * dist
        for (let s = -lane + 0.55; s <= lane - 0.4; s += 0.95) out.push({ kind: 'paint', x: vertical ? ix + s : px, z: vertical ? pz : iz + s, w: vertical ? 0.5 : 2.6, d: vertical ? 2.6 : 0.5, color: WHITE })
        const localMeetsArt = vertical ? (a !== 0 && b === 0) : (a === 0 && b !== 0)
        if (localMeetsArt) { // linha de retenção na pista de quem chega (lado direito do eixo)
          const sx = ix + ex * (dist + 1.9), sz = iz + ez * (dist + 1.9)
          out.push({ kind: 'paint', x: vertical ? ix + ez * lane / 2 : sx, z: vertical ? sz : iz - ex * lane / 2, w: vertical ? lane - 0.2 : 0.4, d: vertical ? 0.4 : lane - 0.2, color: WHITE })
        }
      }
      if (center) {
        // semáforos nos 4 cantos: os da via vertical numa fase, os da horizontal na outra (a ordem inverte por cidade)
        const o = ROAD_HALF + 0.45, gv = flip ? 1 : 0, gh = 1 - gv
        out.push({ kind: 'light', x: ix + o, z: iz + o, ry: 0, grp: gv }, { kind: 'light', x: ix - o, z: iz - o, ry: Math.PI, grp: gv },
          { kind: 'light', x: ix + o, z: iz - o, ry: Math.PI / 2, grp: gh }, { kind: 'light', x: ix - o, z: iz + o, ry: -Math.PI / 2, grp: gh })
        continue
      }
      // no quadrado da calçada da esquina, 0,6 m longe dos dois meios-fios (nada em cima da faixa de pedestre)
      const on = (sx, sz) => ({ x: ix + sx * (hwV + 0.6), z: iz + sz * (hwH + 0.6) })
      // placas com o nome das duas ruas num canto (e no canto oposto); placas centradas no poste, um pouco para fora
      const diag = (a !== 0 && b === 0) ? [[1, -1], [-1, 1]] : [[1, 1], [-1, -1]]
      for (const [sx, sz] of diag) {
        const p = on(sx, sz)
        out.push({ kind: 'sign', poles: [[p.x, p.z]], postH: 3.2, plates: [
          { cx: p.x + sx * 0.25, cz: p.z, y: 2.95, fx: 0, fz: sz, w: 1.4, h: 0.35, key: `name:${nV}` },
          { cx: p.x, cz: p.z + sz * 0.25, y: 2.5, fx: sx, fz: 0, w: 1.4, h: 0.35, key: `name:${nH}` },
        ] })
      }
      // PARE nas ruas locais que chegam numa avenida: ao lado da linha de retenção, antes da faixa de pedestre
      if (a !== 0 && b === 0) for (const sz of [-1, 1]) { const p = { x: ix + sz * (hwV + 0.5), z: iz + sz * (hwH + 3.4) }; out.push({ kind: 'sign', poles: [[p.x, p.z]], postH: 2.5, plates: [{ cx: p.x, cz: p.z, y: 2.0, fx: 0, fz: sz, w: 0.7, h: 0.7, key: 'stop' }] }) }
      if (a === 0 && b !== 0) for (const sx of [-1, 1]) { const p = { x: ix + sx * (hwV + 3.4), z: iz - sx * (hwH + 0.5) }; out.push({ kind: 'sign', poles: [[p.x, p.z]], postH: 2.5, plates: [{ cx: p.x, cz: p.z, y: 2.0, fx: sx, fz: 0, w: 0.7, h: 0.7, key: 'stop' }] }) }
    }
  }
  return out
}

// marcos de km: grade de 32 m ao longo das estradas principais, no lado oposto aos postes de luz
function kmPosts(x0, x1, z0, z1, out) {
  for (let i = Math.floor((x0 - 8) / GRID); i <= Math.ceil((x1 + 8) / GRID); i++) {
    const c = i * GRID, x = c + 4.4
    if (x < x0 - 1 || x > x1 + 1) continue
    for (let k = Math.ceil((z0 - 16) / 32); k * 32 + 16 < z1 + 1; k++) {
      const z = k * 32 + 16
      if (z < z0 || ArterialDistV(x, z) > 4.5 || ArterialDistH(x, z) < 9 || InZone(x, z, 6) || blocked(x, z, 1.5)) continue
      const km = Math.abs(k), code = RoadCode('v', i)
      out.push({ kind: 'km', x, z, ry: 0, plates: [0, 1].map((s) => ({ cx: x, cz: z + (s ? 0.115 : -0.115), y: 0.55, fx: 0, fz: s ? 1 : -1, w: 0.46, h: 0.23, key: `km:${code}|${km}` })) })
    }
  }
  for (let j = Math.floor((z0 - 8 - ROW_Z) / GRID); j <= Math.ceil((z1 + 8 - ROW_Z) / GRID); j++) {
    const c = NodeZ(j), z = c + 4.4
    if (z < z0 - 1 || z > z1 + 1) continue
    for (let k = Math.ceil((x0 - 16) / 32); k * 32 + 16 < x1 + 1; k++) {
      const x = k * 32 + 16
      if (x < x0 || ArterialDistH(x, z) > 4.5 || ArterialDistV(x, z) < 9 || InZone(x, z, 6) || blocked(x, z, 1.5)) continue
      const km = Math.abs(k), code = RoadCode('h', j)
      out.push({ kind: 'km', x, z, ry: Math.PI / 2, plates: [0, 1].map((s) => ({ cx: x + (s ? 0.115 : -0.115), cz: z, y: 0.55, fx: s ? 1 : -1, fz: 0, w: 0.46, h: 0.23, key: `km:${code}|${km}` })) })
    }
  }
}

export function SignsNear(x0, x1, z0, z1) {
  const out = []
  const seen = new Set()
  for (let i = Math.floor((x0 - 80) / GRID); i <= Math.ceil((x1 + 80) / GRID); i++)
    for (let j = Math.floor((z0 - 80 - ROW_Z) / GRID); j <= Math.ceil((z1 + 80 - ROW_Z) / GRID); j++)
      for (const s of nodeSigns(i, j)) if (!seen.has(s)) { seen.add(s); out.push(s) }
  kmPosts(x0, x1, z0, z1, out)
  return out
}
// posição de referência do descritor (para decidir em qual chunk ele é desenhado)
export const SignPos = (s) => s.kind === 'sign' ? s.poles.reduce((a, p) => [a[0] + p[0] / s.poles.length, a[1] + p[1] / s.poles.length], [0, 0]) : [s.x, s.z]
