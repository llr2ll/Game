import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { P, merge, bx, cyl, sph, cone, prism } from '../../engine/render/style'
import { BUSH } from './assets'
import { hash } from '../../engine/world/noise'

// =====================================================================================
//  Casas no estilo "brinquedo" de Link's Awakening: telhado grosso de telhas em fileiras com a borda recortada
//  em lóbulos (a mesma linguagem das copas das árvores), arco de pedra na porta, janelas de moldura grossa com
//  floreira, chaminé redonda, cunhais e rodapé de pedra. Tudo com cor por vértice e fundido (1 draw call por malha).
//  Cada protótipo gera:
//   closed   = casa fechada (paredes, fachada, telhado)
//   cuts[k]  = recorte mostrado quando há alguém no andar k: andares de baixo inteiros + andar k com paredes baixas e móveis
//   door     = folha da porta (malha à parte, gira na dobradiça)
//  A porta fica na face local +z. Os andares se ligam por escadas encostadas na parede do fundo.
// =====================================================================================
export const T = 0.45 // espessura da parede
export const DOOR_W = 1.7, DOOR_H = 2.5, FLOOR_H = 3.0, SLAB = 0.24, CUT_H = 1.1, FLOOR0 = 0.1
export const RUN = 3.8, STW = 1.5 // escada: comprimento e largura (cabe o inimigo grande)
export const wallHeight = (s) => s.floors * FLOOR_H + 0.3
export const EAVE_X = 0.45 // beiral nas laterais (espaçamento entre casas)

const WOOD = 0xb87638, WOOD_L = 0xd99c5a, WOOD_D = 0x7e4a26, WHITE = 0xfbf5e8, METAL = 0x3c4250, STONE_F = 0xb9bec9
const GLASS = 0x2b4d8a, GLASS_T = 0x8cc8f4, GOLD = 0xf2c040
const FLOWERS = [0xff5a4a, 0xffd23a, 0xff8fc0, 0xffffff, 0xb48cff]
const CLOTH = [0xe0503c, 0x3f7fd8, 0x4fb860, 0xf0a030, 0xb060c8, 0x2fb0a8]

const STONE = [0xc3c8d4, 0xd9cdb4, 0xbac4b6], ROOF_A = [0xe0573e, 0x3f78db, 0x2fa08c, 0x8a5fd0]
const PLASTER = [0xf7ecd2, 0xf9dc84, 0xf7bfa8, 0xc2ead2, 0xc4dcf6], ROOF_B = [0xe0603c, 0x3f6fd0, 0x4aae5a, 0xc8467e, 0xec8a30]
const SHUT = [0x3fa36c, 0xc0653a, 0x3f78c8, 0xd0a030]
const CITYW = [0xf6f0e2, 0xc6e6f4, 0xf7cdc4, 0xfbe7a6], AWN = [0xe84a3c, 0x3f8fe0, 0x4fb860, 0xf0a030]
const v = (wall, roof, acc, trim, door) => ({ wall, roof, acc, trim, door })
const stoneVars = [0, 1, 2, 3].map((i) => v(STONE[i % 3], ROOF_A[i], SHUT[i], 0xfff4dc, WOOD))
const plasterVars = [0, 1, 2, 3, 4].map((i) => v(PLASTER[i], ROOF_B[i], SHUT[(i + 1) % 4], 0xffffff, SHUT[(i + 2) % 4]))
const cityVars = [0, 1, 2, 3].map((i) => v(CITYW[i], ROOF_A[(i + 1) % 4], AWN[i], 0xffffff, AWN[(i + 1) % 4]))

// w = largura da fachada, d = profundidade. Casas de 3 andares precisam de w >= 9.2 (duas escadas no fundo).
export const SPECS = {
  stone1: { kind: 'stone', w: 7.6, d: 6.6, floors: 1, roof: 'gable', rise: 2.7, chimney: 1, shutters: true, interior: 'cottage', vars: stoneVars },
  stone2: { kind: 'stone', w: 8.2, d: 6.8, floors: 2, roof: 'gable', rise: 2.8, chimney: 1, shutters: true, balcony: true, interior: 'cottage', vars: stoneVars },
  stone3: { kind: 'stone', w: 8.6, d: 7.0, floors: 2, roof: 'gable', rise: 2.9, chimney: 2, shutters: true, interior: 'cottage', doorX: 1.3, vars: stoneVars },
  stone_s: { kind: 'stone', w: 6.6, d: 6.2, floors: 1, roof: 'gable', rise: 2.4, chimney: 1, interior: 'cottage', vars: stoneVars },
  house1: { kind: 'plaster', w: 7.8, d: 6.6, floors: 1, roof: 'hip', rise: 2.6, shutters: true, interior: 'house', vars: plasterVars },
  house2: { kind: 'plaster', w: 8.0, d: 6.8, floors: 2, roof: 'gable', rise: 2.8, chimney: 1, interior: 'house', vars: plasterVars },
  house3: { kind: 'plaster', w: 8.6, d: 6.6, floors: 1, roof: 'gable', rise: 2.6, shutters: true, interior: 'house', vars: plasterVars },
  city_gal: { kind: 'city', w: 9.4, d: 5.6, floors: 3, roof: 'flat', galeria: true, interior: 'house', vars: cityVars },
  city_shop: { kind: 'city', w: 9.0, d: 5.6, floors: 2, roof: 'flat', awning: true, sign: true, interior: 'shop', vars: cityVars },
  city_stone: { kind: 'stone', w: 9.4, d: 5.6, floors: 3, roof: 'gable', rise: 2.5, over: 0.3, balcony: true, interior: 'cottage', chimney: 1, vars: stoneVars },
  short: { kind: 'city', w: 8.0, d: 5.0, floors: 1, roof: 'flat', awning: true, sign: true, interior: 'shop', vars: cityVars },
  city_corner: { kind: 'city', w: 7.0, d: 5.8, floors: 2, roof: 'flat', awning: true, sign: true, interior: 'shop', vars: cityVars }, // lotes da periferia (frente de 7,8 m)
}

