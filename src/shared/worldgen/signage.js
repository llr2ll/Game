import * as THREE from 'three'
import { P, merge, MAT, bx, cyl } from '../../engine/render/style'
import { AtlasTexture, SignUV } from './sign-atlas'
import { KM_POST, TRAFFIC_BODY, TRAFFIC_LENS } from './assets-road'
import { TrafficMat } from './streetlights'

// Desenha as placas, semáforos e marcos de km de um chunk. Postes e fundos entram numa geometria fundida (cor por vértice);
// as faces com texto ficam em OUTRA geometria fundida com UV do atlas. Resultado: ~3 draw calls por chunk, não importa quantas placas.
export const SignMat = new THREE.MeshBasicMaterial({ alphaTest: 0.5, color: 0xffffff })
let matInit = false
function ensureMat() {
  if (matInit) return
  matInit = true
  const t = AtlasTexture()
  if (t) { SignMat.map = t; SignMat.needsUpdate = true }
}
const SHAPED = { stop: [0.34, 8], speed: [0.34, 24], noentry: [0.34, 24] }

export function BuildSigns(g, d, cols, shadows, dispose, Height) {
  if (!d.signs.length && !d.kms.length && !d.lights.length) return
  ensureMat()
  const solid = [], pos = [], nor = [], uvs = []
  const quad = (cx, cy, cz, fx, fz, w, h, uv) => {
    const rx = fz, rz = -fx, hw = w / 2, hh = h / 2
    const c = [[-1, -1, uv.u0, uv.v0], [1, -1, uv.u1, uv.v0], [1, 1, uv.u1, uv.v1], [-1, 1, uv.u0, uv.v1]].map(([sx, sy, u, v]) => [cx + rx * hw * sx, cy + hh * sy, cz + rz * hw * sx, u, v])
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(c[i][0], c[i][1], c[i][2]); nor.push(fx, 0, fz); uvs.push(c[i][3], c[i][4]) }
  }
  const plate = (gy, pl) => {
    const uv = SignUV(pl.key), kind = pl.key.split(':')[0], th = Math.atan2(pl.fx, pl.fz), y = gy + pl.y
    quad(pl.cx + pl.fx * 0.03, y, pl.cz + pl.fz * 0.03, pl.fx, pl.fz, pl.w, pl.h, uv)
    if (SHAPED[kind]) {
      const [r, n] = SHAPED[kind], sc = pl.w / 0.7
      solid.push(P(cyl(r * sc, r * sc, 0.03, n).rotateX(Math.PI / 2).rotateZ(kind === 'stop' ? Math.PI / 8 : 0), 0x9aa1b0, { p: [pl.cx + pl.fx * 0.0, y, pl.cz + pl.fz * 0.0], r: [0, th, 0] }))
    } else solid.push(P(bx(pl.w + 0.06, pl.h + 0.06, 0.04), 0x6f768a, { p: [pl.cx + pl.fx * 0.0, y, pl.cz + pl.fz * 0.0], r: [0, th, 0], grad: [0.85, 1.05] }))
  }
  for (const s of d.signs) {
    let gy = 0
    for (const [x, z] of s.poles) {
      gy = Height(x, z)
      solid.push(P(cyl(0.05, 0.055, s.postH, 6), 0x9aa1b0, { p: [x, gy + s.postH / 2, z], grad: [0.75, 1.05] }))
      cols.push({ x, z, hw: 0.1, hd: 0.1 })
      shadows.push({ x: x - 0.2, z, rx: 0.3, rz: 0.3 })
    }
    for (const pl of s.plates) plate(gy, pl)
  }
  for (const k of d.kms) {
    const gy = Height(k.x, k.z)
    const m = new THREE.Mesh(KM_POST, MAT.solid)
    m.position.set(k.x, gy, k.z); m.rotation.y = k.ry
    m.matrixAutoUpdate = false; m.updateMatrix()
    g.add(m)
    for (const pl of k.plates) plate(gy, pl)
    cols.push({ x: k.x, z: k.z, hw: 0.16, hd: 0.16, h: 0.9 })
    shadows.push({ x: k.x - 0.2, z: k.z, rx: 0.35, rz: 0.35 })
  }
  for (const l of d.lights) {
    // corpo + 3 lentes (os materiais das lentes acendem conforme a fase da via que este semáforo controla)
    const gy = Height(l.x, l.z)
    for (const [geo, mat] of [[TRAFFIC_BODY, MAT.solid], ...TRAFFIC_LENS.map((geo, c) => [geo, TrafficMat[l.grp][c]])]) {
      const m = new THREE.Mesh(geo, mat)
      m.position.set(l.x, gy, l.z); m.rotation.y = l.ry
      m.matrixAutoUpdate = false; m.updateMatrix()
      g.add(m)
    }
    cols.push({ x: l.x, z: l.z, hw: 0.14, hd: 0.14 })
    shadows.push({ x: l.x - 0.25, z: l.z, rx: 0.4, rz: 0.4 })
  }
  if (solid.length) {
    const m = new THREE.Mesh(merge(solid), MAT.solid)
    m.matrixAutoUpdate = false
    g.add(m); dispose.push(m.geometry)
  }
  if (pos.length) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    const m = new THREE.Mesh(geo, SignMat)
    m.matrixAutoUpdate = false
    g.add(m); dispose.push(geo)
  }
}
