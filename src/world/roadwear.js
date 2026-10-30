import * as THREE from 'three'
import { hash } from './noise'
import { CHUNK_SIZE, RoadRects } from './layout'

// Realismo do asfalto: rachaduras, remendos, marcas de pneu, manchas de óleo, bueiros e POÇAS REFLETIVAS.
// Tudo é decalque plano (geometria fundida por chunk: 3–4 draw calls) com camadas de altura + polygonOffset para não piscar.
// As camadas ficam rentes ao chão (asfalto a 0,02): quem anda pisa no terreno, então um asfalto alto engoliria os pés.

// ---------- materiais por camada ----------
const flatMats = new Map()
export function FlatMat(n) {
  if (!flatMats.has(n)) flatMats.set(n, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -n, polygonOffsetUnits: -n }))
  return flatMats.get(n)
}
const softMats = new Map()
function SoftMat(alpha) {
  if (!softMats.has(alpha)) softMats.set(alpha, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: alpha, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }))
  return softMats.get(alpha)
}
// poça no estilo da referência: água "de desenho" — azul vivo, borda clara e um risco de brilho branco (sem reflexo PBR)
const PuddleMat = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })

// ---------- construtor de decalques planos ----------
export class FlatBuilder {
  constructor() { this.pos = []; this.col = []; this._c = new THREE.Color() }
  _tri(a, b, c, y, color) {
    // garante normal para cima
    const cr = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1])
    const t = cr > 0 ? [a, b, c] : [a, c, b]
    this._c.set(color)
    for (const p of t) { this.pos.push(p[0], y, p[1]); this.col.push(this._c.r, this._c.g, this._c.b) }
  }
  rect(cx, cz, w, d, ry, color, y) {
    const c = Math.cos(ry), s = Math.sin(ry), h = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cx + x * c + z * s, cz - x * s + z * c])
    this._tri(h[0], h[1], h[2], y, color); this._tri(h[0], h[2], h[3], y, color)
  }
  seg(x1, z1, x2, z2, w, color, y) {
    const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2
    const a = [x1 + nx, z1 + nz], b = [x1 - nx, z1 - nz], c = [x2 - nx, z2 - nz], d = [x2 + nx, z2 + nz]
    this._tri(a, b, c, y, color); this._tri(a, c, d, y, color)
  }
  ellipse(cx, cz, rx, rz, ry, color, y, n = 14) {
    const c = Math.cos(ry), s = Math.sin(ry), pts = []
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, x = Math.cos(a) * rx, z = Math.sin(a) * rz; pts.push([cx + x * c + z * s, cz - x * s + z * c]) }
    for (let k = 0; k < n; k++) this._tri([cx, cz], pts[k], pts[(k + 1) % n], y, color)
  }
  disc(cx, cz, r, color, y, n = 28) { this.ellipse(cx, cz, r, r, 0, color, y, n) }
  mesh(mat) {
    if (!this.pos.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    const n = new Float32Array(this.pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3))
    const m = new THREE.Mesh(g, mat)
    m.matrixAutoUpdate = false
    return m
  }
}

