import * as THREE from 'three'

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.9, ...o })
const glow = (c) => new THREE.MeshBasicMaterial({ color: c })
export const M = {
  concrete: mat(0x8d8a84), white: mat(0xe9e4da), red: mat(0xc0392b), dark: mat(0x2b2b30), glass: mat(0x8fc4d8, { emissive: 0x2a4a58 }),
  yellow: mat(0xf2c230), pole: mat(0x6b4a2f), wire: mat(0x1c1c1c), lamp: glow(0xfff0bd), wheel: mat(0x1a1a1a), tail: glow(0xff3b30),
  blue: mat(0x2f6db5), asphalt: mat(0x4a4a50), shoulder: mat(0x8a6d4f), line: mat(0xf2c230), rock: mat(0x7d7f84),
  trunk: mat(0x5b3d26), leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1 }),
  ground: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
  fence: mat(0x8a6a44), stem: mat(0x4a7a35), bark: mat(0x5b3d26),
  litter: new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, side: THREE.DoubleSide }),
}
const CAR_COLORS = [mat(0xb03a2e), mat(0x2e6da4), mat(0xc9a227), mat(0x5d6d7e)]

export const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  o.position.set(x, y, z)
  return o
}
const cyl = (rt, rb, h, seg, m, x, y, z) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m)
  o.position.set(x, y, z)
  return o
}
const col = (cols, x, z, hw, hd, h) => cols.push(h ? { x, z, hw, hd, h } : { x, z, hw, hd })

export function BuildGas(parent, { x: sx, z: sz }, cols) {
  // laje fina rente ao chão; o resto fica 0.16 abaixo para encostar nela
  parent.add(box(9.6, 0.04, 9.6, M.concrete, sx, 0.02, sz))
  const g = new THREE.Group()
  g.position.y = -0.16
  parent.add(g)
  // loja
  const bx = sx + 1.8, bz = sz - 2.6
  g.add(box(5, 3, 3, M.white, bx, 1.7, bz), box(5.4, 0.25, 3.4, M.red, bx, 3.35, bz), box(5.02, 0.5, 3.02, M.red, bx, 2.7, bz))
  g.add(box(1, 2, 0.06, M.dark, bx - 1.2, 1.2, bz + 1.52), box(1.8, 1, 0.06, M.glass, bx + 1, 1.7, bz + 1.52))
  col(cols, bx, bz, 2.5, 1.5)
  // cobertura das bombas
  const cx = sx - 1.3, cz = sz + 1.6
  g.add(box(6.5, 0.3, 4.4, M.white, cx, 3.95, cz), box(6.52, 0.12, 4.42, M.red, cx, 3.78, cz), box(5.6, 0.06, 3.6, M.lamp, cx, 3.7, cz))
  for (const [px, pz] of [[-2.8, -1.8], [2.8, -1.8], [-2.8, 1.8], [2.8, 1.8]]) {
    g.add(box(0.3, 3.7, 0.3, M.white, cx + px, 2.05, cz + pz))
    col(cols, cx + px, cz + pz, 0.2, 0.2)
  }
  for (const px of [-1.1, 1.1]) {
    g.add(box(0.6, 1.3, 0.5, M.red, cx + px, 0.85, cz), box(0.62, 0.3, 0.52, M.dark, cx + px, 1.6, cz), box(0.4, 0.3, 0.02, M.glass, cx + px, 1.15, cz + 0.26))
    col(cols, cx + px, cz, 0.35, 0.3, 1.7)
  }
  // placa alta
  const px = sx - 4.6, pz = sz - 3.6
  g.add(box(0.25, 6, 0.25, M.dark, px, 3, pz), box(2, 1.3, 0.2, M.red, px, 5.7, pz), box(1.6, 0.9, 0.22, M.yellow, px, 5.7, pz))
  col(cols, px, pz, 0.2, 0.2)
  // tambores
  for (const [dx, dz, m] of [[4, -0.2, M.red], [4, 0.8, M.blue]]) {
    g.add(cyl(0.3, 0.3, 0.9, 6, m, sx + dx, 0.65, sz + dz))
    col(cols, sx + dx, sz + dz, 0.3, 0.3, 0.95)
  }
}

export function BuildCar(g, { x, z, ry = 0, c = 0 }, cols) {
  const car = new THREE.Group()
  car.position.set(x, 0, z)
  car.rotation.y = ry
  car.add(box(2, 0.6, 4, CAR_COLORS[c % 4], 0, 0.7, 0), box(1.7, 0.6, 2, M.glass, 0, 1.25, -0.2), box(1.9, 0.1, 1.9, CAR_COLORS[c % 4], 0, 1.58, -0.2))
  for (const [wx, wz] of [[-1, 1.2], [1, 1.2], [-1, -1.2], [1, -1.2]]) {
    const w = cyl(0.38, 0.38, 0.26, 8, M.wheel, wx, 0.38, wz)
    w.rotation.z = Math.PI / 2
    car.add(w)
  }
  car.add(box(0.4, 0.15, 0.05, M.tail, -0.6, 0.85, -2.02), box(0.4, 0.15, 0.05, M.tail, 0.6, 0.85, -2.02))
  g.add(car)
  col(cols, x, z, 1.05, 2.05, 1.7)
}

export function BuildPole(g, { x, z }, cols) {
  g.add(cyl(0.12, 0.17, 7, 5, M.pole, x, 3.5, z), box(2, 0.12, 0.12, M.pole, x, 6.6, z))
  for (const s of [-0.9, 0.9]) g.add(box(0.03, 0.03, 8, M.wire, x + s, 6.55, z + 4))
  col(cols, x, z, 0.2, 0.2)
}
