import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Seed, CHUNK_SIZE, ROAD_HALF } from '../seed/map'
import { Height, Dirt, TerrainNoise } from '../terrain'
import { vnoise } from '../noise'
import { M, box, BuildGas, BuildCar, BuildPole } from '../props'

// ---------- geometrias compartilhadas (low poly) ----------
const cone = (r, h, y) => new THREE.ConeGeometry(r, h, 6).translate(0, y, 0)
const treeLeaf = mergeGeometries([cone(1.3, 2.3, 2.1), cone(1.0, 2.0, 3.3), cone(0.65, 1.5, 4.4)])
const treeTrunk = new THREE.CylinderGeometry(0.18, 0.26, 1.3, 5).translate(0, 0.65, 0)
const rockGeo = new THREE.DodecahedronGeometry(0.6, 0)
const bushGeo = new THREE.IcosahedronGeometry(0.6, 0).translate(0, 0.3, 0)
const blade = (rz, x) => new THREE.ConeGeometry(0.06, 0.55, 3).translate(0, 0.27, 0).rotateZ(rz).translate(x, 0, 0)
const tuftGeo = mergeGeometries([blade(0, 0), blade(0.35, 0.08), blade(-0.35, -0.08)])
const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.42, 3).translate(0, 0.21, 0)
const headGeo = new THREE.OctahedronGeometry(0.1, 0).translate(0, 0.45, 0).scale(1, 0.7, 1)
const leafGeo = new THREE.PlaneGeometry(0.35, 0.22).rotateX(-Math.PI / 2)
const logGeo = new THREE.CylinderGeometry(0.3, 0.3, 1, 7).rotateZ(Math.PI / 2)
const postGeo = new THREE.BoxGeometry(0.14, 1.1, 0.14).translate(0, 0.55, 0)
const railGeo = new THREE.BoxGeometry(0.06, 0.09, 2.5)
const eul = new THREE.Euler()
const stumpGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.6, 7).translate(0, 0.3, 0)

const col = (hex) => new THREE.Color(hex)
const TREE_COLORS = [0x2f5d34, 0x3a6b3a, 0x2a4f30, 0x4c7a36, 0x2f5d34, 0x3a6b3a].map(col)
const AUTUMN = col(0xc0702a)
const BUSH_COLORS = [0x3f7a3a, 0x4f8a3f, 0x5f8f36, 0x35663a].map(col)
const TUFT_COLORS = [0x5f9a3e, 0x6fa844, 0x4f8a38].map(col)
const FLOWER_COLORS = [0xf4f1e8, 0xf2d24b, 0xe56b9b, 0x9b6be5, 0xe0483c].map(col)
const LEAF_COLORS = [0xc0702a, 0xd9a22f, 0x8a5a2b, 0xa3401f].map(col)
const GRASS_A = col(0x4f7a3a), GRASS_B = col(0x6a9142), GRASS_DARK = col(0x3e6630)
const DIRT_A = col(0x8a6d4f), DIRT_B = col(0x6e5238)

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0)
const tmpC = new THREE.Color(), tmpD = new THREE.Color()