// ---------- onde ficam os desgastes (grade global de 5 m ao longo de cada estrada: chunks vizinhos concordam) ----------
export function WearFor(rects, ox, oz) {
  const out = { cracks: [], patches: [], skids: [], oils: [], holes: [], puddles: [] }
  const seen = new Set()
  const inC = (x, z) => x >= ox - 0.5 && x < ox + CHUNK_SIZE - 0.5 && z >= oz - 0.5 && z < oz + CHUNK_SIZE - 0.5
  // cruzamentos: nada de desgaste no miolo, na faixa de pedestre nem na linha de retenção (até hw + 4 m da rua que cruza).
  // As ruas dos chunks vizinhos também contam: um cruzamento logo depois da borda do chunk vale igual
  const cx = Math.round(ox / CHUNK_SIZE), cz = Math.round(oz / CHUNK_SIZE), around = []
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) around.push(...RoadRects(cx + i, cz + j))
  const nearCross = (r, x, z, rad) => around.some((q) => q.axis !== r.axis && (q.axis === 'v'
    ? Math.abs(x - q.c) < q.hw + 4 + rad && z > q.a - rad && z < q.b + rad
    : Math.abs(z - q.c) < q.hw + 4 + rad && x > q.a - rad && x < q.b + rad))
  for (const r of rects) {
    const v = r.axis === 'v', lo = (v ? oz : ox) - 0.5, hi = lo + CHUNK_SIZE
    const a0 = Math.max(r.a + 1.5, lo), a1 = Math.min(r.b - 1.5, hi)
    for (let k = Math.ceil(a0 / 5 - 0.5); k * 5 + 2.5 < a1; k++) {
      const key = `${r.axis}${r.c},${k}`
      if (seen.has(key)) continue
      seen.add(key)
      const H = (s) => hash(r.c * 3 + (v ? 1 : 2), k, 600 + s)
      const along = k * 5 + 2.5 + (H(1) - 0.5) * 3
      const mk = (lat) => (v ? [r.c + lat, along] : [along, r.c + lat])
      const lat = (H(2) * 2 - 1) * (r.hw - 0.7)
      const [x, z] = mk(lat)
      if (!inC(x, z) || along < a0 || along > a1 || nearCross(r, x, z, 1.5)) continue
      const ry = v ? 0 : Math.PI / 2
      // bueiro: a vaga é só dele (antes rachadura, remendo e óleo caíam no mesmo ponto, por cima)
      if (!r.art && H(19) < 0.12) { out.holes.push({ x, z }); continue }
      if (H(3) < 0.5) out.cracks.push({ x, z, ry: ry + (H(4) - 0.5) * 1.6, len: 1.4 + H(5) * 2.6, seed: H(6) })
      if (H(7) < 0.1) out.patches.push({ x, z, w: 1.2 + H(8) * 2.0, d: 0.9 + H(9) * 1.5, ry: ry + (H(10) - 0.5) * 0.12, dark: H(11) < 0.5 })
      if (H(12) < 0.06 && !nearCross(r, x, z, 5)) { const l2 = (H(13) < 0.5 ? -1 : 1) * r.hw * 0.45, [sx, sz] = mk(l2); out.skids.push({ x: sx, z: sz, ry: ry + (H(14) - 0.5) * 0.12, len: 5 + H(15) * 5, curve: (H(16) - 0.5) * 0.5 }) }
      if (H(17) < 0.12) out.oils.push({ x, z, r: 0.3 + H(18) * 0.45 })
      if (H(20) < (r.art ? 0.05 : 0.07)) { // poças: poucas (antes eram ~3x mais)
        const l3 = (H(21) * 2 - 1) * Math.max(0.2, r.hw - 1.6), [px, pz] = mk(l3)
        out.puddles.push({ x: px, z: pz, sx: 0.7 + H(22) * 0.9, sz: 0.5 + H(23) * 0.6, ry: H(24) * 3.14 })
      }
    }
  }
  return out
}

