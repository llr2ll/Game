import * as THREE from 'three'
import { MAT, P, merge, box, bx, cyl, capLight } from '../../engine/render/style'

// Props grandes (posto, postes): cada um vira UMA geometria fundida com cores por vértice (1 draw call).
// camadas sobre o chão (y + polygonOffset): acostamento < meio-fio < asfalto, para nada piscar (z-fighting)
const layer = (color, n) => new THREE.MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: -n, polygonOffsetUnits: -n })
export const M = {
  asphalt: layer(0x858da3, 3),
  shoulder: layer(0xe3a343, 1),
  curb: layer(0xd9dbe4, 2),
}

const col = (cols, x, z, hw, hd, h) => cols.push(h ? { x, z, hw, hd, h } : { x, z, hw, hd })
const cache = new Map()
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k) }

// ---------------- posto de gasolina (coordenadas locais ao centro do posto) ----------------
function gasParts() {
  const y0 = 0.08, S = []
  S.push(box(9.6, 0.08, 9.6, 0xd2cbb8, [0, 0.04, 0]))
  // loja: paredes creme, faixa vermelha, telhado de pirâmide rosa, porta em arco, janela azul
  const bX = 1.8, bZ = -2.6
  S.push(box(5, 2.6, 3, 0xf6eedb, [bX, y0 + 1.3, bZ], { grad: [0.8, 1.05] }))
  S.push(box(5.05, 0.5, 3.05, 0xe8453c, [bX, y0 + 2.35, bZ]))
  S.push(P(new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4), 0xd9467a, { p: [bX, y0 + 3.25, bZ], s: [4.3, 1.3, 2.9], tip: 0xf58ab0, lit: 0.1 }))
  S.push(box(0.95, 1.6, 0.08, 0x7a4422, [bX - 1.3, y0 + 0.8, bZ + 1.53]))
  S.push(P(cyl(0.475, 0.475, 0.08, 12).rotateX(Math.PI / 2), 0x7a4422, { p: [bX - 1.3, y0 + 1.6, bZ + 1.53] }))
  S.push(box(1.5, 0.95, 0.08, 0xa4e6ff, [bX + 1.1, y0 + 1.5, bZ + 1.53]))
  S.push(box(1.64, 0.07, 0.12, 0xffffff, [bX + 1.1, y0 + 1.98, bZ + 1.53]), box(1.64, 0.07, 0.12, 0xffffff, [bX + 1.1, y0 + 1.02, bZ + 1.53]))
  // cobertura das bombas
  const cX = -1.3, cZ = 1.6
  S.push(box(6.5, 0.3, 4.4, 0xfdf6e3, [cX, 3.95, cZ], { grad: [0.85, 1.05] }), box(6.54, 0.14, 4.44, 0xe8453c, [cX, 3.74, cZ]))
  for (const [dx, dz] of [[-2.8, -1.8], [2.8, -1.8], [-2.8, 1.8], [2.8, 1.8]]) S.push(P(cyl(0.15, 0.17, 3.6, 8), 0xf6eedb, { p: [cX + dx, y0 + 1.8, cZ + dz], grad: [0.8, 1.05] }))
  for (const dx of [-1.1, 1.1]) {
    S.push(box(0.62, 1.25, 0.46, 0xe8453c, [cX + dx, y0 + 0.62, cZ], { grad: [0.8, 1.05] }), box(0.66, 0.3, 0.5, 0x2c3140, [cX + dx, y0 + 1.4, cZ]))
    S.push(box(0.4, 0.3, 0.04, 0x6ad0ff, [cX + dx, y0 + 0.95, cZ + 0.24]), box(0.1, 0.5, 0.14, 0x2c3140, [cX + dx + 0.37, y0 + 0.8, cZ]))
  }
  // placa redonda no alto de um poste
  S.push(P(cyl(0.1, 0.12, 5.4, 8), 0xa2a9bc, { p: [-4.6, y0 + 2.7, -3.6] }))
  S.push(P(cyl(0.95, 0.95, 0.22, 18).rotateX(Math.PI / 2), 0xe8453c, { p: [-4.6, y0 + 5.5, -3.6] }))
  S.push(P(cyl(0.7, 0.7, 0.26, 18).rotateX(Math.PI / 2), 0xffd23a, { p: [-4.6, y0 + 5.5, -3.6] }))
  // tambores
  for (const [dx, dz, c] of [[4, -0.2, 0xe8453c], [4, 0.8, 0x4a8fe8]]) S.push(P(cyl(0.3, 0.3, 0.9, 10), c, { p: [dx, y0 + 0.45, dz], grad: [0.75, 1.05], fn: capLight(1.3) }))
  return S
}

