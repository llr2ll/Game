import * as THREE from 'three'
import { Seed, CHUNK_SIZE } from './map'
import { Paved } from './layout'
import { GetProto } from './buildings'
import { DECOR } from './town'
import { Height, DirtAt, TerrainNoise } from './terrain'
import { vnoise } from '../../engine/world/noise'
import { MAT, SHADOW_GEO } from '../../engine/render/style'
import * as A from './assets'
import { M, BuildGas, BuildPole, BuildWires } from './props'
import { events } from '../../engine/core/events'
import { Attach } from './poles'
import * as R from './assets-road'
import { BuildRoadDetail } from './roadwear'
import { BuildSigns } from './signage'
import * as F from './assets-farm'
import * as C from './assets-city'
import { WaterSD } from './water'
import { BuildWater, BuildBridges } from './water-mesh'
import * as WP from './water-props'
import { WATER_Y } from './water'
import { BuildSidewalks, GroundAt } from './sidewalk'
import * as L from './assets-lights'
import { LampGlassMat, BuildLampFx } from './streetlights'

const col = (hex) => new THREE.Color(hex)
const GRASS_A = col(0x7ccf34), GRASS_B = col(0x9be04a), GRASS_DARK = col(0x58b52b) // verdes saturados
const PAVE = col(0xb9bdca)
const SOIL_A = col(0xa8622c), SOIL_B = col(0x8d4f22), SAND = col(0xf0d898) // terra das hortas, areia da margem
const DIRT_A = col(0xe5a542), DIRT_B = col(0xcf8a33) // terra alaranjada
// "tintas" multiplicadoras por instância: variam o verde sem custo (a cor base já vem nos vértices)
const TINTS = [col(0xffffff), new THREE.Color(1.1, 1.07, 0.8), new THREE.Color(0.9, 1.0, 1.12), new THREE.Color(1.0, 0.94, 0.9)]
const AUTUMN = new THREE.Color(2.3, 0.95, 0.75)
const FLOWER_COLORS = [0xffffff, 0xffe14a, 0xff7fb0, 0xb48cff, 0xff5a4a].map(col)
const LEAF_COLORS = [0xe0852f, 0xf0b73a, 0xa86a2f, 0xc4492a].map(col)
const BUSH_TINTS = [col(0xffffff), new THREE.Color(0.9, 1.05, 0.9), new THREE.Color(1.12, 1.05, 0.85)]

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), eul = new THREE.Euler()
const tmpC = new THREE.Color(), tmpD = new THREE.Color()