const CRACK = 0x3c4150, PATCH_D = 0x72798c, PATCH_L = 0x9aa0b4
// monta os 3 meshes de decalque + as poças instanciadas do chunk; retorna lista de objetos adicionados
export function BuildRoadDetail(g, d, dispose, inst, Y = { decal: 0.022, soft: 0.025, puddle: 0.028 }) {
  const opaque = new FlatBuilder(), soft40 = new FlatBuilder(), soft22 = new FlatBuilder(), soft60 = new FlatBuilder(), wear = d.wear
  // rachaduras: caminhada aleatória de segmentos curtos (+ ramificação)
  for (const c of wear.cracks) {
    let x = c.x, z = c.z, a = c.ry
    const n = 5 + Math.floor(c.seed * 4), step = c.len / n
    for (let i = 0; i < n; i++) {
      a += (hash(c.x * 7 + i, c.z * 7, 640) - 0.5) * 1.1
      const nx = x + Math.cos(a) * step, nz = z - Math.sin(a) * step
      opaque.seg(x, z, nx, nz, 0.05 + 0.04 * (1 - i / n), CRACK, Y.decal)
      if (i === 2) opaque.seg(x, z, x + Math.cos(a + 1.1) * step * 1.4, z - Math.sin(a + 1.1) * step * 1.4, 0.04, CRACK, Y.decal)
      x = nx; z = nz
    }
  }
  for (const p of wear.patches) {
    opaque.rect(p.x, p.z, p.w, p.d, p.ry, p.dark ? PATCH_D : PATCH_L, Y.decal)
    for (const [dx, dz, w, dd] of [[0, -p.d / 2, p.w, 0.06], [0, p.d / 2, p.w, 0.06], [-p.w / 2, 0, 0.06, p.d], [p.w / 2, 0, 0.06, p.d]]) {
      const c = Math.cos(p.ry), s = Math.sin(p.ry)
      opaque.rect(p.x + dx * c + dz * s, p.z - dx * s + dz * c, w, dd, p.ry, CRACK, Y.decal + 0.001)
    }
  }
  for (const h of wear.holes) { opaque.disc(h.x, h.z, 0.56, 0x3e4352, Y.decal, 14); opaque.disc(h.x, h.z, 0.47, 0x646b7c, Y.decal + 0.001, 14); for (let k = 0; k < 4; k++) opaque.rect(h.x, h.z, 0.7, 0.05, k * 0.785, 0x3e4352, Y.decal + 0.002) }
  // marcas de pneu: duas faixas paralelas com leve curva
  for (const s of wear.skids) {
    for (const off of [-0.8, 0.8]) {
      const n = 8, step = s.len / n
      let a = s.ry, dx = Math.sin(a), dz = Math.cos(a) // ao longo da estrada: ry=0 => +z ; ry=π/2 => +x
      let x = s.x + Math.cos(a) * off - dx * s.len / 2, z = s.z - Math.sin(a) * off - dz * s.len / 2
      for (let i = 0; i < n; i++) {
        a += s.curve / n
        dx = Math.sin(a); dz = Math.cos(a)
        soft40.seg(x, z, x + dx * step, z + dz * step, 0.2, 0x1b1d24, Y.soft)
        x += dx * step; z += dz * step
      }
    }
  }
  for (const o of wear.oils) { soft60.ellipse(o.x, o.z, o.r, o.r * 0.75, o.x * 3, 0x14161c, Y.soft, 10); soft40.ellipse(o.x + 0.05, o.z, o.r * 0.55, o.r * 0.4, 0, 0x3a2d5a, Y.soft + 0.001, 8) }
  for (const p of wear.puddles) soft22.ellipse(p.x, p.z, p.sx * 1.18, p.sz * 1.22, p.ry, 0x24303d, Y.soft, 12) // borda molhada
  // finais de estrada e sinalização pintada
  const flat = {}
  const fb = (n) => (flat[n] ||= new FlatBuilder())
  const MAT_L = { dirt: [2, 0.012, 0x8f6236], trench: [3, 0.014, 0x3a2a1f], paved: [3, 0.014, 0xc9ccd6], lot: [3, 0.014, 0x7a8195], plaza: [3, 0.014, 0xe2d9c4], grass: [4, 0.016, 0x74d03c], path: [5, 0.018, 0xe2d9c4] } // lot/plaza/grass/path: lotes das cidades
  for (const r of d.endRects) {
    const [n, y, col] = MAT_L[r.mat]
    fb(n).rect(r.x, r.z, r.w, r.d, 0, col, y)
  }
  for (const s of d.endSoft) soft60.rect(s.x, s.z, s.w, s.d, 0, s.color, Y.soft)
  for (const c of d.endDiscs) {
    if (c.mat === 'asphalt') fb(3).disc(c.x, c.z, c.r, 0x858da3, 0.02)
    else if (c.mat === 'curb') fb(4).disc(c.x, c.z, c.r, 0xd9dbe4, 0.022)
    else if (c.mat === 'grass') fb(5).disc(c.x, c.z, c.r, 0x74d03c, 0.027)
  }
  for (const p of d.paint) fb(7).rect(p.x, p.z, p.w, p.d, 0, p.color, 0.034)
  const adds = []
  const put = (m) => { if (m) { g.add(m); dispose.push(m.geometry); adds.push(m) } }
  for (const n of Object.keys(flat)) put(flat[n].mesh(FlatMat(+n)))
  put(opaque.mesh(FlatMat(4)))
  put(soft22.mesh(SoftMat(0.25))); put(soft40.mesh(SoftMat(0.4))); put(soft60.mesh(SoftMat(0.6)))
  // poças: margem clara, miolo azul e dois brilhos brancos (1 draw call por chunk)
  if (wear.puddles.length) {
    const pb = new FlatBuilder(), y = Y.puddle
    for (const p of wear.puddles) {
      // formato orgânico: dois lóbulos sobrepostos (borda clara) e dois miolos azuis
      const c = Math.cos(p.ry), s = Math.sin(p.ry), lx = p.sx * 0.45, hx = -p.sx * 0.3, hz = -p.sz * 0.25
      pb.ellipse(p.x, p.z, p.sx * 0.8, p.sz, p.ry, 0x9fe0f2, y, 14)
      pb.ellipse(p.x + lx * c, p.z - lx * s, p.sx * 0.62, p.sz * 0.75, p.ry + 0.4, 0x9fe0f2, y + 0.001, 12)
      pb.ellipse(p.x, p.z, p.sx * 0.64, p.sz * 0.8, p.ry, 0x3f9be0, y + 0.002, 14)
      pb.ellipse(p.x + lx * c, p.z - lx * s, p.sx * 0.47, p.sz * 0.58, p.ry + 0.4, 0x3f9be0, y + 0.003, 12)
      pb.ellipse(p.x + hx * c + hz * s, p.z - hx * s + hz * c, p.sx * 0.28, p.sz * 0.09, p.ry + 0.3, 0xffffff, y + 0.004, 8)
      pb.ellipse(p.x - hx * 0.6 * c, p.z + hx * 0.6 * s, p.sx * 0.1, p.sz * 0.07, p.ry, 0xffffff, y + 0.004, 6)
    }
    put(pb.mesh(PuddleMat))
  }
}