export function BuildGas(parent, { x: sx, z: sz }, cols, shadows) {
  const solid = new THREE.Mesh(once('gas', () => merge(gasParts())), MAT.solid)
  const lamp = new THREE.Mesh(once('gasGlow', () => merge([box(5.7, 0.05, 3.7, 0xfff4c0, [-1.3, 3.55, 1.6])])), MAT.glow)
  for (const m of [solid, lamp]) { m.position.set(sx, 0, sz); parent.add(m) }
  // colisores (mesmos números de antes)
  col(cols, sx + 1.8, sz - 2.6, 2.5, 1.5)
  for (const [dx, dz] of [[-2.8, -1.8], [2.8, -1.8], [-2.8, 1.8], [2.8, 1.8]]) col(cols, sx - 1.3 + dx, sz + 1.6 + dz, 0.2, 0.2)
  for (const dx of [-1.1, 1.1]) col(cols, sx - 1.3 + dx, sz + 1.6, 0.35, 0.3, 1.7)
  col(cols, sx - 4.6, sz - 3.6, 0.2, 0.2)
  for (const dz of [-0.2, 0.8]) col(cols, sx + 4, sz + dz, 0.3, 0.3, 0.95)
  shadows.push({ x: sx + 1.4, z: sz - 2.6, rx: 3.3, rz: 2.3 }, { x: sx - 1.8, z: sz + 1.6, rx: 3.8, rz: 2.8 }, { x: sx + 4, z: sz + 0.3, rx: 0.9, rz: 1.1 })
}