const BOT = (nx, ny) => ny < -0.5
const BACK = (nx, ny, nz) => nz < -0.5
// caixa arredondada; as medidas se repetem muito (cunhais, balaústres, molduras), então fica em cache já sem índice
// (o RoundedBoxGeometry é caro de gerar). P() nunca altera a geometria que recebe.
const rbxCache = new Map()
function rbx(w, h, d, r = 0.07) {
  const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${r}`
  let g = rbxCache.get(k)
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 1, Math.max(0.005, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002)))
    if (g.index) g = g.toNonIndexed()
    g.deleteAttribute('uv')
    rbxCache.set(k, g)
  }
  return g
}
// caixa (arredondada / reta) apoiada na base y, centrada em x/z
const B = (w, h, d, c, x = 0, y = 0, z = 0, o = {}) => P(rbx(w, h, d, o.rr ?? 0.06), c, { p: [x, y + h / 2, z], grad: [0.84, 1.05], lit: 0.12, omit: BOT, ...o })
const Q = (w, h, d, c, x = 0, y = 0, z = 0, o = {}) => P(bx(w, h, d), c, { p: [x, y + h / 2, z], grad: [0.86, 1.04], omit: BOT, ...o })
const tint = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex()
// meio disco (arco) em pé: lado reto em y = 0, espessura em z
const halfDisc = (r, th, seg = 12) => new THREE.CylinderGeometry(r, r, th, seg, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2)
// meio cilindro deitado no eixo x (tampa de baú)
const halfCylX = (r, len) => new THREE.CylinderGeometry(r, r, len, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)
const _up = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion()
// cilindro entre dois pontos (corrimão, cumeeira do telhado de 4 águas)
function rod(a, b, r, color, seg = 6, o = {}) {
  _a.set(...a); _b.set(...b)
  const len = _a.distanceTo(_b), g = P(cyl(r, r, len, seg), color, o)
  g.applyQuaternion(_q.setFromUnitVectors(_up, _b.clone().sub(_a).normalize()))
  return g.translate((_a.x + _b.x) / 2, (_a.y + _b.y) / 2, (_a.z + _b.z) / 2)
}
function rng(seed) {
  let s = (seed | 0) || 1
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
}
const bush = (s, x, y, z) => BUSH.clone().scale(s, s, s).translate(x, y, z)

// padrão de pedras: cor por "quadrado" da malha da caixa (alinhado à segmentação)
function stoneTri(w, h, d, sw, sh, sd, seed) {
  return (c, cx, cy, cz, nx, ny, nz) => {
    let u, vv
    if (Math.abs(nz) > 0.5) { u = Math.floor((cx + w / 2) / (w / sw)); vv = Math.floor((cy + h / 2) / (h / sh)) }
    else if (Math.abs(nx) > 0.5) { u = Math.floor((cz + d / 2) / (d / sd)); vv = Math.floor((cy + h / 2) / (h / sh)) }
    else { u = Math.floor((cx + w / 2) / (w / sw)); vv = Math.floor((cz + d / 2) / (d / sd)) }
    const h1 = hash(u, vv, seed), h2 = hash(u, vv, seed + 77)
    c.multiplyScalar(0.8 + 0.32 * h1)
    c.r *= 1 + 0.08 * (h2 - 0.5); c.b *= 1 - 0.08 * (h2 - 0.5)
  }
}
function stoneBox(w, h, d, x, y, z, color, seed, fn, cell = 1.1) {
  const sw = Math.max(1, Math.round(w / cell)), sh = Math.max(1, Math.round(h / (cell * 0.62))), sd = Math.max(1, Math.round(d / cell))
  return P(new THREE.BoxGeometry(w, h, d, sw, sh, sd), color, { p: [x, y, z], omit: BOT, grad: [0.84, 1.04], tri: stoneTri(w, h, d, sw, sh, sd, seed), fn })
}

// fileira de telhas: placa com a borda +z (morro abaixo) recortada em lóbulos arredondados, como as camadas das copas
function scallop(W, L, th, lw, amp) {
  const n = Math.max(1, Math.round(W / lw)), seg = n * 4
  const g = new THREE.BoxGeometry(W, th, L, seg, 1, 1), p = g.attributes.position
  const DISP = [-0.4, 0.55, 1.0, 0.55]
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) < L / 2 - 1e-4) continue
    const k = Math.round((p.getX(i) + W / 2) / (W / seg)) % 4
    p.setZ(i, p.getZ(i) + amp * DISP[k])
    if (k) p.setY(i, p.getY(i) - th * 0.22 * DISP[k])
  }
  g.computeVertexNormals()
  return g
}
// uma água do telhado (cumeeira em z = 0 / y = rise, beiral em z = run / y = 0), em fileiras de telhas escalonadas.
// widthAt(t): largura da fileira (t = 0 na cumeeira, 1 no beiral)
function slope(run, rise, color, seed, widthAt) {
  const Ls = Math.hypot(run, rise), phi = Math.atan2(rise, run), n = Math.max(3, Math.round(Ls / 0.78)), rl = Ls / n, th = 0.2
  const parts = [], lift = (i) => 0.1 + (n - 1 - i) * 0.07
  for (let i = 0; i < n; i++) {
    const sc = (i + 0.5) * rl, W = widthAt((i + 0.5) / n)
    if (W < 0.4) continue
    const L = rl + 0.26, tone = (i & 1 ? 0.97 : 1.03) * (0.96 + 0.08 * hash(i, seed, 3))
    const g = P(scallop(W, L, th, 0.72, 0.17), color, {
      omit: (nx, ny, nz) => ny < -0.5 || nz < -0.5,
      fn: (c, nx, ny, nz, lx, ly, lz) => {
        const t = Math.min(1, Math.max(0, (lz + L / 2) / L))
        c.multiplyScalar(tone * (ny > 0.4 ? 0.68 + 0.45 * t : 0.58)) // escuro sob a fileira de cima, claro na ponta
      },
    })
    parts.push(g.rotateX(phi).translate(0, rise - sc * Math.sin(phi) + lift(i), sc * Math.cos(phi)))
  }
  return { parts, top: rise + lift(0), n }
}

// peças repetidas (janelas, móveis) viram UMA geometria em cache; cada uso é só um clone com rotação/translação
const asmCache = new Map()
const assembly = (key, make) => { let g = asmCache.get(key); if (!g) asmCache.set(key, (g = merge(make()))); return g.clone() }

// ---------- janela no plano da parede (virada para +z, centro na origem) ----------
const windowParts = (o) => [assembly(`win:${o.arch}:${o.shut}:${o.flower}:${o.trim}:${o.wide}:${o.tall}:${o.flower ? o.seed % 3 : 0}`, () => windowGeo(o))]
function windowGeo({ arch, shut, flower, trim, seed, wide, tall }) {
  const fw = wide ? 2.1 : tall ? 1.15 : 1.0, fh = wide ? 1.5 : tall ? 2.0 : 1.15, ar = fw / 2, out = []
  out.push(P(rbx(fw + 0.3, fh + 0.3, 0.2, 0.07), trim, { p: [0, 0, 0.06], omit: BACK, lit: 0.1 }))
  out.push(P(bx(fw, fh, 0.06), GLASS, { p: [0, 0, 0.14], tip: GLASS_T, omit: BACK }))
  if (arch) out.push(P(halfDisc(ar + 0.15, 0.2), trim, { p: [0, fh / 2, 0.06] }), P(halfDisc(ar, 0.06), GLASS_T, { p: [0, fh / 2, 0.14] }))
  out.push(P(bx(0.13, fh * 0.5, 0.02), 0xffffff, { p: [-fw * 0.22, fh * 0.1, 0.18], r: [0, 0, -0.55] })) // reflexo
  out.push(P(bx(0.09, fh + (arch ? ar : 0), 0.06), trim, { p: [0, arch ? ar / 2 : 0, 0.19] }), P(bx(fw, 0.09, 0.06), trim, { p: [0, wide ? 0.25 : 0.04, 0.19] }))
  if (!tall) out.push(P(rbx(fw + 0.55, 0.16, 0.38, 0.05), trim, { p: [0, -fh / 2 - 0.2, 0.17] }))
  if (shut) for (const sd of [-1, 1]) out.push(P(rbx(0.48, fh + 0.3, 0.1, 0.03), shut, { p: [sd * (fw / 2 + 0.42), 0, 0.06], omit: BACK, tri: (c, cx) => c.multiplyScalar(Math.floor((cx + 2) * 9) & 1 ? 0.9 : 1.04) }))
  if (flower) {
    out.push(P(rbx(fw + 0.35, 0.34, 0.4, 0.05), WOOD, { p: [0, -fh / 2 - 0.47, 0.22], grad: [0.8, 1.05], omit: BACK }))
    const n = Math.max(3, Math.round(fw / 0.27))
    for (let i = 0; i < n; i++) {
      const x = -fw / 2 + 0.05 + ((i + 0.5) * (fw - 0.1)) / n
      out.push(P(sph(0.17, 6, 4), 0x2f9a40, { p: [x, -fh / 2 - 0.27, 0.22], s: [1, 0.7, 1], tip: 0x6fd060 }))
      if (i % 2 === 0) out.push(P(sph(0.11, 6, 4), FLOWERS[Math.floor(hash(i, seed, 5) * FLOWERS.length)], { p: [x, -fh / 2 - 0.12, 0.3] }))
    }
  }
  return out
}

// ---------- folha da porta: dobradiça em x = 0, abre girando em y ----------
function doorLeaf(arch, color) {
  const Wl = DOOR_W - 0.08, r = Wl / 2, hr = arch ? DOOR_H - 0.04 - r : DOOR_H - 0.04, th = 0.12, out = []
  for (let i = 0; i < 4; i++) out.push(P(bx(Wl / 4 - 0.025, hr, th), i & 1 ? color : tint(color, 0.86), { p: [Wl / 8 + (i * Wl) / 4, hr / 2, 0], grad: [0.82, 1.05] }))
  if (arch) out.push(P(halfDisc(r, th), tint(color, 0.93), { p: [r, hr, 0] }))
  for (const y of [0.45, hr - 0.35]) out.push(P(bx(Wl, 0.13, th + 0.05), METAL, { p: [Wl / 2, y, 0] }))
  out.push(P(cyl(0.18, 0.18, th + 0.03, 10).rotateX(Math.PI / 2), GLASS_T, { p: [Wl / 2, hr - 0.75, 0] }))
  for (const sz of [1, -1]) out.push(P(sph(0.08, 8, 6), GOLD, { p: [Wl - 0.24, 1.1, sz * 0.1] }))
  return merge(out)
}

// ---------------------------------------------------------------------------------
//  Móveis no tamanho do personagem (1,9 m e cabeça grande): mesa na cintura, cama maior que ele,
//  armário passando da cabeça. Cada móvel: { fw, fd, parts(), cols } com a frente em +z e a base em y = 0.
// ---------------------------------------------------------------------------------
const LEGS = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
const chairParts = (c) => [
  B(0.62, 0.12, 0.6, c, 0, 0.44, 0),
  ...LEGS.map(([a, b]) => Q(0.1, 0.44, 0.1, WOOD_D, a * 0.24, 0, b * 0.23)),
  B(0.62, 0.74, 0.12, c, 0, 0.56, -0.25),
  B(0.5, 0.08, 0.46, 0xe0503c, 0, 0.56, 0.03, { rr: 0.035 }),
]
const FRUIT = [0xe8453c, 0xffa020, 0x8fd040]
const FURN = {
  bed: (c) => ({ key: `bed${c}`, fw: 1.6, fd: 2.55, cols: [{ x: 0, z: 0, hw: 0.78, hd: 1.27, h: 0.9 }], parts: () => [
    B(1.5, 0.42, 2.4, WOOD, 0, 0, 0.05),
    B(1.34, 0.26, 2.2, WHITE, 0, 0.4, 0.1, { rr: 0.1 }),
    B(1.42, 0.2, 1.5, c, 0, 0.56, 0.45, { rr: 0.08 }),
    B(1.44, 0.22, 0.34, tint(c, 1.35), 0, 0.56, -0.38, { rr: 0.09 }),
    B(0.95, 0.24, 0.52, 0xffffff, 0, 0.64, -0.8, { rr: 0.11 }),
    B(1.62, 1.25, 0.2, WOOD_D, 0, 0, -1.17),
    P(halfDisc(0.62, 0.2), WOOD_D, { p: [0, 1.25, -1.17] }),
    ...[-1, 1].flatMap((sx) => [B(0.2, 0.85, 0.2, WOOD_D, sx * 0.72, 0, 1.17), P(sph(0.14, 8, 6), WOOD_L, { p: [sx * 0.72, 0.92, 1.17] })]),
  ] }),
  table: () => ({ key: 'table', fw: 3.0, fd: 1.1, cols: [{ x: 0, z: 0, hw: 0.8, hd: 0.5, h: 0.95 }, { x: -1.2, z: 0, hw: 0.3, hd: 0.3, h: 0.6 }, { x: 1.2, z: 0, hw: 0.3, hd: 0.3, h: 0.6 }], parts: () => [
    B(1.6, 0.14, 1.0, WOOD_L, 0, 0.78, 0),
    ...LEGS.map(([a, b]) => Q(0.16, 0.78, 0.16, WOOD_D, a * 0.66, 0, b * 0.36)),
    P(cyl(0.11, 0.08, 0.3, 8), 0x4a8fe8, { p: [0.25, 1.07, -0.1], grad: [0.8, 1.1] }),
    ...[0, 1, 2].map((i) => P(sph(0.1, 6, 4), FLOWERS[i], { p: [0.25 + (i - 1) * 0.09, 1.28 + (i & 1) * 0.06, -0.1] })),
    P(cyl(0.2, 0.18, 0.04, 12), 0xffffff, { p: [-0.42, 0.94, 0.15] }), P(sph(0.13, 8, 5), 0xd99040, { p: [-0.42, 0.99, 0.15], s: [1.3, 0.55, 0.8] }),
    ...chairParts(WOOD).map((g) => g.rotateY(Math.PI / 2).translate(-1.2, 0, 0)),
    ...chairParts(WOOD).map((g) => g.rotateY(-Math.PI / 2).translate(1.2, 0, 0)),
  ] }),
  fireplace: (ceil) => ({ key: `fire${ceil.toFixed(2)}`, fw: 2.35, fd: 1.15, cols: [{ x: 0, z: -0.05, hw: 1.15, hd: 0.55, h: 1.5 }], parts: () => [
    B(2.3, 0.12, 1.15, 0x9aa0ab, 0, 0, 0.0),
    B(0.5, 1.35, 0.9, STONE_F, -0.8, 0, -0.12), B(0.5, 1.35, 0.9, STONE_F, 0.8, 0, -0.12),
    B(2.1, 0.42, 0.95, STONE_F, 0, 1.0, -0.12),
    Q(1.1, 1.0, 0.3, 0x2a1d18, 0, 0, -0.4),
    P(cyl(0.11, 0.11, 0.85, 6).rotateZ(Math.PI / 2), WOOD_D, { p: [0, 0.24, -0.15], r: [0, 0.3, 0] }),
    P(cyl(0.11, 0.11, 0.85, 6).rotateZ(Math.PI / 2), WOOD, { p: [0, 0.24, -0.02], r: [0, -0.3, 0] }),
    P(cone(0.3, 0.8, 6), 0xff6a1a, { p: [0, 0.68, -0.1], tip: 0xffd23a }),
    P(cone(0.17, 0.5, 5), 0xffe27a, { p: [0.18, 0.55, -0.02], tip: 0xfff6c0 }),
    B(2.35, 0.14, 1.12, WOOD, 0, 1.42, -0.06),
    B(1.5, Math.max(0.3, ceil - 1.56), 0.62, STONE_F, 0, 1.56, -0.26),
    P(cyl(0.1, 0.12, 0.3, 8), 0x4a8fe8, { p: [-0.7, 1.71, 0] }), P(cyl(0.05, 0.05, 0.3, 6), 0xfff2c0, { p: [0.65, 1.71, 0] }),
  ] }),
  stove: (ceil) => ({ key: `stove${ceil.toFixed(2)}`, fw: 1.15, fd: 0.9, cols: [{ x: 0, z: 0, hw: 0.56, hd: 0.44, h: 1.05 }], parts: () => [
    B(1.1, 0.95, 0.85, 0x3a4152), Q(1.16, 0.06, 0.9, 0x23272f, 0, 0.95, 0),
    B(0.7, 0.42, 0.05, 0x5a6476, 0, 0.22, 0.43, { rr: 0.02 }), Q(0.5, 0.05, 0.04, GOLD, 0, 0.6, 0.45),
    P(cyl(0.22, 0.2, 0.3, 10), 0xd04a3a, { p: [-0.22, 1.16, 0.05] }), P(sph(0.16, 8, 6), 0xb8c0cc, { p: [0.25, 1.12, 0.1], s: [1, 0.8, 1] }),
    P(cyl(0.1, 0.1, Math.max(0.3, ceil - 1.0), 8), 0x2c3140, { p: [0.3, 1.0 + Math.max(0.3, ceil - 1.0) / 2, -0.25] }),
  ] }),
  counter: () => ({ key: 'counter', fw: 2.4, fd: 0.88, cols: [{ x: 0, z: 0, hw: 1.2, hd: 0.44, h: 1.05 }], parts: () => [
    B(2.3, 0.92, 0.8, 0xf3ebd8), B(2.4, 0.1, 0.88, WOOD_L, 0, 0.92, 0),
    ...[-0.75, 0, 0.75].map((x) => B(0.66, 0.62, 0.04, 0xe2d6bc, x, 0.15, 0.41, { rr: 0.015 })),
    ...[-0.75, 0, 0.75].map((x) => P(sph(0.045, 6, 4), GOLD, { p: [x + 0.22, 0.68, 0.45] })),
    ...[0, 1, 2].map((i) => P(cyl(0.11, 0.11, 0.3, 8), CLOTH[i + 1], { p: [-0.85 + i * 0.25, 1.17, -0.18] })),
    B(0.6, 0.05, 0.4, WOOD, 0.1, 1.02, 0.05, { rr: 0.02 }),
    P(cyl(0.24, 0.16, 0.16, 10), 0xffffff, { p: [0.75, 1.1, 0] }),
    ...[0, 1, 2].map((i) => P(sph(0.1, 6, 5), FRUIT[i], { p: [0.7 + (i - 1) * 0.1, 1.22, (i & 1) * 0.08] })),
  ] }),
  dresser: () => ({ key: 'dresser', fw: 1.6, fd: 0.7, cols: [{ x: 0, z: 0, hw: 0.78, hd: 0.34, h: 1.3 }], parts: () => [
    B(1.5, 1.15, 0.62, WOOD), B(1.6, 0.1, 0.7, WOOD_L, 0, 1.15, 0),
    ...[0.4, 0.78].map((y) => Q(1.32, 0.04, 0.02, WOOD_D, 0, y, 0.32)),
    ...[-0.4, 0.4].flatMap((x) => [0.22, 0.6, 0.97].map((y) => P(sph(0.045, 6, 4), GOLD, { p: [x, y, 0.33] }))),
    ...[-0.45, 0, 0.45].map((x, i) => P(cyl(0.22, 0.22, 0.04, 12).rotateX(Math.PI / 2 - 0.15), [0xffffff, 0x9cc8f0, 0xffffff][i], { p: [x, 1.48, -0.12] })),
  ] }),
  wardrobe: () => ({ key: 'wardrobe', fw: 1.7, fd: 0.85, cols: [{ x: 0, z: 0, hw: 0.82, hd: 0.4 }], parts: () => [
    B(1.6, 2.3, 0.75, WOOD_D), ...[-0.39, 0.39].map((x) => B(0.72, 1.95, 0.06, WOOD, x, 0.18, 0.38, { rr: 0.025 })),
    ...[-0.08, 0.08].map((x) => P(sph(0.05, 6, 4), GOLD, { p: [x, 1.2, 0.43] })),
    B(1.75, 0.16, 0.86, WOOD_L, 0, 2.3, 0),
  ] }),
  bookshelf: (sd) => ({ key: `shelf${sd % 4}`, key: `books${sd % 4}`, fw: 1.6, fd: 0.6, cols: [{ x: 0, z: 0, hw: 0.8, hd: 0.28 }], parts: () => {
    const out = [Q(1.6, 2.25, 0.06, WOOD_D, 0, 0, -0.25), ...[-0.74, 0.74].map((x) => B(0.12, 2.25, 0.55, WOOD, x, 0, 0)), ...[0, 0.55, 1.1, 1.65, 2.15].map((y) => B(1.6, 0.08, 0.55, WOOD, 0, y, 0))]
    for (let r = 0; r < 4; r++) for (let x = -0.66, i = 0; ; i++) {
      const bw = 0.1 + 0.08 * hash(r, i, sd % 4), bh = 0.3 + 0.13 * hash(i, r, sd % 4 + 1)
      if (x + bw > 0.67) break
      out.push(Q(bw - 0.015, bh, 0.36, CLOTH[Math.floor(hash(r * 7, i * 13, sd % 4 + 2) * CLOTH.length)], x + bw / 2, r * 0.55 + 0.08, 0.02, { omit: (nx, ny, nz) => ny < -0.5 || nz < -0.5 }))
      x += bw
    }
    return out
  } }),
  barrel: () => ({ key: 'barrel', fw: 0.95, fd: 0.95, cols: [{ x: 0, z: 0, hw: 0.45, hd: 0.45, h: 1.05 }], parts: () => [
    P(cyl(0.45, 0.4, 1.0, 10), WOOD, { p: [0, 0.5, 0], grad: [0.75, 1.05], omit: BOT }),
    ...[0.22, 0.8].map((y) => P(cyl(0.465, 0.455, 0.07, 10, true), METAL, { p: [0, y, 0] })),
    P(cyl(0.42, 0.42, 0.02, 10), WOOD_L, { p: [0, 1.0, 0] }),
  ] }),
  crates: (two) => ({ key: `crates${two}`, fw: 0.9, fd: 0.9, cols: [{ x: 0, z: 0, hw: 0.43, hd: 0.43, h: two ? 1.45 : 0.85 }], parts: () => {
    const out = [B(0.84, 0.84, 0.84, 0xd09a58, 0, 0, 0), Q(0.87, 0.12, 0.87, 0xa8723a, 0, 0.04, 0), Q(0.87, 0.12, 0.87, 0xa8723a, 0, 0.68, 0)]
    if (two) out.push(B(0.6, 0.6, 0.6, 0xc48c4a, 0.05, 0.84, -0.02, { r: [0, 0.4, 0] }), Q(0.62, 0.1, 0.62, 0xa8723a, 0.05, 1.3, -0.02, { r: [0, 0.4, 0] }))
    return out
  } }),
  plant: () => ({ key: 'plant', fw: 0.8, fd: 0.8, cols: [{ x: 0, z: 0, hw: 0.32, hd: 0.32, h: 1.3 }], parts: () => [
    P(cyl(0.3, 0.23, 0.5, 8), 0xc8603a, { p: [0, 0.25, 0], grad: [0.8, 1.05], omit: BOT }), P(cyl(0.34, 0.34, 0.08, 8), 0xe07a4a, { p: [0, 0.5, 0] }),
    bush(0.85, 0, 0.5, 0),
  ] }),
  clock: () => ({ key: 'clock', fw: 0.75, fd: 0.55, cols: [{ x: 0, z: 0, hw: 0.33, hd: 0.23 }], parts: () => [
    B(0.66, 2.1, 0.46, WOOD_D), B(0.76, 0.14, 0.52, WOOD_L, 0, 2.1, 0),
    P(cyl(0.24, 0.24, 0.05, 14).rotateX(Math.PI / 2), WHITE, { p: [0, 1.68, 0.24] }),
    Q(0.03, 0.17, 0.02, METAL, 0, 1.68, 0.27), Q(0.12, 0.03, 0.02, METAL, 0.05, 1.67, 0.27),
    Q(0.34, 0.8, 0.02, 0x2a2420, 0, 0.45, 0.235), P(cyl(0.1, 0.1, 0.03, 10).rotateX(Math.PI / 2), GOLD, { p: [0, 0.65, 0.25] }),
  ] }),
  sofa: (c) => ({ key: `sofa${c}`, fw: 2.2, fd: 1.0, cols: [{ x: 0, z: 0, hw: 1.07, hd: 0.47, h: 0.8 }], parts: () => [
    B(2.1, 0.42, 0.92, c, 0, 0, 0), B(2.1, 0.66, 0.28, c, 0, 0.4, -0.33), ...[-1, 1].map((s) => B(0.3, 0.62, 0.92, tint(c, 0.88), s * 0.92, 0, 0)),
    ...[-1, 1].map((s) => B(0.78, 0.17, 0.62, tint(c, 1.18), s * 0.4, 0.42, 0.08, { rr: 0.07 })),
    P(sph(0.2, 8, 6), 0xffe27a, { p: [-0.55, 0.78, -0.12], s: [1, 1, 0.6] }),
  ] }),
  desk: () => ({ key: 'desk', fw: 1.45, fd: 1.45, cols: [{ x: 0, z: -0.37, hw: 0.7, hd: 0.36, h: 0.95 }, { x: 0, z: 0.38, hw: 0.3, hd: 0.3, h: 0.6 }], parts: () => [
    B(1.4, 0.1, 0.72, WOOD_L, 0, 0.78, -0.37), B(0.5, 0.78, 0.66, WOOD, 0.42, 0, -0.37), ...[-0.68, -0.06].map((z) => Q(0.1, 0.78, 0.1, WOOD_D, -0.62, 0, z)),
    ...[0, 1, 2].map((i) => B(0.42, 0.08, 0.3, CLOTH[i], -0.35, 0.88 + i * 0.08, -0.45, { rr: 0.02, r: [0, i * 0.2, 0] })),
    P(cyl(0.06, 0.1, 0.4, 8), METAL, { p: [0.4, 1.08, -0.5] }), P(cone(0.2, 0.22, 8), 0xffd86a, { p: [0.4, 1.3, -0.5] }),
    ...chairParts(WOOD).map((g) => g.rotateY(Math.PI).translate(0, 0, 0.38)),
  ] }),
  chest: () => ({ key: 'chest', fw: 1.15, fd: 0.75, cols: [{ x: 0, z: 0, hw: 0.55, hd: 0.33, h: 0.9 }], parts: () => [
    B(1.05, 0.55, 0.62, WOOD), P(halfCylX(0.31, 1.05), WOOD_L, { p: [0, 0.55, 0] }),
    ...[-0.32, 0.32].map((x) => Q(0.1, 0.62, 0.66, METAL, x, 0, 0)), Q(0.16, 0.2, 0.05, GOLD, 0, 0.4, 0.32),
  ] }),
  shelf: (sd) => ({ key: `shelf${sd % 4}`, fw: 2.4, fd: 0.62, cols: [{ x: 0, z: 0, hw: 1.2, hd: 0.3 }], parts: () => {
    const out = [Q(2.4, 2.25, 0.06, WOOD_D, 0, 0, -0.27), ...[-1.14, 1.14].map((x) => B(0.12, 2.25, 0.6, WOOD, x, 0, 0)), ...[0, 0.6, 1.2, 1.8, 2.2].map((y) => B(2.4, 0.08, 0.6, WOOD, 0, y, 0))]
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
      const x = -0.9 + i * 0.36, k = Math.floor(hash(r, i, sd % 4) * 4), c = CLOTH[Math.floor(hash(i, r, sd % 4 + 3) * CLOTH.length)], y = r * 0.6 + 0.68
      if (k === 0) out.push(P(cyl(0.13, 0.13, 0.32, 8), c, { p: [x, y + 0.16, 0], tip: 0xffffff }), P(cyl(0.14, 0.14, 0.06, 8), WOOD_L, { p: [x, y + 0.35, 0] }))
      else if (k === 1) out.push(P(cyl(0.07, 0.11, 0.3, 8), c, { p: [x, y + 0.15, 0] }), P(sph(0.07, 6, 4), c, { p: [x, y + 0.33, 0] }))
      else if (k === 2) out.push(B(0.3, 0.26, 0.34, c, x, y, 0, { rr: 0.04 }))
      else out.push(P(sph(0.14, 7, 5), FRUIT[i % 3], { p: [x - 0.07, y + 0.13, 0] }), P(sph(0.14, 7, 5), FRUIT[(i + 1) % 3], { p: [x + 0.08, y + 0.13, 0.05] }))
    }
    return out
  } }),
  shopCounter: () => ({ key: 'shopCounter', fw: 2.9, fd: 1.05, cols: [{ x: 0, z: 0, hw: 1.42, hd: 0.5, h: 1.15 }], parts: () => [
    B(2.8, 1.02, 0.95, WOOD), B(2.5, 0.68, 0.05, WOOD_L, 0, 0.17, 0.47, { rr: 0.02 }), B(2.95, 0.1, 1.05, WOOD_L, 0, 1.02, 0),
    B(0.52, 0.32, 0.42, 0x3a4152, 0.75, 1.12, -0.1), B(0.4, 0.08, 0.06, 0xf6f0e0, 0.75, 1.44, -0.25, { rr: 0.02 }),
    P(cyl(0.3, 0.22, 0.2, 8), 0xc99250, { p: [-0.6, 1.22, 0.1] }),
    ...[0, 1, 2, 3].map((i) => P(sph(0.11, 6, 5), FRUIT[i % 3], { p: [-0.6 + ((i % 2) - 0.5) * 0.18, 1.36, 0.02 + (i >> 1) * 0.16] })),
    P(sph(0.09, 8, 6), GOLD, { p: [0.15, 1.17, 0.25], s: [1, 0.8, 1] }),
  ] }),
  display: () => ({ key: 'display', fw: 1.8, fd: 1.2, cols: [{ x: 0, z: 0, hw: 0.88, hd: 0.58, h: 1.05 }], parts: () => [
    B(1.7, 0.78, 1.1, WOOD), B(1.8, 0.08, 1.2, WOOD_L, 0, 0.78, 0),
    ...[0, 1, 2, 3, 4, 5].map((i) => P(sph(0.2, 8, 6), [0xff9a2a, 0x7fd04a, 0xffd23a][i % 3], { p: [-0.55 + (i % 3) * 0.55, 1.0, i < 3 ? -0.25 : 0.25], s: [1, 0.75, 1], lit: 0.2 })),
  ] }),
  sacks: () => ({ key: 'sacks', fw: 1.3, fd: 0.8, cols: [{ x: 0, z: 0, hw: 0.62, hd: 0.37, h: 0.85 }], parts: () => [-0.3, 0.32].flatMap((x, i) => [
    P(sph(0.38, 8, 6), 0xe6d0a0, { p: [x, 0.36, 0], s: [1, 1.1 - i * 0.15, 0.9], grad: [0.8, 1.05] }), P(cyl(0.1, 0.16, 0.16, 7), 0xd8bf8a, { p: [x, 0.8 - i * 0.06, 0] }),
  ]) }),
  rug: (c, rw, rd) => ({ key: `rug${c}:${rw}:${rd}`, fw: rw, fd: rd, cols: [], parts: () => [1, 0.74, 0.46].map((k, i) => P(cyl(0.5, 0.5, 0.03 + i * 0.004, 20), i === 1 ? tint(c, 1.4) : c, { p: [0, 0.016 + i * 0.002, 0], s: [rw * k, 1, rd * k] })) }),
}

const cache = new Map()
export function GetProto(id, vi) {
  const spec = SPECS[id], n = spec.vars.length, key = `${id}:${vi % n}`
  if (!cache.has(key)) cache.set(key, build(id, spec, spec.vars[vi % n], vi % n))
  return cache.get(key)
}
export const VariantCount = (id) => SPECS[id].vars.length

function build(id, s, vr, vi) {
  const { w, d } = s, F = s.floors, H = wallHeight(s), dx = s.doorX || 0
  const stone = s.kind === 'stone', city = s.kind === 'city', arch = stone, shop = s.interior === 'shop'
  const seed = Math.floor(hash(w * 10, d * 10, id.length * 7 + vi * 13 + 5) * 1e6)
  const ix = w / 2 - T, iz = d / 2 - T // meia-extensão do interior
  const zf = d / 2 - T / 2, zb = -d / 2 + T / 2, x0 = -w / 2, x1 = w / 2
  const dl = dx - DOOR_W / 2, dr = dx + DOOR_W / 2
  const common = [], roof = [], dark = [], doorStub = []
  const shell = [], cutw = [], inside = [], ext = []
  for (let k = 0; k < F; k++) { shell.push([]); cutw.push([]); inside.push([]); ext.push([]) }
  const cols = []
  const windows = [] // janelas do térreo (entradas de zumbi): { x, z (centro na parede), nx, nz (para fora), w (largura), y (centro) }
  const spots = [] // móveis (para saque): { x, z (centro), fx, fz (frente), y, k (andar), key, room, r } em coordenadas da casa
  const top = (k) => (k === F - 1 ? H : (k + 1) * FLOOR_H)
  const trim = stone ? 0xfff4dc : vr.trim
  const beam = stone ? tint(vr.wall, 1.12) : city ? vr.trim : WOOD_D

  // ---------- escadas (encostadas na parede do fundo) ----------
  const ramps = []
  if (F > 1) ramps.push({ x0: -ix, x1: -ix + RUN, z0: -iz, z1: -iz + STW, y0: FLOOR0, y1: FLOOR_H })
  if (F > 2) ramps.push({ x0: ix - RUN, x1: ix, z0: -iz, z1: -iz + STW, y0: FLOOR_H, y1: 2 * FLOOR_H })
  for (const r of ramps) {
    const zc = (r.z0 + r.z1) / 2
    r.bot = r.x0 <= -ix + 1e-3 ? [r.x0 + 0.6, r.z1 + 0.8] : [r.x0 - 0.8, zc] // onde se entra embaixo
    r.bin = [r.x0 + 0.6, zc]
    r.top = r.x1 >= ix - 1e-3 ? [r.x1 - 0.5, r.z1 + 0.9] : [r.x1 + 0.8, zc] // onde se sai em cima
    r.tin = [r.x1 - 0.5, zc]
  }

  // ---------- paredes ----------
  function piece(list, bw, bh, bd, x, z, y0, cut) {
    const y = y0 + bh / 2, fn = cut ? (c, nx, ny) => { if (ny > 0.5) c.multiplyScalar(1.22) } : null
    if (stone) list.push(stoneBox(bw, bh, bd, x, y, z, vr.wall, seed, fn))
    else list.push(P(bx(bw, bh, bd), vr.wall, { p: [x, y, z], omit: BOT, grad: [0.86, 1.03], fn }))
  }
  function walls(list, ya, yb, k, cut) {
    const h = yb - ya
    piece(list, w, h, T, 0, zb, ya, cut)
    piece(list, T, h, d - 2 * T, x0 + T / 2, 0, ya, cut)
    piece(list, T, h, d - 2 * T, x1 - T / 2, 0, ya, cut)
    if (k > 0) return piece(list, w, h, T, 0, zf, ya, cut)
    piece(list, dl - x0, h, T, (x0 + dl) / 2, zf, ya, cut)
    piece(list, x1 - dr, h, T, (dr + x1) / 2, zf, ya, cut)
    if (yb > DOOR_H + 0.05) piece(list, DOOR_W, yb - DOOR_H, T, dx, zf, DOOR_H, cut)
  }
  for (let k = 0; k < F; k++) { walls(shell[k], k * FLOOR_H, top(k), k, false); walls(cutw[k], k * FLOOR_H, k * FLOOR_H + CUT_H, k, true) }
  cols.push({ x: 0, z: zb, hw: w / 2, hd: T / 2 }, { x: x0 + T / 2, z: 0, hw: T / 2, hd: (d - 2 * T) / 2 }, { x: x1 - T / 2, z: 0, hw: T / 2, hd: (d - 2 * T) / 2 },
    { x: (x0 + dl) / 2, z: zf, hw: (dl - x0) / 2, hd: T / 2 }, { x: (dr + x1) / 2, z: zf, hw: (x1 - dr) / 2, hd: T / 2 })
  for (let k = 1; k < F; k++) cols.push({ x: dx, z: zf, hw: DOOR_W / 2, hd: T / 2, lv: k }) // lá em cima a frente é parede inteira

  // cunhais (pedra) / esteios (reboco, cidade) e cinta entre andares
  for (let k = 0; k < F; k++) {
    const ya = k * FLOOR_H, yb = top(k), L = shell[k]
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (stone) {
        let i = k * 7 + (sx > 0 ? 1 : 0)
        for (let y = ya; y < yb - 0.1; y += 0.5, i++) {
          const hh = Math.min(0.46, yb - y - 0.04), a = i & 1 ? 0.85 : 0.55, b = i & 1 ? 0.55 : 0.85
          L.push(P(bx(a, hh - 0.04, b), tint(vr.wall, i & 1 ? 1.12 : 1.03), { p: [sx * (w / 2 + 0.06 - a / 2), y + hh / 2 + 0.02, sz * (d / 2 + 0.06 - b / 2)], omit: BOT, lit: 0.1, grad: [0.9, 1.06] }))
        }
      } else L.push(P(rbx(0.42, yb - ya, 0.42, 0.06), beam, { p: [sx * (w / 2 - 0.15), (ya + yb) / 2, sz * (d / 2 - 0.15)], omit: BOT, grad: [0.85, 1.05] }))
    }
    if (k > 0) for (const [bw, bd, px, pz] of [[w + 0.16, 0.18, 0, d / 2], [w + 0.16, 0.18, 0, -d / 2], [0.18, d, x0, 0], [0.18, d, x1, 0]])
      L.push(P(rbx(bw, 0.26, bd, 0.05), beam, { p: [px, ya, pz], omit: BOT }))
  }

  // rodapé de pedra (sempre visível, também no recorte)
  const plinthC = stone ? tint(vr.wall, 0.78) : 0xaeb2bd
  const pg = arch ? 0.55 : 0.3
  for (const [bw, px, pz, hd] of [[w + 0.28, 0, -d / 2, 0.14], [dl - pg - (x0 - 0.14), (x0 - 0.14 + dl - pg) / 2, d / 2, 0.14], [x1 + 0.14 - (dr + pg), (dr + pg + x1 + 0.14) / 2, d / 2, 0.14]])
    common.push(stoneBox(bw, 0.55, hd, px, 0.275, pz + Math.sign(pz) * 0.07, plinthC, seed + 3, null, 0.7))
  for (const sx of [-1, 1]) common.push(stoneBox(0.14, 0.55, d, sx * (w / 2 + 0.07), 0.275, 0, plinthC, seed + 4, null, 0.7))

  // ---------- fachada: janelas por andar e por face ----------
  const FACE = { f: (u) => [0, u, d / 2], b: (u) => [Math.PI, -u, -d / 2], l: (u) => [-Math.PI / 2, -w / 2, u], r: (u) => [Math.PI / 2, w / 2, -u] }
  const onFace = (list, parts, face, u, y) => { const [a, px, pz] = FACE[face](u); for (const g of parts) list.push(g.rotateY(a).translate(px, y, pz)) }
  const win = (k, face, u, y, o = {}) => {
    onFace(shell[k], windowParts({ arch, shut: s.shutters ? vr.acc : null, trim, seed: Math.floor(hash(k, u * 10, seed) * 3), ...o }), face, u, y)
    if (k === 0) { const [a, px, pz] = FACE[face](u); windows.push({ x: px, z: pz, nx: Math.round(Math.sin(a)), nz: Math.round(Math.cos(a)), w: o.wide ? 2.1 : o.tall ? 1.15 : 1.0, y }) }
  }
  const xsUp = w >= 8.5 ? [-w / 2 + 1.7, 0, w / 2 - 1.7] : [-w / 4 - 0.2, w / 4 + 0.2]
  for (let k = 0; k < F; k++) {
    const yc = k * FLOOR_H + 1.65, fl = k <= 1 && !city
    if (k === 0) {
      if (shop) for (const u of [(x0 + dl) / 2, (dr + x1) / 2]) win(0, 'f', u, 1.45, { wide: true, arch: false, shut: null })
      else for (const x of [x0 + 1.55, x1 - 1.55]) if (Math.abs(x - dx) > 1.95) win(0, 'f', x, yc, { flower: fl })
    } else if (!s.galeria) {
      const bal = s.balcony && k === 1
      if (bal) win(1, 'f', 0, FLOOR_H + 1.18, { tall: true, flower: false, shut: null }) // porta-janela da sacada
      for (const x of xsUp) if (!bal || Math.abs(x) > 1.9) win(k, 'f', x, yc, { flower: fl || (city && k > 0 && !(s.sign && k === 1)) })
    }
    for (const x of xsUp) win(k, 'b', x, yc)
    win(k, 'l', 0, yc, { flower: fl }); win(k, 'r', 0, yc, { flower: fl })
  }

  // ---------- porta: arco de pedra ou batentes de madeira, degrau, lampião ----------
  const S0 = shell[0]
  if (arch) {
    const r0 = DOOR_W / 2, cy = DOOR_H - r0, c = tint(vr.wall, 1.15), n = 7
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * (i + 0.5)) / n, rm = r0 + 0.21, big = i === 3
      S0.push(P(rbx(big ? 0.5 : 0.44, big ? 0.5 : 0.42, T + 0.16, 0.06), i & 1 ? c : tint(c, 0.9), { p: [dx + Math.cos(a) * rm, cy + Math.sin(a) * rm, zf + 0.03], r: [0, 0, a - Math.PI / 2], lit: 0.12 }))
    }
    for (const sx of [-1, 1]) for (let j = 0; j < 3; j++) {
      const bh = cy / 3 - 0.03, bw = j & 1 ? 0.5 : 0.4
      S0.push(P(rbx(bw, bh, T + 0.16, 0.05), j & 1 ? tint(c, 0.9) : c, { p: [dx + sx * (r0 + bw / 2 - 0.02), (j + 0.5) * (cy / 3), zf + 0.03], omit: BOT }))
    }
  } else {
    for (const sx of [-1, 1]) S0.push(P(rbx(0.3, DOOR_H, T + 0.14, 0.05), WOOD_D, { p: [dx + sx * (DOOR_W / 2 + 0.11), DOOR_H / 2, zf + 0.03], omit: BOT }))
    S0.push(P(rbx(DOOR_W + 0.7, 0.36, T + 0.18, 0.06), WOOD_D, { p: [dx, DOOR_H + 0.17, zf + 0.04] }))
    if (!city) { // telhadinho sobre a porta
      const cw = DOOR_W + 1.1
      S0.push(P(scallop(cw, 1.05, 0.14, 0.5, 0.12), vr.roof, { omit: BOT, fn: (c, nx, ny) => c.multiplyScalar(ny > 0.4 ? 1 : 0.6) }).rotateX(0.5).translate(dx, DOOR_H + 0.62, d / 2 + 0.5))
      for (const sx of [-1, 1]) S0.push(P(bx(0.12, 0.12, 0.8), WOOD_D, { p: [dx + sx * (cw / 2 - 0.25), DOOR_H + 0.35, d / 2 + 0.3], r: [-0.65, 0, 0] }))
    }
  }
  for (const sx of [-1, 1]) doorStub.push(P(bx(0.3, CUT_H, T + 0.12), arch ? tint(vr.wall, 1.15) : WOOD_D, { p: [dx + sx * (DOOR_W / 2 + 0.12), CUT_H / 2, zf + 0.02], omit: BOT }))
  const lx = arch ? dr + 0.8 : dr + 0.6
  if (lx < x1 - 0.4 && !shop) S0.push(Q(0.09, 0.09, 0.42, METAL, lx, 2.25, d / 2 + 0.2), P(rbx(0.28, 0.36, 0.28, 0.05), 0xfff0a8, { p: [lx, 2.08, d / 2 + 0.38], lit: 0.3 }), P(cone(0.24, 0.2, 4).rotateY(Math.PI / 4), METAL, { p: [lx, 2.36, d / 2 + 0.38] }))
  common.push(B(DOOR_W + 0.8, 0.14, 0.8, 0xc9c8c0, dx, 0, d / 2 + 0.38, { rr: 0.05 }), Q(DOOR_W, FLOOR0 + 0.02, T + 0.02, 0xc9c8c0, dx, 0, zf))
  // arbustos / vasos junto da porta
  for (const sx of [-1, 1]) {
    const bxp = dx + sx * (DOOR_W / 2 + (arch ? 1.25 : 1.0))
    if (Math.abs(bxp) > w / 2 - 0.4) continue
    if (city) common.push(P(cyl(0.3, 0.23, 0.55, 8), 0xc8603a, { p: [bxp, 0.275, d / 2 + 0.45], omit: BOT }), bush(0.75, bxp, 0.55, d / 2 + 0.45))
    else common.push(bush(0.95, bxp, 0, d / 2 + 0.62))
  }

  // ---------- extras ----------
  if (s.balcony && F > 1) {
    const by = FLOOR_H, bw = 2.5, bz = d / 2 + 0.55, L = ext[1]
    L.push(B(bw, 0.18, 1.1, WOOD, 0, by - 0.18, bz), B(bw + 0.12, 0.12, 0.14, WOOD_L, 0, by + 0.88, bz + 0.5))
    for (const sx of [-1, 1]) L.push(B(0.14, 0.12, 1.1, WOOD_L, sx * bw / 2, by + 0.88, bz), Q(0.14, 0.7, 0.14, WOOD_D, sx * (bw / 2 - 0.3), by - 0.85, d / 2 + 0.25, { r: [0.6, 0, 0] }))
    const nb = Math.round(bw / 0.3)
    for (let i = 0; i <= nb; i++) L.push(Q(0.08, 0.88, 0.08, WOOD, -bw / 2 + (bw * i) / nb, by, bz + 0.5))
    for (const sx of [-1, 1]) for (const z of [-0.25, 0.15]) L.push(Q(0.08, 0.88, 0.08, WOOD, sx * bw / 2, by, bz + z))
    for (const sx of [-1, 1]) L.push(P(cyl(0.2, 0.15, 0.32, 8), 0xc8603a, { p: [sx * 0.8, by + 0.16, bz + 0.15] }), P(sph(0.12, 6, 4), FLOWERS[(vi + sx + 2) % 5], { p: [sx * 0.8, by + 0.42, bz + 0.15] }), bush(0.45, sx * 0.8, by + 0.3, bz + 0.15))
  }
  if (s.galeria) for (let k = 1; k < F; k++) {
    const gw = w - 1.4, gz = d / 2 + 0.33, ya = k * FLOOR_H + 0.15, yb = (k === F - 1 ? H : (k + 1) * FLOOR_H) - 0.1, gh = yb - ya, L = shell[k]
    L.push(B(gw, 0.85, 0.66, vr.acc, 0, ya, gz), P(bx(gw, gh - 0.85, 0.6), 0x9fd8f2, { p: [0, (ya + 0.85 + yb) / 2, gz], omit: BACK, tip: 0xdaf3ff, lit: 0.15 }))
    for (let i = 0; i <= 7; i++) L.push(P(rbx(0.12, gh, 0.72, 0.03), trim, { p: [-gw / 2 + (gw * i) / 7, ya + gh / 2, gz + 0.02], omit: BACK }))
    for (const y of [ya, ya + 0.85, yb]) L.push(P(rbx(gw + 0.25, 0.14, 0.8, 0.04), trim, { p: [0, y, gz] }))
  }
  if (s.awning) {
    const aw = w - 1.0, L = 1.6, a = 0.45
    S0.push(P(scallop(aw, L, 0.1, 0.55, 0.14), vr.acc, { lit: 0.15, fn: (c, nx, ny, nz, lx2) => { if ((Math.floor((lx2 + aw / 2) / (aw / Math.round(aw / 0.55))) & 1)) c.setRGB(0.95, 0.94, 0.9); if (ny < 0.3) c.multiplyScalar(0.62) } })
      .rotateX(a).translate(0, 3.05 - (L / 2) * Math.sin(a), d / 2 + (L / 2) * Math.cos(a) + 0.03))
    for (const sx of [-1, 1]) S0.push(rod([sx * (aw / 2 - 0.3), 2.5, d / 2], [sx * (aw / 2 - 0.3), 3.05 - L * Math.sin(a) + 0.05, d / 2 + L * Math.cos(a) - 0.05], 0.04, METAL))
  }
  if (s.sign) {
    const L = F > 1 ? shell[1] : roof, sy = F > 1 ? 3.45 : H + 0.75, sw = Math.min(w - 2.4, 5.2), sz = d / 2 + 0.12
    L.push(B(sw, 0.8, 0.18, vr.acc, 0, sy - 0.4, sz), B(sw + 0.2, 0.1, 0.24, trim, 0, sy + 0.38, sz), B(sw + 0.2, 0.1, 0.24, trim, 0, sy - 0.46, sz))
    L.push(P(cyl(0.3, 0.3, 0.05, 14).rotateX(Math.PI / 2), WHITE, { p: [-sw / 2 + 0.45, sy, sz + 0.1] }), P(sph(0.17, 8, 6), FRUIT[vi % 3], { p: [-sw / 2 + 0.45, sy - 0.02, sz + 0.16], lit: 0.2 }), Q(0.05, 0.12, 0.05, 0x3f8f2a, -sw / 2 + 0.47, sy + 0.12, sz + 0.16))
    for (let i = 0; i < 4; i++) L.push(B(0.38 + 0.2 * hash(i, vi, 9), 0.22, 0.05, WHITE, -sw / 2 + 1.1 + i * 0.68, sy - 0.11, sz + 0.1, { rr: 0.03 }))
    if (shop && !s.awning) { // placa redonda pendurada junto da porta
      const hx = Math.min(dr + 0.95, x1 - 0.5)
      S0.push(Q(0.08, 0.08, 0.95, METAL, hx, 2.95, d / 2 + 0.45), P(cyl(0.4, 0.4, 0.09, 16).rotateZ(Math.PI / 2), vr.acc, { p: [hx, 2.5, d / 2 + 0.7] }), P(cyl(0.28, 0.28, 0.11, 14).rotateZ(Math.PI / 2), WHITE, { p: [hx, 2.5, d / 2 + 0.7] }), P(sph(0.15, 8, 6), FRUIT[(vi + 1) % 3], { p: [hx, 2.5, d / 2 + 0.7], s: [0.7, 1, 1] }))
    }
  }

  // ---------- telhado ----------
  const rise = s.rise || 0, over = s.over ?? 0.6, RC = vr.roof, edge = tint(RC, 0.7), cap = tint(RC, 1.18)
  let roofY = () => H + 0.3 // altura do telhado em z (para a chaminé)
  if (s.roof === 'gable') {
    const run = d / 2 + over, Wr = w + 2 * EAVE_X
    let rt = rise
    for (const sg of [1, -1]) {
      const sl = slope(run, rise, RC, seed + sg, () => Wr)
      rt = sl.top
      for (const g of sl.parts) roof.push((sg < 0 ? g.rotateY(Math.PI) : g).translate(0, H, 0))
    }
    roofY = (z) => H + 0.1 + (rt - 0.1) * (1 - Math.abs(z) / run)
    const dlt = (rise * over) / run
    roof.push(P(prism(d, rise + 0.05, w), vr.wall, { p: [0, H, 0], grad: [0.85, 1.04] }))
    for (const sg of [1, -1]) roof.push(P(bx(w, dlt + 0.1, T), beam, { p: [0, H + dlt / 2, sg * zf] }))
    roof.push(P(cyl(0.3, 0.3, Wr + 0.2, 10).rotateZ(Math.PI / 2), cap, { p: [0, H + rt + 0.1, 0], lit: 0.15 }))
    for (const sx of [-1, 1]) roof.push(P(sph(0.36, 8, 6), cap, { p: [sx * (Wr / 2 + 0.12), H + rt + 0.1, 0], lit: 0.15 }))
    // testeiras grossas nas empenas e nos beirais (a "borda de brinquedo")
    const ang = Math.atan2(rt - 0.1, run), Le = Math.hypot(run, rt - 0.1)
    for (const sx of [-1, 1]) for (const sg of [1, -1]) {
      const g = P(rbx(0.26, 0.42, Le + 0.3, 0.09), edge, { lit: 0.1 }).rotateX(ang).translate(sx * (Wr / 2 - 0.05), H + (rt + 0.1) / 2 + 0.05, run / 2)
      roof.push(sg < 0 ? g.rotateY(Math.PI) : g)
    }
    for (const sg of [1, -1]) roof.push(P(rbx(Wr + 0.1, 0.3, 0.26, 0.08), edge, { p: [0, H + 0.02, sg * (run + 0.05)] }))
    // olho-de-boi nas empenas
    for (const f of ['l', 'r']) onFace(roof, [P(cyl(0.42, 0.42, 0.2, 14).rotateX(Math.PI / 2), trim, { p: [0, 0, 0.08] }), P(cyl(0.31, 0.31, 0.06, 14).rotateX(Math.PI / 2), GLASS, { p: [0, 0, 0.17], tip: GLASS_T }), P(bx(0.06, 0.62, 0.05), trim, { p: [0, 0, 0.21] }), P(bx(0.62, 0.06, 0.05), trim, { p: [0, 0, 0.21] })], f, 0, H + rise * 0.36)
  } else if (s.roof === 'hip') {
    const run = d / 2 + over, Wr = w + 2 * over, Dr = d + 2 * over, ridge = Math.max(0, Wr - Dr)
    let rt = rise
    for (const sg of [1, -1]) {
      const sl = slope(run, rise, RC, seed + sg, (t) => ridge + (Wr - ridge) * t)
      rt = sl.top
      for (const g of sl.parts) roof.push((sg < 0 ? g.rotateY(Math.PI) : g).translate(0, H, 0))
    }
    for (const sx of [1, -1]) for (const g of slope(run, rise, RC, seed + 5 + sx, (t) => Dr * t).parts) roof.push(g.rotateY((sx * Math.PI) / 2).translate((sx * ridge) / 2, H, 0))
    roofY = (z) => H + 0.1 + (rt - 0.1) * (1 - Math.abs(z) / run)
    if (ridge > 0.05) roof.push(P(cyl(0.3, 0.3, ridge + 0.3, 10).rotateZ(Math.PI / 2), cap, { p: [0, H + rt + 0.08, 0], lit: 0.15 }))
    for (const sx of [-1, 1]) {
      roof.push(P(sph(0.36, 8, 6), cap, { p: [(sx * ridge) / 2, H + rt + 0.1, 0], lit: 0.15 }))
      for (const sz of [-1, 1]) roof.push(rod([(sx * ridge) / 2, H + rt + 0.08, 0], [sx * (Wr / 2 - 0.05), H + 0.2, sz * (Dr / 2 - 0.05)], 0.3, cap, 8, { lit: 0.12 }))
    }
    for (const sg of [1, -1]) roof.push(P(rbx(Wr + 0.1, 0.3, 0.26, 0.08), edge, { p: [0, H + 0.02, sg * (run + 0.05)] }), P(rbx(0.26, 0.3, Dr + 0.1, 0.08), edge, { p: [sg * (Wr / 2 + 0.05), H + 0.02, 0] }))
    roof.push(P(bx(w, 0.5, d), beam, { p: [0, H + 0.2, 0], omit: BOT }))
  } else {
    roof.push(P(new THREE.BoxGeometry(w - 0.2, 0.3, d - 0.2, Math.round(w / 0.6), 1, Math.round(d / 0.6)), 0xa9b0b8, { p: [0, H + 0.15, 0], omit: BOT,
      tri: (c, cx, cy, cz, nx, ny) => { if (ny > 0.5) c.multiplyScalar(0.88 + 0.16 * hash(Math.floor(cx / 0.6 + 50), Math.floor(cz / 0.6 + 50), seed)) } }))
    for (const [pw, pd, px, pz] of [[w + 0.3, 0.4, 0, d / 2 - 0.05], [w + 0.3, 0.4, 0, -d / 2 + 0.05], [0.4, d - 0.5, -w / 2 + 0.05, 0], [0.4, d - 0.5, w / 2 - 0.05, 0]])
      roof.push(P(rbx(pw, 0.62, pd, 0.1), trim, { p: [px, H + 0.31, pz], omit: BOT, grad: [0.85, 1.05] }))
    roof.push(P(rbx(w + 0.36, 0.16, 0.46, 0.06), vr.acc, { p: [0, H + 0.66, d / 2 - 0.05] }))
    const tx = -w * 0.22, tz = -d * 0.1
    for (const [a, b] of LEGS) roof.push(Q(0.1, 0.45, 0.1, METAL, tx + a * 0.38, H + 0.3, tz + b * 0.38))
    roof.push(P(cyl(0.6, 0.6, 1.1, 12), 0x5aa0d8, { p: [tx, H + 1.3, tz], grad: [0.8, 1.08] }), P(cone(0.66, 0.38, 12), 0x3f7fc0, { p: [tx, H + 2.04, tz] }))
    roof.push(B(0.8, 0.55, 0.7, 0xc8ccd4, w * 0.24, H + 0.3, d * 0.08))
    for (const sx of [-1, 1]) roof.push(P(cyl(0.3, 0.23, 0.45, 8), 0xc8603a, { p: [sx * w * 0.36, H + 0.52, -d * 0.25] }), bush(0.7, sx * w * 0.36, H + 0.72, -d * 0.25))
  }
  for (let k = 0; k < (s.chimney || 0); k++) {
    const cxp = (k === 0 ? 0.27 : -0.3) * w, czp = -d * 0.2, ct = roofY(czp) + 1.0, c = stone ? tint(vr.wall, 0.95) : 0xc4b8a8
    const hh = ct - (H - 0.3)
    roof.push(P(new THREE.CylinderGeometry(0.42, 0.48, hh, 9, Math.max(1, Math.round(hh / 0.45))), c, { p: [cxp, (ct + H - 0.3) / 2, czp], grad: [0.8, 1.05],
      tri: (cc, cx, cy, cz) => cc.multiplyScalar(0.84 + 0.26 * hash(Math.floor(Math.atan2(cz, cx) * 2.2 + 9 + Math.floor(cy / 0.45 + 20)), Math.floor(cy / 0.45 + 20), seed + k)) }))
    roof.push(P(cyl(0.57, 0.57, 0.22, 9), tint(c, 0.85), { p: [cxp, ct + 0.11, czp] }), P(cyl(0.34, 0.34, 0.02, 9), 0x2a2420, { p: [cxp, ct + 0.23, czp] }))
  }

  // ---------- interior: pisos, escadas, guarda-corpos, rodapé de madeira e móveis ----------
  // piso: cada quadradinho da malha é uma tábua (meia tábua desencontrada a cada fileira), ladrilho ou laje de pedra
  const floorBox = (fw, fh, fd, x, y, z, c, pat, sd) => {
    const cw = pat === 'plank' ? 0.85 : 0.8, cd = pat === 'plank' ? 0.42 : 0.8, nx = Math.max(1, Math.round(fw / cw)), nz = Math.max(1, Math.round(fd / cd))
    return P(new THREE.BoxGeometry(fw, fh, fd, nx, 1, nz), c, { p: [x, y, z], omit: BOT, tri: (cc, cx, cy, cz, nnx, ny) => {
      if (ny < 0.5) { cc.multiplyScalar(0.72); return }
      const u = Math.floor(((cx + fw / 2) / fw) * nx), w2 = Math.floor(((cz + fd / 2) / fd) * nz)
      if (pat === 'tile') { if ((u + w2) & 1) cc.multiplyScalar(0.72); return }
      if (pat === 'flag') { cc.multiplyScalar(0.84 + 0.24 * hash(u, w2, sd)); return }
      cc.multiplyScalar(0.86 + 0.18 * hash(w2, (u + (w2 & 1)) >> 1, sd) + (w2 & 1 ? 0.03 : 0))
    } })
  }
  inside[0].push(floorBox(2 * ix + 0.04, FLOOR0, 2 * iz + 0.04, 0, FLOOR0 / 2, 0, shop ? 0xf1ead8 : stone ? 0xc7b9a6 : 0xdcb27a, shop ? 'tile' : stone ? 'flag' : 'plank', seed))
  dark.push(Q(2 * ix, FLOOR0, 2 * iz, 0x4a3a2e, 0, 0, 0))
  for (let k = 1; k < F; k++) {
    const h = ramps[k - 1], rects = [[-ix, ix, h.z1, iz]]
    if (h.x0 > -ix + 0.01) rects.push([-ix, h.x0, -iz, h.z1])
    if (h.x1 < ix - 0.01) rects.push([h.x1, ix, -iz, h.z1])
    for (const [a, b, c, e] of rects) inside[k].push(floorBox(b - a + 0.02, SLAB, e - c + 0.02, (a + b) / 2, k * FLOOR_H - SLAB / 2, (c + e) / 2, 0xd4a46c, 'plank', seed + k))
    // guarda-corpo do vão da escada (só a saída de cima fica aberta)
    const yb = k * FLOOR_H, z = h.z1 + 0.06, xa = h.x0, xb = h.x1 - 1.0, nb = Math.max(2, Math.round((xb - xa) / 0.42))
    inside[k].push(rod([xa, yb + 0.95, z], [xb, yb + 0.95, z], 0.07, WOOD_D, 6, { lit: 0.15 }))
    for (let i = 0; i <= nb; i++) inside[k].push(Q(0.07, 0.95, 0.07, i === 0 || i === nb ? WOOD_D : WOOD, xa + ((xb - xa) * i) / nb, yb, z))
    cols.push({ x: (xa + xb) / 2, z, hw: (xb - xa) / 2, hd: 0.1, lv: k })
    if (h.x0 > -ix + 0.01) {
      inside[k].push(rod([h.x0 - 0.06, yb + 0.95, h.z0], [h.x0 - 0.06, yb + 0.95, z], 0.07, WOOD_D))
      for (let i = 0; i <= 3; i++) inside[k].push(Q(0.07, 0.95, 0.07, WOOD, h.x0 - 0.06, yb, h.z0 + 0.1 + ((z - h.z0 - 0.1) * i) / 3))
      cols.push({ x: h.x0 - 0.06, z: (h.z0 + z) / 2, hw: 0.1, hd: (z - h.z0) / 2, lv: k })
    }
  }
  ramps.forEach((r, k) => {
    const n = 11, sw = (r.x1 - r.x0) / n, rr = r.y1 - r.y0, at = (x) => r.y0 + (rr * (x - r.x0)) / (r.x1 - r.x0)
    for (let i = 0; i < n; i++) {
      const yt = r.y0 + ((i + 0.5) * rr) / n, yb2 = k ? r.y0 : 0
      inside[k].push(P(bx(sw + 0.01, yt - yb2, r.z1 - r.z0), WOOD, { p: [r.x0 + (i + 0.5) * sw, (yt + yb2) / 2, (r.z0 + r.z1) / 2], omit: BOT, fn: (c, nx, ny) => c.multiplyScalar(ny > 0.5 ? (i & 1 ? 1.22 : 1.3) : nx < -0.5 ? 0.95 : 0.72) }))
    }
    // banzo: tábua inclinada fechando o lado aberto da escada (os degraus aparecem por cima, em serrilha)
    const sg = new THREE.BoxGeometry(r.x1 - r.x0, 1, 0.12, 6, 1, 1), sp = sg.attributes.position, base = k ? r.y0 : 0
    for (let i = 0; i < sp.count; i++) sp.setY(i, sp.getY(i) > 0 ? Math.max(0.15, at(sp.getX(i) + (r.x0 + r.x1) / 2) - base - 0.06) : 0)
    sg.computeVertexNormals()
    inside[k].push(P(sg, WOOD_D, { p: [(r.x0 + r.x1) / 2, base, r.z1 + 0.02], omit: BOT, grad: [0.8, 1.05] }))
    const xa = r.x0 + 1.2, xb = r.x1 - 1.0, z = r.z1 - 0.06
    inside[k].push(rod([xa, at(xa) + 0.95, z], [xb, at(xb) + 0.95, z], 0.07, WOOD_D, 6, { lit: 0.15 }))
    for (const x of [xa, (xa + xb) / 2, xb]) inside[k].push(Q(0.1, 0.95, 0.1, WOOD_D, x, at(x) - 0.05, z), P(sph(0.09, 6, 4), WOOD_L, { p: [x, at(x) + 0.95, z] }))
    cols.push({ x: (xa + xb) / 2, z: r.z1, hw: (xb - xa) / 2, hd: 0.06, lv: k })
  })
  // rodapé alto de madeira (casas de reboco e lojas): deixa o cômodo aconchegante
  if (!stone) for (let k = 0; k < F; k++) {
    const yb = k ? k * FLOOR_H : FLOOR0, c = 0xc98a50
    const runs = [[-ix, ix, -iz + 0.03, 'x'], [-iz, iz, -ix + 0.03, 'z'], [-iz, iz, ix - 0.03, 'z']]
    if (k === 0) runs.push([-ix, dl, iz - 0.03, 'x'], [dr, ix, iz - 0.03, 'x']); else runs.push([-ix, ix, iz - 0.03, 'x'])
    for (const [a, b, c2, ax] of runs) if (b - a > 0.05) {
      inside[k].push(ax === 'x' ? Q(b - a, 0.85, 0.06, c, (a + b) / 2, yb, c2) : Q(0.06, 0.85, b - a, c, c2, yb, (a + b) / 2))
      inside[k].push(ax === 'x' ? Q(b - a, 0.07, 0.1, WOOD_D, (a + b) / 2, yb + 0.85, c2) : Q(0.1, 0.07, b - a, WOOD_D, c2, yb + 0.85, (a + b) / 2))
    }
  }
  for (let k = 0; k < F; k++) furnish(k)

  // Móveis: candidatos encostados nas paredes / no meio, testados contra áreas reservadas (porta, escadas, corredores)
  function furnish(k) {
    const list = inside[k], y0 = k ? k * FLOOR_H : FLOOR0, ceil = (k === F - 1 ? H : (k + 1) * FLOOR_H - SLAB) - y0
    const rn = rng(seed + k * 101 + 7), busy = []
    const res = (a, b, c, e) => busy.push({ x0: a, x1: b, z0: c, z1: e })
    const up = ramps[k], down = ramps[k - 1]
    if (k === 0) res(dl - 0.45, dr + 0.45, iz - 2.3, iz + 1)
    if (up) { res(up.x0 - 0.1, up.x1 + 0.1, up.z0 - 1, up.z1 + 0.2); res(up.bot[0] - 0.9, up.bot[0] + 0.9, up.bot[1] - 0.9, up.bot[1] + 0.9) }
    if (down) { res(down.x0 - 0.2, down.x1 + 0.1, down.z0 - 1, down.z1 + 0.5); res(down.top[0] - 0.9, down.top[0] + 0.9, down.top[1] - 0.9, down.top[1] + 0.9) }
    // corredor em L entre a entrada (porta ou chegada da escada) e o pé da próxima escada
    const from = k === 0 ? [dx, iz - 1.2] : down && down.top, to = up && up.bot
    if (from && to) { res(Math.min(from[0], to[0]) - 0.55, Math.max(from[0], to[0]) + 0.55, to[1] - 0.55, to[1] + 0.55); res(from[0] - 0.55, from[0] + 0.55, Math.min(from[1], to[1]) - 0.55, Math.max(from[1], to[1]) + 0.55) }

    const put = (f, cands, gap = 0.12) => {
      for (const [x, z, rot] of cands) {
        const sw = rot & 1, hw = (sw ? f.fd : f.fw) / 2, hd = (sw ? f.fw : f.fd) / 2
        if (x - hw < -ix - 1e-3 || x + hw > ix + 1e-3 || z - hd < -iz - 1e-3 || z + hd > iz + 1e-3) continue
        if (busy.some((o) => x - hw < o.x1 && x + hw > o.x0 && z - hd < o.z1 && z + hd > o.z0)) continue
        busy.push({ x0: x - hw - gap, x1: x + hw + gap, z0: z - hd - gap, z1: z + hd + gap })
        const a = (rot * Math.PI) / 2, c = Math.round(Math.cos(a)), sn = Math.round(Math.sin(a))
        list.push(assembly(f.key, f.parts).rotateY(a).translate(x, y0, z))
        const fr = f.fd / 2 + 0.3 // a frente do móvel é +z antes de girar
        spots.push({ x, z, fx: x + Math.sin(a) * fr, fz: z + Math.cos(a) * fr, y: y0, k, key: f.key, room: k === 0 ? (shop ? 'loja' : 'terreo') : k === 2 ? 'sotao' : 'quarto', r: Math.max(f.fw, f.fd) / 2 })
        for (const q of f.cols) cols.push({ x: x + q.x * c + q.z * sn, z: z - q.x * sn + q.z * c, hw: sw ? q.hd : q.hw, hd: sw ? q.hw : q.hd, h: q.h, lv: k })
        return [x, z]
      }
      return null
    }
    const along = (wl, f, order) => {
      let pts = []
      if (wl === 'b' || wl === 'f') { const z = wl === 'b' ? -iz + f.fd / 2 : iz - f.fd / 2; for (let x = -ix + f.fw / 2; x <= ix - f.fw / 2 + 1e-6; x += 0.25) pts.push([x, z, wl === 'b' ? 0 : 2]) }
      else { const x = wl === 'l' ? -ix + f.fd / 2 : ix - f.fd / 2; for (let z = -iz + f.fw / 2; z <= iz - f.fw / 2 + 1e-6; z += 0.25) pts.push([x, z, wl === 'l' ? 1 : 3]) }
      if (order === 'mid') pts.sort((p, q) => Math.abs(p[0]) + Math.abs(p[1]) - Math.abs(q[0]) - Math.abs(q[1]))
      else if (order === 'ends') { const o = []; for (let i = 0, j = pts.length - 1; i <= j; i++, j--) { o.push(pts[i]); if (i !== j) o.push(pts[j]) } pts = o }
      return pts
    }
    const sh = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rn() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
    const atWall = (f, ws, order = 'ends', gap) => put(f, ws.flatMap((wl) => along(wl, f, order)), gap)
    const mid = (f, cz = 0, rots = [0, 1], gap = 0.45) => {
      const out = []
      for (let x = -ix + 0.4; x <= ix - 0.4; x += 0.25) for (let z = -iz + 0.4; z <= iz - 0.4; z += 0.25) for (const r of rots) out.push([x, z, r])
      return put(f, out.sort((p, q) => Math.hypot(p[0], p[1] - cz) - Math.hypot(q[0], q[1] - cz)), gap)
    }
    const any = () => sh(['l', 'r', 'b', 'f'])
    const c1 = CLOTH[Math.floor(rn() * CLOTH.length)], c2 = CLOTH[Math.floor(rn() * CLOTH.length)]

    if (k === 0 && shop) {
      atWall(FURN.shelf(seed), ['b'], 'mid')
      mid(FURN.shopCounter(), -iz * 0.2, [0], 0.3)
      mid(FURN.display(), iz * 0.3)
      atWall(FURN.shelf(seed + 1), sh(['l', 'r']), 'mid'); atWall(FURN.shelf(seed + 2), ['l', 'r', 'b'], 'mid')
      atWall(FURN.barrel(), any()); atWall(FURN.crates(true), any()); atWall(FURN.sacks(), any()); atWall(FURN.plant(), ['f', 'l', 'r'])
    } else if (k === 0) {
      if (s.interior === 'cottage') atWall(FURN.fireplace(ceil), ['b', 'r', 'l'], 'mid')
      else { atWall(FURN.counter(), sh(['b', 'l', 'r'])); atWall(FURN.stove(ceil), ['b', 'l', 'r']) }
      if (F === 1) atWall(FURN.bed(c1), sh(['l', 'r', 'b']))
      const tp = mid(FURN.table())
      if (tp) { const rg = FURN.rug(c2, 3.4, 2.3); list.push(assembly(rg.key, rg.parts).translate(tp[0], y0, tp[1])) }
      if (s.interior === 'house') atWall(FURN.sofa(c2), sh(['f', 'l', 'r', 'b']), 'mid')
      atWall(FURN.dresser(), any())
      if (F === 1) atWall(FURN.chest(), any())
      if (s.interior === 'house') { atWall(FURN.bookshelf(seed), any()); atWall(FURN.clock(), any()) } else { atWall(FURN.barrel(), any()); atWall(FURN.crates(rn() < 0.5), any()) }
      atWall(FURN.plant(), any()); atWall(FURN.barrel(), any()); atWall(FURN.plant(), any())
    } else if (k === 2) { // sótão do prédio de 3 andares: depósito com cama
      atWall(FURN.bed(c1), any()); atWall(FURN.crates(true), any()); atWall(FURN.crates(false), any()); atWall(FURN.barrel(), any())
      atWall(FURN.sacks(), any()); atWall(FURN.chest(), any()); atWall(FURN.barrel(), any()); atWall(FURN.plant(), any())
    } else { // quarto
      atWall(FURN.bed(c1), sh(['l', 'r', 'b', 'f']))
      if (ix * iz > 10 && rn() < 0.6) atWall(FURN.bed(c2), sh(['l', 'r', 'f']))
      atWall(FURN.wardrobe(), any()); atWall(FURN.chest(), any()); atWall(FURN.desk(), any())
      atWall(shop ? FURN.crates(true) : FURN.bookshelf(seed + k), any()); atWall(FURN.dresser(), any()); atWall(FURN.plant(), any())
      mid(FURN.rug(c2, 2.6, 1.8), 0.4, [0], 0)
    }
  }

  const closed = merge([...common, ...dark, ...roof, ...shell.flat(), ...ext.flat()])
  const cuts = []
  for (let k = 0; k < F; k++) cuts.push(merge([...common, ...shell.slice(0, k).flat(), ...ext.slice(0, k + 1).flat(), ...inside.slice(0, k + 1).flat(), ...cutw[k], ...(k === 0 ? doorStub : [])]))
  return {
    closed, cuts, door: doorLeaf(arch, vr.door), hinge: { x: dl + 0.04, z: zf }, doorCol: { x: dx, z: zf, hw: DOOR_W / 2, hd: T / 2 - 0.04 },
    cols, spots, windows, w, d, doorX: dx, floors: F, ix, iz, ramps, top: H + rise + 0.6,
  }
}
// Pré-geração espalhada: PrewarmBuildings só enfileira; PrewarmStep (a cada quadro) gera um protótipo pendente.
// Assim o jogo abre na hora; os chunks que precisarem de uma casa ainda não gerada a constroem na hora (GetProto).
const pending = []
export function PrewarmBuildings() { for (const id of Object.keys(SPECS)) for (let i = 0; i < SPECS[id].vars.length; i++) pending.push([id, i]) }
export function PrewarmStep() { const q = pending.shift(); if (q) GetProto(q[0], q[1]) }