export function GenerateChunk(cx, cz) {
  const d = Seed(cx, cz)
  const g = new THREE.Group()
  const cols = []
  const dispose = []
  const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE
  const mx = ox + CHUNK_SIZE / 2 - 0.5, mz = oz + CHUNK_SIZE / 2 - 0.5

  // instancia uma lista de itens; place(item) devolve [x,y,z, ry, sx, sy, sz]
  function inst(geo, mat, items, place, colorOf) {
    if (!items.length) return
    const im = new THREE.InstancedMesh(geo, mat, items.length)
    items.forEach((it, i) => {
      const [x, y, z, ry, sx, sy, sz] = place(it)
      q.setFromAxisAngle(UP, ry)
      m4.compose(pv.set(x, y, z), q, sv.set(sx, sy, sz))
      im.setMatrixAt(i, m4)
      if (colorOf) im.setColorAt(i, colorOf(it))
    })
    if (colorOf) im.instanceColor.needsUpdate = true
    g.add(im)
    dispose.push(im)
  }

  // ---------- chão: relevo + mistura de terra e grama por vértice ----------
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + mx, wz = pos.getZ(i) + mz
    const h = TerrainNoise(wx, wz)
    pos.setXYZ(i, wx, h, wz)
    tmpC.copy(GRASS_A).lerp(GRASS_B, vnoise(wx * 0.08, wz * 0.08, 31)).lerp(GRASS_DARK, vnoise(wx * 0.2, wz * 0.2, 32) * 0.35)
    tmpD.copy(DIRT_A).lerp(DIRT_B, vnoise(wx * 0.15, wz * 0.15, 33))
    tmpC.lerp(tmpD, Dirt(wx, wz))
    colors.set([tmpC.r, tmpC.g, tmpC.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  g.add(new THREE.Mesh(geo, M.ground))
  dispose.push(geo)

  if (d.onRoad) {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 3, CHUNK_SIZE).rotateX(-Math.PI / 2), M.shoulder)
    shoulder.position.set(0, 0.03, mz)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, CHUNK_SIZE).rotateX(-Math.PI / 2), M.asphalt)
    road.position.set(0, 0.035, mz)
    g.add(shoulder, road)
    dispose.push(shoulder.geometry, road.geometry)
    for (let i = 0; i < 4; i++) g.add(box(0.15, 0.02, 2, M.line, 0, 0.05, oz + 1 + i * 4))
  }

  // ---------- árvores ----------
  if (d.trees.length) {
    const place = (t) => [t.x, Height(t.x, t.z) - 0.05, t.z, t.k * 6.28, t.s, t.s, t.s]
    inst(treeTrunk, M.trunk, d.trees, place)
    inst(treeLeaf, M.leaf, d.trees, place, (t) => (t.k > 0.93 ? AUTUMN : TREE_COLORS[Math.floor(t.k * 6) % 6]))
    for (const t of d.trees) cols.push({ x: t.x, z: t.z, hw: 0.3 * t.s, hd: 0.3 * t.s })
  }

  // ---------- pedras, troncos caídos e tocos ----------
  inst(rockGeo, M.rock, d.rocks, (r) => [r.x, Height(r.x, r.z) + 0.2 * r.s, r.z, r.ry, r.s, r.s * 0.7, r.s])
  for (const r of d.rocks) cols.push({ x: r.x, z: r.z, hw: 0.5 * r.s, hd: 0.5 * r.s, h: 0.65 * r.s })

  inst(logGeo, M.bark, d.logs, (l) => {
    const ex = Math.cos(l.ry) * l.len / 2, ez = -Math.sin(l.ry) * l.len / 2
    const y = Math.min(Height(l.x, l.z), Height(l.x + ex, l.z + ez), Height(l.x - ex, l.z - ez)) + 0.25 * l.t
    return [l.x, y, l.z, l.ry, l.len, l.t, l.t]
  })
  for (const l of d.logs) {
    const along = l.len / 2, across = 0.32 * l.t
    const h = 0.6 * l.t
    cols.push(l.ry === 0 ? { x: l.x, z: l.z, hw: along, hd: across, h } : { x: l.x, z: l.z, hw: across, hd: along, h })
  }
  inst(stumpGeo, M.bark, d.stumps, (s) => [s.x, Height(s.x, s.z) - 0.05, s.z, 0, s.s, s.s, s.s])
  for (const s of d.stumps) cols.push({ x: s.x, z: s.z, hw: 0.35 * s.s, hd: 0.35 * s.s, h: 0.65 * s.s })

  // ---------- vegetação rasteira ----------
  inst(bushGeo, M.leaf, d.bushes, (b) => [b.x, Height(b.x, b.z) - 0.05, b.z, b.c * 6, b.s, b.s * 0.8, b.s], (b) => BUSH_COLORS[Math.floor(b.c * 4) % 4])
  inst(tuftGeo, M.leaf, d.tufts, (t) => [t.x, Height(t.x, t.z) - 0.02, t.z, t.ry, t.s, t.s, t.s], (t) => TUFT_COLORS[Math.floor(t.c * 3) % 3])
  const fp = (f) => [f.x, Height(f.x, f.z) - 0.02, f.z, f.ry, f.s, f.s, f.s]
  inst(stemGeo, M.stem, d.flowers, fp)
  inst(headGeo, M.leaf, d.flowers, fp, (f) => FLOWER_COLORS[f.c])
  inst(leafGeo, M.litter, d.litter, (l) => [l.x, Height(l.x, l.z) + 0.04, l.z, l.ry, l.s, 1, l.s], (l) => LEAF_COLORS[l.c])

  // cercas: postes + 2 trilhos inclinados seguindo o terreno (baixas o bastante para pular)
  if (d.fences.length) {
    const posts = [], rails = []
    for (const f of d.fences) {
      const h0 = Height(f.x, f.z - 1.25), h1 = Height(f.x, f.z + 1.25)
      posts.push({ x: f.x, z: f.z - 1.25, y: h0 }, { x: f.x, z: f.z + 1.25, y: h1 })
      for (const o of [0.45, 0.85]) rails.push({ x: f.x, z: f.z, y: (h0 + h1) / 2 + o, tilt: -Math.atan2(h1 - h0, 2.5) })
      cols.push({ x: f.x, z: f.z, hw: 0.15, hd: 1.3, h: 1.0 })
    }
    inst(postGeo, M.fence, posts, (p) => [p.x, p.y - 0.05, p.z, 0, 1, 1, 1])
    const im = new THREE.InstancedMesh(railGeo, M.fence, rails.length)
    rails.forEach((r, i) => {
      q.setFromEuler(eul.set(r.tilt, 0, 0))
      m4.compose(pv.set(r.x, r.y, r.z), q, sv.set(1, 1, 1))
      im.setMatrixAt(i, m4)
    })
    g.add(im)
    dispose.push(im)
  }

  for (const p of d.props) {
    if (p.type === 'gas') BuildGas(g, p, cols)
    else if (p.type === 'car') BuildCar(g, p, cols)
    else if (p.type === 'pole') BuildPole(g, p, cols)
  }

  g.userData.colliders = cols
  g.userData.dispose = dispose
  return g
}