// ---------------- poste de madeira (3 variantes) + cabos com curva ----------------
const IRON = 0x8d93a3, WIRE = 0x1d1f27
function poleGeo(variant) {
  const parts = [
    P(cyl(0.12, 0.18, 7.1, 7), 0x9a6a3a, { p: [0, 3.55, 0], grad: [0.6, 1.05] }),
    P(cyl(0.125, 0.125, 0.04, 7), 0xcaa070, { p: [0, 7.1, 0] }), // topo cortado
    box(2.1, 0.14, 0.14, 0x7a4f2a, [0, 6.55, 0]),
    box(0.1, 0.1, 0.5, 0x7a4f2a, [0, 6.35, 0]), // travessa da cruzeta
  ]
  for (const sd of [-1, 1]) {
    parts.push(P(bx(0.07, 0.7, 0.07), 0x7a4f2a, { p: [sd * 0.45, 6.2, 0], r: [0, 0, sd * 0.85] })) // mãos-francesas
    parts.push(P(cyl(0.06, 0.06, 0.2, 6), 0x66d0c8, { p: [sd * 0.9, 6.7, 0] }), P(cyl(0.03, 0.03, 0.08, 6), IRON, { p: [sd * 0.9, 6.62, 0] }))
  }
  parts.push(P(cyl(0.06, 0.06, 0.2, 6), 0x66d0c8, { p: [0, 7.22, 0] })) // isolador no topo
  // pregos / degraus de escalada: espetos curtos, alternando os lados, com cabeça
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]]
  for (let i = 0; i < 9; i++) {
    const [dx, dz] = dirs[i % 4], y = 1.7 + i * 0.44, len = 0.3
    const nail = cyl(0.028, 0.028, len, 5)
    if (dx) nail.rotateZ(Math.PI / 2); else nail.rotateX(Math.PI / 2)
    parts.push(P(nail, IRON, { p: [dx * (0.17 + len / 2 - 0.04), y, dz * (0.17 + len / 2 - 0.04)] }))
    parts.push(P(cyl(0.05, 0.05, 0.025, 6), 0x6e7384, { p: [dx * (0.17 + len - 0.03), y, dz * (0.17 + len - 0.03)], r: dx ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0] }))
  }
  // placa de numeração presa com 4 pregos + etiqueta
  parts.push(box(0.2, 0.3, 0.03, 0xe9ecf2, [0, 2.6, 0.2]))
  for (const [nx, ny] of [[-0.07, 2.72], [0.07, 2.72], [-0.07, 2.48], [0.07, 2.48]]) parts.push(P(cyl(0.015, 0.015, 0.06, 4).rotateX(Math.PI / 2), 0x555a68, { p: [nx, ny, 0.22] }))
  parts.push(box(0.14, 0.16, 0.025, 0xffd23a, [0, 4.2, 0.2])) // aviso amarelo
  parts.push(P(cyl(0.015, 0.015, 0.06, 4).rotateX(Math.PI / 2), 0x555a68, { p: [0, 4.26, 0.21] }), P(cyl(0.015, 0.015, 0.06, 4).rotateX(Math.PI / 2), 0x555a68, { p: [0, 4.14, 0.21] }))
  parts.push(P(cyl(0.2, 0.2, 0.5, 7), 0x6b4a2a, { p: [0, 0.25, 0] })) // base escurecida (creosoto)

  if (variant === 'trafo') {
    // transformador (cilindro cinza-esverdeado) numa plataforma, com buchas no topo e cabos até a cruzeta
    parts.push(box(0.9, 0.08, 0.5, 0x7a4f2a, [0.55, 5.35, 0]))
    parts.push(P(cyl(0.34, 0.34, 0.95, 10), 0x8aa097, { p: [0.62, 5.9, 0], grad: [0.8, 1.05], tip: 0xb5c9c0 }))
    parts.push(P(cyl(0.355, 0.355, 0.06, 10), 0x6d7f77, { p: [0.62, 5.55, 0] }), P(cyl(0.355, 0.355, 0.06, 10), 0x6d7f77, { p: [0.62, 6.25, 0] }))
    parts.push(P(cyl(0.06, 0.06, 0.2, 6), 0x66d0c8, { p: [0.5, 6.5, 0] }), P(cyl(0.06, 0.06, 0.2, 6), 0x66d0c8, { p: [0.74, 6.5, 0] }))
    parts.push(box(0.025, 0.4, 0.025, WIRE, [0.5, 6.5, 0]), box(0.025, 0.45, 0.025, WIRE, [0.88, 6.45, 0]))
    parts.push(box(0.26, 0.18, 0.03, 0xffd23a, [0.62, 5.9, 0.35])) // plaquinha de alta tensão
    parts.push(box(0.025, 1.4, 0.025, WIRE, [0.22, 4.9, 0.0]), box(0.5, 0.025, 0.025, WIRE, [0.4, 5.6, 0.0]))
  } else if (variant === 'double') {
    // segunda cruzeta, mais baixa e curta, para os cabos de serviço
    parts.push(box(1.5, 0.12, 0.12, 0x7a4f2a, [0, 5.75, 0]))
    for (const sd of [-1, 1]) parts.push(P(cyl(0.05, 0.05, 0.17, 6), 0x66d0c8, { p: [sd * 0.65, 5.88, 0] }))
    parts.push(box(0.3, 0.22, 0.12, 0x5d6372, [0.3, 5.3, 0.17])) // caixa de ligação
  }
  return merge(parts)
}
export function BuildPole(g, { x, z, ry = 0, variant = 'plain' }, cols, shadows) {
  const m = new THREE.Mesh(once(`pole_${variant}`, () => poleGeo(variant)), MAT.solid)
  m.position.set(x, 0, z)
  m.rotation.y = ry
  g.add(m)
  col(cols, x, z, 0.2, 0.2)
  shadows.push({ x: x - 0.3, z, rx: 0.4, rz: 0.4 })
}