export function GenerateChunk(cx, cz) {
  const d = Seed(cx, cz)
  const g = new THREE.Group()
  const cols = []
  const dispose = []
  const shadows = []
  const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE
  const mx = ox + CHUNK_SIZE / 2 - 0.5, mz = oz + CHUNK_SIZE / 2 - 0.5

  // instancia uma lista; place(item) -> [x, y, z, rotY, sx, sy, sz]; tint(item) -> Color (opcional)
  function inst(geo, mat, items, place, tint) {
    if (!items.length) return
    const im = new THREE.InstancedMesh(geo, mat, items.length)
    items.forEach((it, i) => {
      const [x, y, z, ry, sx, sy, sz] = place(it)
      q.setFromAxisAngle(UP, ry)
      m4.compose(pv.set(x, y, z), q, sv.set(sx, sy, sz))
      im.setMatrixAt(i, m4)
      if (tint) im.setColorAt(i, tint(it))
    })
    if (tint) im.instanceColor.needsUpdate = true
    g.add(im)
    dispose.push(im)
    return im
  }

  // ---------- chão: relevo + mistura de terra/grama por vértice ----------
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  // grade de alturas (com 1 de margem) calculada UMA vez: serve para posição, inclinação e cor
  const N = CHUNK_SIZE + 1, GW = N + 2
  const hg = new Float32Array(GW * GW)
  for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) hg[j * GW + i] = TerrainNoise(ox - 0.5 + (i - 1), oz - 0.5 + (j - 1))
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + mx, wz = pos.getZ(i) + mz
    const gi = Math.round(wx - (ox - 0.5)) + 1, gj = Math.round(wz - (oz - 0.5)) + 1
    const h = hg[gj * GW + gi]
    const slope = Math.abs(hg[gj * GW + gi + 1] - hg[gj * GW + gi - 1]) + Math.abs(hg[(gj + 1) * GW + gi] - hg[(gj - 1) * GW + gi])
    pos.setXYZ(i, wx, h, wz)
    tmpC.copy(GRASS_A).lerp(GRASS_B, vnoise(wx * 0.08, wz * 0.08, 31)).lerp(GRASS_DARK, vnoise(wx * 0.2, wz * 0.2, 32) * 0.4)
    tmpD.copy(DIRT_A).lerp(DIRT_B, vnoise(wx * 0.15, wz * 0.15, 33))
    tmpC.lerp(tmpD, DirtAt(wx, wz, slope))
    const sd = WaterSD(wx, wz)
    if (sd < 1.8) tmpC.lerp(SAND, 1 - THREE.MathUtils.smoothstep(sd, 0.5, 1.8))
    for (const f of d.fields) if (Math.abs(wx - f.x) < f.hw + 0.4 && Math.abs(wz - f.z) < f.hd + 0.4) { tmpC.copy(SOIL_A).lerp(SOIL_B, vnoise(wx * 0.4, wz * 0.4, 34)); break }
    const pv0 = Paved(wx, wz)
    if (pv0 > 0) tmpC.lerp(PAVE, pv0 * 0.85)
    tmpC.multiplyScalar(1 + THREE.MathUtils.clamp(h * 0.03, -0.12, 0.1)) // vales mais fundos, topos mais claros
    colors.set([tmpC.r, tmpC.g, tmpC.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  g.add(new THREE.Mesh(geo, MAT.ground))
  dispose.push(geo)

  // ---------- lagos e rios (mesma grade do chão) + pontes ----------
  BuildWater(g, ox, oz, (i, j) => hg[(j + 1) * GW + i + 1], dispose)
  BuildBridges(g, ox, oz, cols, dispose, MAT)
  inst(F.LILY, MAT.solid, d.lilies, (l) => [l.x, -0.43, l.z, l.ry, l.s, 1, l.s])
  inst(F.LILY_FLOWER, MAT.solid, d.lilies.filter((l) => l.fl), (l) => [l.x + 0.1 * l.s, -0.43, l.z, l.ry, l.s, l.s, l.s])
  // píer, pontezinha, pedras; barcos boiando (com colisor pulável); peixes e patos nadando (shader)
  WP.BuildWaterStructs(g, d.wlife, dispose, MAT)
  inst(WP.BOAT, WP.BobMat, d.wlife.boats, (b) => [b.x, WATER_Y - 0.12, b.z, b.th, 1, 1, 1], (b) => WP.BOAT_TINTS[b.c])
  for (const b of d.wlife.boats) for (const k of [-0.75, 0, 0.75]) cols.push({ x: b.x + Math.sin(b.th) * k, z: b.z + Math.cos(b.th) * k, hw: 0.45, hd: 0.45, h: 0.75 })
  const swimC = (f) => new THREE.Color(f.R / (4 * (f.s || 1)), f.ph, f.sp) // a escala da instância multiplica o raio
  for (const [geo, mat, list, y, sc] of [[WP.FISH, WP.FishMat, d.fish, WATER_Y - 0.08, 1], [WP.FISH_SHADOW, WP.FishShadowMat, d.fish, WATER_Y + 0.012, 1], [WP.DUCK, WP.DuckMat, d.ducks, WATER_Y - 0.06, 1]]) {
    const im = inst(geo, mat, list, (f) => [f.x, y, f.z, 0, f.s || sc, f.s || sc, f.s || sc], swimC)
    if (im) { im.frustumCulled = false; if (mat === WP.FishShadowMat) im.renderOrder = 2 }
  }
  inst(F.REED, MAT.grass, d.reeds, (r) => [r.x, Height(r.x, r.z) - 0.05, r.z, r.ry, r.s, r.s, r.s])

  // ---------- hortas: leiras + plantas + espantalho ----------
  const CROP_GEO = { cabbage: F.CABBAGE, corn: F.CORN, carrot: F.CARROT }
  inst(F.RIDGE, MAT.solid, d.crops, (c) => [c.x, Height(c.x, c.z) - 0.02, c.z, c.ax ? Math.PI / 2 : 0, 1, 1, c.sp])
  for (const type of Object.keys(CROP_GEO)) inst(CROP_GEO[type], type === 'corn' ? MAT.grass : MAT.foliage, d.crops.filter((c) => c.crop === type), (c) => [c.x, Height(c.x, c.z) + 0.1, c.z, c.ry, c.s, c.s, c.s])
  inst(F.SCARECROW, MAT.solid, d.scarecrows, (o) => [o.x, Height(o.x, o.z) - 0.05, o.z, o.ry, 1, 1, 1])
  for (const o of d.scarecrows) { cols.push({ x: o.x, z: o.z, hw: 0.15, hd: 0.15 }); shadows.push({ x: o.x - 0.3, z: o.z, rx: 0.7, rz: 0.4 }) }

  // ---------- calçadas (laje elevada com meio-fio) ----------
  BuildSidewalks(g, cx, cz, dispose)

  // ---------- estradas: um retângulo por trecho (principais com acostamento; ruas locais com meio-fio claro) ----------
  const dashes = []
  // cada chunk desenha só o pedaço da estrada que cai dentro dele (antes cada chunk que tocava o trecho desenhava os ~70 m
  // inteiros: 5–6 cópias empilhadas). Camadas rentes ao chão (o polygonOffset decide quem fica por cima), senão os pés afundam no asfalto
  const X0 = ox - 0.5, Z0 = oz - 0.5, X1 = X0 + CHUNK_SIZE, Z1 = Z0 + CHUNK_SIZE
  for (const rd of d.roads) {
    const v = rd.axis === 'v'
    const sw = rd.art ? rd.hw * 3 : rd.hw * 2 + 1.2
    const mk = (w, mat, y) => {
      const a0 = Math.max(rd.a, v ? Z0 : X0), a1 = Math.min(rd.b, v ? Z1 : X1)
      const c0 = Math.max(rd.c - w / 2, v ? X0 : Z0), c1 = Math.min(rd.c + w / 2, v ? X1 : Z1)
      if (a1 - a0 < 0.01 || c1 - c0 < 0.01) return
      const m = new THREE.Mesh(new THREE.PlaneGeometry(v ? c1 - c0 : a1 - a0, v ? a1 - a0 : c1 - c0).rotateX(-Math.PI / 2), mat)
      m.position.set(v ? (c0 + c1) / 2 : (a0 + a1) / 2, y, v ? (a0 + a1) / 2 : (c0 + c1) / 2)
      g.add(m)
      dispose.push(m.geometry)
    }
    mk(sw, rd.art ? M.shoulder : M.curb, rd.art ? 0.01 : 0.014)
    mk(rd.hw * 2, M.asphalt, 0.02)
    // tracejado: só o chunk que contém a linha central (o vizinho lateral também enxerga a estrada)
    if (rd.art && rd.c >= (v ? X0 : Z0) && rd.c < (v ? X1 : Z1)) {
      // tracejado central na grade global (período 4), sem passar por cima de cruzamentos
      const lo = Math.max(rd.a + rd.hw, (v ? oz : ox) - 0.5), hi = Math.min(rd.b - rd.hw, (v ? oz : ox) + CHUNK_SIZE - 0.5)
      for (let k = Math.ceil((lo - 1) / 4); k * 4 + 1 < hi; k++) {
        const t = k * 4 + 1
        if (t < lo || d.roads.some((o) => o.art && o.axis !== rd.axis && (o.axis === 'v' ? Math.abs(o.c - (v ? rd.c : t)) < o.hw + 1.2 && (v ? t : rd.c) > o.a && (v ? t : rd.c) < o.b : Math.abs(o.c - (v ? t : rd.c)) < o.hw + 1.2 && (v ? rd.c : t) > o.a && (v ? rd.c : t) < o.b))) continue
        dashes.push({ x: v ? rd.c : t, z: v ? t : rd.c, ry: v ? 0 : Math.PI / 2 })
      }
    }
  }
  inst(A.DASH, MAT.solid, dashes, (q) => [q.x, 0, q.z, q.ry, 1, 1, 1])
  BuildRoadDetail(g, d, dispose, inst) // rachaduras, remendos, marcas de pneu, poças, faixas de pedestre, finais de estrada

  // ---------- árvores: carvalhos redondos e pinheiros (2 draw calls no total) ----------
  const oaks = d.trees.filter((t) => t.k >= 0.3), pines = d.trees.filter((t) => t.k < 0.3)
  const treePlace = (t) => [t.x, Height(t.x, t.z) - 0.05, t.z, t.k * 6.28, t.s, t.s, t.s]
  inst(A.OAK, MAT.foliage, oaks, treePlace, (t) => (t.k > 0.93 ? AUTUMN : TINTS[Math.floor(t.k * 40) % 4]))
  inst(A.PINE, MAT.foliage, pines, treePlace, (t) => TINTS[Math.floor(t.k * 90) % 4])
  for (const t of d.trees) {
    cols.push({ x: t.x, z: t.z, hw: 0.3 * t.s, hd: 0.3 * t.s })
    shadows.push({ x: t.x - 0.45 * t.s, z: t.z, rx: 1.35 * t.s, rz: 1.1 * t.s })
  }

  // ---------- pedras, troncos caídos e tocos ----------
  inst(A.ROCK, MAT.solid, d.rocks, (r) => [r.x, Height(r.x, r.z) + 0.2 * r.s, r.z, r.ry, r.s, r.s * 0.7, r.s])
  for (const r of d.rocks) {
    cols.push({ x: r.x, z: r.z, hw: 0.5 * r.s, hd: 0.5 * r.s, h: 0.65 * r.s })
    shadows.push({ x: r.x - 0.3 * r.s, z: r.z, rx: 0.8 * r.s, rz: 0.65 * r.s })
  }
  inst(A.LOG, MAT.solid, d.logs, (l) => {
    const ex = Math.cos(l.ry) * l.len / 2, ez = -Math.sin(l.ry) * l.len / 2
    const y = Math.min(Height(l.x, l.z), Height(l.x + ex, l.z + ez), Height(l.x - ex, l.z - ez)) + 0.25 * l.t
    return [l.x, y, l.z, l.ry, l.len, l.t, l.t]
  })
  for (const l of d.logs) {
    const along = l.len / 2, across = 0.32 * l.t, h = 0.6 * l.t
    cols.push(l.ry === 0 ? { x: l.x, z: l.z, hw: along, hd: across, h } : { x: l.x, z: l.z, hw: across, hd: along, h })
    shadows.push({ x: l.x - 0.3, z: l.z, rx: l.ry === 0 ? along + 0.3 : 0.6, rz: l.ry === 0 ? 0.6 : along + 0.3 })
  }
  inst(A.STUMP, MAT.solid, d.stumps, (s) => [s.x, Height(s.x, s.z) - 0.05, s.z, 0, s.s, s.s, s.s])
  for (const s of d.stumps) {
    cols.push({ x: s.x, z: s.z, hw: 0.35 * s.s, hd: 0.35 * s.s, h: 0.65 * s.s })
    shadows.push({ x: s.x - 0.3 * s.s, z: s.z, rx: 0.7 * s.s, rz: 0.55 * s.s })
  }

  // ---------- vegetação rasteira ----------
  inst(A.BUSH, MAT.foliage, d.bushes, (b) => [b.x, Height(b.x, b.z) - 0.05, b.z, b.c * 6, b.s, b.s * 0.85, b.s], (b) => BUSH_TINTS[Math.floor(b.c * 3) % 3])
  inst(A.CLUMP, MAT.grass, d.tufts, (t) => [t.x, Height(t.x, t.z) - 0.02, t.z, t.ry, t.s, t.s * (0.9 + t.c * 0.4), t.s], (t) => TINTS[Math.floor(t.c * 4) % 4])
  const fp = (f) => [f.x, Height(f.x, f.z) - 0.02, f.z, f.ry, f.s, f.s, f.s]
  inst(A.FLOWER_STEM, MAT.flower, d.flowers, fp)
  inst(A.FLOWER_HEAD, MAT.flower, d.flowers, fp, (f) => FLOWER_COLORS[f.c])
  inst(A.LEAF, MAT.litter, d.litter, (l) => [l.x, Height(l.x, l.z) + 0.04, l.z, l.ry, l.s, 1, l.s], (l) => LEAF_COLORS[l.c])

  // ---------- cercas (postes redondos + 2 trilhos que seguem o terreno) ----------
  if (d.fences.length) {
    const posts = [], rails = []
    for (const f of d.fences) {
      const dxz = f.ry ? [1.25, 0] : [0, 1.25] // meia-extensão do vão no mundo
      const h0 = Height(f.x - dxz[0], f.z - dxz[1]), h1 = Height(f.x + dxz[0], f.z + dxz[1])
      posts.push({ x: f.x - dxz[0], z: f.z - dxz[1], y: h0 }, { x: f.x + dxz[0], z: f.z + dxz[1], y: h1 })
      for (const o of [0.45, 0.85]) rails.push({ x: f.x, z: f.z, y: (h0 + h1) / 2 + o, tilt: -Math.atan2(h1 - h0, 2.5), ry: f.ry })
      cols.push(f.ry ? { x: f.x, z: f.z, hw: 1.3, hd: 0.15, h: 1.0 } : { x: f.x, z: f.z, hw: 0.15, hd: 1.3, h: 1.0 })
      shadows.push(f.ry ? { x: f.x, z: f.z - 0.4, rx: 1.5, rz: 0.5 } : { x: f.x - 0.4, z: f.z, rx: 0.5, rz: 1.5 })
    }
    inst(A.POST, MAT.solid, posts, (p) => [p.x, p.y - 0.05, p.z, 0, 1, 1, 1])
    const im = new THREE.InstancedMesh(A.RAIL, MAT.solid, rails.length)
    rails.forEach((r, i) => {
      q.setFromEuler(eul.set(r.tilt, r.ry, 0, 'YXZ'))
      m4.compose(pv.set(r.x, r.y, r.z), q, sv.set(1, 1, 1))
      im.setMatrixAt(i, m4)
    })
    g.add(im)
    dispose.push(im)
  }

  // ---------- peças de obra / praça nos finais de estrada + mobiliário urbano dos lotes das cidades ----------
  const OBJ_GEO = {
    barrier: R.BARRIER, cone: R.CONE, bollard: R.BOLLARD, dirt: R.DIRT, pipes: R.PIPES, tfence: R.TFENCE, excavator: R.EXCAVATOR, bench: R.BENCH,
    bin: C.BIN, hydrant: C.HYDRANT, planter: C.PLANTER, hedge: C.HEDGE, kiosk: C.KIOSK, fountain: C.FOUNTAIN, busstop: C.BUS_SHELTER, wheelstop: C.WHEEL_STOP,
    picnic: C.PICNIC, cafe: C.CAFE, bikerack: C.BIKE_RACK,
  }
  // colisor: [hw, hd, h?] no espaço da peça; OBJ_COLS = várias caixas [dx, dz, hw, hd, h?]; batente de vaga não colide (passa por cima)
  const OBJ_COL = {
    barrier: [1.0, 0.2, 0.95], cone: [0.2, 0.2, 0.6], bollard: [0.12, 0.12, 0.9], dirt: [1.6, 1.6], pipes: [1.3, 0.9, 0.9], tfence: [1.25, 0.1, 1.7], excavator: [1.7, 1.3], bench: [0.9, 0.3, 0.6], lamp: [0.26, 0.26],
    bin: [0.25, 0.25, 0.8], hydrant: [0.15, 0.15, 0.75], planter: [0.62, 0.62, 0.6], hedge: [1.2, 0.35, 0.95], kiosk: [1.15, 0.85], picnic: [0.9, 0.8, 0.8], cafe: [0.45, 0.45, 0.78], glamp: [0.12, 0.12], bikerack: [0.75, 0.1, 0.6],
  }
  const OBJ_COLS = { fountain: [[0, 0, 1.8, 1.8, 0.65], [0, 0, 0.35, 0.35]], busstop: [[0, -0.55, 1.5, 0.06], [-1.45, -0.03, 0.06, 0.5], [1.45, 0.5, 0.06, 0.06]], wheelstop: [] }
  const SHADOWED = new Set(['excavator', 'dirt', 'pipes', 'bench', 'planter', 'hedge', 'kiosk', 'fountain', 'busstop', 'picnic', 'cafe', 'bin'])
  for (const type of Object.keys(OBJ_GEO)) inst(OBJ_GEO[type], MAT.solid, d.objs.filter((o) => o.type === type), (o) => [o.x, GroundAt(o.x, o.z) - 0.02, o.z, o.ry, 1, 1, 1]) // GroundAt: em cima da calçada, não enterrado nela
  for (const o of d.objs) {
    const cs = Math.cos(o.ry), sn = Math.sin(o.ry), sw = Math.abs(sn) > 0.7
    const boxes = OBJ_COLS[o.type] || [[0, 0, ...OBJ_COL[o.type]]]
    for (const [dx, dz, hw, hd, h] of boxes) cols.push({ x: o.x + dx * cs + dz * sn, z: o.z - dx * sn + dz * cs, hw: sw ? hd : hw, hd: sw ? hw : hd, ...(h ? { h } : {}) })
    if (SHADOWED.has(o.type)) { const [hw, hd] = boxes.length ? boxes[0].slice(2) : [0.5, 0.5]; shadows.push({ x: o.x - 0.4, z: o.z, rx: (sw ? hd : hw) + 0.5, rz: (sw ? hw : hd) + 0.5 }) }
  }

  // ---------- decoração (lampiões, cruzeiros, poços, espigueiros) ----------
  const DECOR_GEO = { bench: R.BENCH, cruceiro: A.CRUCEIRO, well: A.WELL, horreo: A.HORREO }
  for (const type of Object.keys(DECOR_GEO)) {
    const list = d.decor.filter((o) => o.type === type)
    inst(DECOR_GEO[type], MAT.solid, list, (o) => [o.x, GroundAt(o.x, o.z) - 0.05, o.z, o.ry, 1, 1, 1])
  }
  for (const o of d.decor) {
    cols.push({ x: o.x, z: o.z, hw: o.hw, hd: o.hd })
    shadows.push({ x: o.x - 0.3, z: o.z, rx: o.hw + 0.5, rz: o.hd + 0.5 })
  }

  // ---------- casas: malha fechada + um recorte por andar (só uma visível; o registro troca quando alguém entra) + porta que gira ----------
  const bList = []
  for (const b of d.buildings) {
    const pr = GetProto(b.id, b.v)
    const y = Math.max(Height(b.x - b.hw, b.z - b.hd), Height(b.x + b.hw, b.z - b.hd), Height(b.x - b.hw, b.z + b.hd), Height(b.x + b.hw, b.z + b.hd), Height(b.x, b.z))
    const meshes = [pr.closed, ...pr.cuts].map((geo, i) => {
      const m = new THREE.Mesh(geo, MAT.solid)
      m.position.set(b.x, y, b.z); m.rotation.y = b.ry; m.visible = i === 0
      g.add(m)
      return m
    })
    const sn = Math.round(Math.sin(b.ry)), cs = Math.round(Math.cos(b.ry)), swap = sn !== 0
    const toW = (lx, lz) => [b.x + lx * cs + lz * sn, b.z - lx * sn + lz * cs]
    for (const c of pr.cols) {
      const [wx, wz] = toW(c.x, c.z)
      const o = { x: wx, z: wz, hw: swap ? c.hd : c.hw, hd: swap ? c.hw : c.hd }
      if (c.h !== undefined) o.h = c.h
      if (c.lv !== undefined) o.lv = c.lv
      cols.push(o)
    }
    // porta: pivô na dobradiça; o colisor some quando ela abre
    const pivot = new THREE.Group(), leaf = new THREE.Mesh(pr.door, MAT.solid)
    const [hx, hz] = toW(pr.hinge.x, pr.hinge.z), [ddx, ddz] = toW(pr.doorCol.x, pr.doorCol.z)
    pivot.position.set(hx, y, hz); pivot.rotation.y = b.ry
    pivot.add(leaf); g.add(pivot)
    const dcol = { x: ddx, z: ddz, hw: swap ? pr.doorCol.hd : pr.doorCol.hw, hd: swap ? pr.doorCol.hw : pr.doorCol.hd, door: true, off: false }
    cols.push(dcol)
    // sombra só do lado de fora (um quad grande cobriria o piso do interior)
    shadows.push({ x: b.x - b.hw - 0.1, z: b.z, rx: 1.0, rz: b.hd + 0.6 }, { x: b.x, z: b.z - b.hd - 0.1, rx: b.hw + 0.6, rz: 0.9 })
    const iw = swap ? pr.iz : pr.ix, id = swap ? pr.ix : pr.iz
    bList.push({
      x: b.x, z: b.z, y, ry: b.ry, cs, sn, pr, x0: b.x - b.hw, x1: b.x + b.hw, z0: b.z - b.hd, z1: b.z + b.hd,
      ix0: b.x - iw, ix1: b.x + iw, iz0: b.z - id, iz1: b.z + id, meshes, mode: 0, door: { pivot, leaf, ang: 0, col: dcol, x: ddx, z: ddz },
      // janelas do térreo no mundo (entradas de zumbi); id = posição
      windows: pr.windows.map((o) => { const [wx, wz] = toW(o.x, o.z); return { x: wx, z: wz, nx: o.nx * cs + o.nz * sn, nz: -o.nx * sn + o.nz * cs, w: o.w, y: y + o.y, id: `${wx.toFixed(1)},${wz.toFixed(1)}` } }),
      // móveis no mundo (saque); id estável: a mesma casa gera o mesmo id quando o chunk volta
      spots: pr.spots.map((s) => { const [sx, sz] = toW(s.x, s.z), [fx, fz] = toW(s.fx, s.fz); return { x: sx, z: sz, fx, fz, y: y + s.y, lv: s.k, key: s.key, room: s.room, r: s.r, id: `${sx.toFixed(1)},${sz.toFixed(1)},${s.k}` } }),
    })
  }

  for (const p of d.props) {
    if (p.type === 'gas') BuildGas(g, p, cols, shadows)
    else if (p.type === 'car') events.emit('vehicle-spot', p) // aqui cabe um carro: o jogo decide se cria (nasce quando alguém chega perto)
    else if (p.type === 'pole') BuildPole(g, p, cols, shadows)
  }
  BuildWires(g, d.props.filter((p) => p.type === 'span' || p.type === 'drop'), Height, Attach, dispose)

  BuildSigns(g, d, cols, shadows, dispose, GroundAt) // placas (atlas), semáforos, marcos de km (na calçada quando há)

  // ---------- iluminação pública: corpo + vidro (acende à noite) + cone/poça/halo; a lista vai para o gerenciador de luzes ----------
  const lamps = []
  const lightUp = (kind, list, dy) => {
    if (!list.length) return
    const place = (o) => [o.x, GroundAt(o.x, o.z) + dy, o.z, o.ry, 1, 1, 1]
    inst(kind.body, MAT.solid, list, place)
    inst(kind.glass, LampGlassMat, list, place)
    const [hx, hy, hz] = kind.head
    for (const o of list) {
      const c = Math.cos(o.ry), s = Math.sin(o.ry), x = o.x + hx * c + hz * s, z = o.z - hx * s + hz * c
      lamps.push({ x, z, y: GroundAt(o.x, o.z) + dy + hy, gy: GroundAt(x, z), r: kind.beam, halo: kind.halo, spot: kind.spot })
    }
  }
  for (const [type, kind] of [['lamp', L.STREET_LAMP], ['lamp2', L.STREET_LAMP_FLOWERS], ['lantern', L.LANTERN]]) lightUp(kind, d.decor.filter((o) => o.type === type), -0.05)
  for (const [type, kind] of [['lamp', L.LANTERN], ['glamp', L.GARDEN_LAMP]]) lightUp(kind, d.objs.filter((o) => o.type === type), -0.02)
  BuildLampFx(g, lamps, dispose)

  // ---------- sombras de contato (1 draw call para o chunk inteiro) ----------
  inst(SHADOW_GEO, MAT.shadow, shadows, (s) => [s.x, GroundAt(s.x, s.z) + 0.07, s.z, 0, s.rx * 2, 1, s.rz * 2])
  if (shadows.length) g.children[g.children.length - 1].renderOrder = 1

  // chunk é estático: desliga a atualização automática de matrizes (economiza CPU por frame)
  g.traverse((o) => { o.matrixAutoUpdate = false; o.updateMatrix() })

  g.userData.colliders = cols
  g.userData.buildings = bList
  g.userData.dispose = dispose
  g.userData.lamps = lamps
  return g
}