// ---- cabos: caixas finas encadeadas numa curva (catenária); tudo do chunk vira UMA geometria ----
const _m = new THREE.Matrix4(), _q2 = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _u = new THREE.Vector3(0, 1, 0), _s1 = new THREE.Vector3(1, 1, 1)
function seg(parts, ax, ay, az, bx2, by, bz, th, color) {
  _a.set(ax, ay, az); _b.set(bx2, by, bz)
  const len = _a.distanceTo(_b)
  if (len < 1e-3) return
  const g = new THREE.BoxGeometry(th, th, len)
  _m.lookAt(_a, _b, _u)
  _q2.setFromRotationMatrix(_m)
  g.applyMatrix4(_m.compose(_a.clone().add(_b).multiplyScalar(0.5), _q2, _s1))
  parts.push(P(g, color))
}
// polilinha com flecha: de A a B, y(t) = linear − sag·4t(1−t)
function sagLine(parts, A, B, sag, n = 6, th = 0.04, color = WIRE) {
  let px = A[0], py = A[1], pz = A[2]
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = A[0] + (B[0] - A[0]) * t, z = A[2] + (B[2] - A[2]) * t, y = A[1] + (B[1] - A[1]) * t - sag * 4 * t * (1 - t)
    seg(parts, px, py, pz, x, y, z, th, color)
    px = x; py = y; pz = z
  }
}
// ponta de cabo arrebentado: sai do isolador, cai em arco e termina pendurada (com a ponta desencapada)
function dangling(parts, A, dirx, dirz, len, drop) {
  let px = A[0], py = A[1], pz = A[2]
  const n = 6
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = A[0] + dirx * len * t, z = A[2] + dirz * len * t, y = A[1] - drop * t * t
    seg(parts, px, py, pz, x, y, z, 0.04, WIRE)
    px = x; py = y; pz = z
  }
  seg(parts, px, py, pz, px + dirx * 0.1, py - 0.25, pz + dirz * 0.1, 0.05, 0xd9a24a) // cobre exposto
}
const TOP_Y = 6.85, LOW_Y = 5.9
export function BuildWires(parent, list, Height, Attach, dispose) {
  if (!list.length) return
  const parts = []
  for (const it of list) {
    if (it.type === 'span') {
      const { a, b } = it, ba = Height(a.x, a.z), bb = Height(b.x, b.z)
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz)
      for (const lat of [-0.9, 0.9]) {
        const A = Attach(a, lat, TOP_Y, ba), B = Attach(b, lat, TOP_Y, bb)
        if (it.broken && Math.sign(lat) === it.broken) {
          dangling(parts, A, dx / L, dz / L, 3.4, 4.6)
          dangling(parts, B, -dx / L, -dz / L, 2.6, 4.2)
        } else sagLine(parts, A, B, 0.55)
      }
      sagLine(parts, Attach(a, 0, 7.3, ba), Attach(b, 0, 7.3, bb), 0.5) // fio neutro do topo
    } else if (it.type === 'drop') {
      const p = it.p, bp = Height(p.x, p.z), lat = it.side * (p.variant === 'double' ? 0.65 : 0.9), y0 = p.variant === 'double' ? LOW_Y : TOP_Y
      const A = Attach(p, lat, y0, bp), T = [it.tx, Height(it.tx, it.tz) + 3.1, it.tz]
      sagLine(parts, A, T, 0.7, 8, 0.03)
      parts.push(P(bx(0.16, 0.16, 0.16), 0x5d6372, { p: [T[0], T[1], T[2]] })) // suporte na parede
    }
  }
  if (!parts.length) return
  const m = new THREE.Mesh(merge(parts), MAT.solid)
  m.matrixAutoUpdate = false
  parent.add(m)
  dispose.push(m.geometry)
}
