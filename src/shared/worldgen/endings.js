import { hash } from '../../engine/world/noise'
import { EndsNear } from './layout'

// Finais de estrada: obra, praça redonda com bancos, mato, mini-praça de rua local.
// Tudo calculado a partir da ponta (E = fim do asfalto, u = sentido para fora da estrada, l = lateral). Função pura (cache por ponta).
// Saída: discs/rects (decalques de chão), objs (peças), plants (árvores etc. nas listas do Seed), signs (descritores de placa).
function rng(seed) {
  let s = Math.floor(seed * 4294967295) | 0 || 1
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296 }
}
const cache = new Map()

export function PlaceEnd(e) {
  if (cache.has(e.id)) return cache.get(e.id)
  const R = rng(hash(e.x * 3, e.z * 3, 410))
  const { ux, uz } = e, lx = -uz, lz = ux
  const W = (t, w) => [e.x + ux * t + lx * w, e.z + uz * t + lz * w]
  const alongZ = uz !== 0 // a estrada corre ao longo de z => lateral é x
  const ryLat = alongZ ? 0 : Math.PI / 2 // peça com eixo longo em x que deve ficar ao longo da lateral
  const ryAxis = alongZ ? Math.PI / 2 : 0 // peça com eixo longo ao longo de u
  const out = { discs: [], rects: [], objs: [], trees: [], bushes: [], rocks: [], logs: [], tufts: [], signs: [], block: { x: e.px, z: e.pz, r: e.kind === 'art' ? 13 : 9 } }
  // ocupação no espaço local (t, w): cada peça guarda a meia-extensão; peças soltas (cones) só entram em lugar livre
  const taken = []
  const FOOT = { barrier: [0.35, 1.0], cone: [0.25, 0.25], bollard: [0.15, 0.15], dirt: [2.0, 2.0], pipes: [0.9, 1.3], tfence: [0.15, 1.3], excavator: [1.5, 2.1], bench: [0.4, 1.0], lamp: [0.3, 0.3] }
  const foot = (type, ry) => { const [a, b] = FOOT[type] || [0.3, 0.3]; return Math.abs(Math.sin(ry - ryLat)) > 0.7 ? [b, a] : [a, b] } // [ao longo de u, lateral]
  const isFree = (type, t, w, ry = 0, m = 0.1) => { const [ft, fw] = foot(type, ry); return taken.every((o) => Math.abs(o.t - t) >= o.ft + ft + m || Math.abs(o.w - w) >= o.fw + fw + m) }
  const obj = (type, t, w, ry = 0, s = 1) => { const [x, z] = W(t, w), [ft, fw] = foot(type, ry); taken.push({ t, w, ft, fw }); out.objs.push({ type, x, z, ry, s }) }
  // peça solta: tenta alguns sorteios e desiste se não achar lugar (nunca nasce uma em cima da outra)
  const loose = (type, pick, ry = 0) => { for (let k = 0; k < 6; k++) { const [t, w] = pick(); if (isFree(type, t, w, ry)) return obj(type, t, w, ry) } }
  const rect = (t0, t1, w0, w1, mat) => { const [x, z] = W((t0 + t1) / 2, (w0 + w1) / 2); out.rects.push({ x, z, w: alongZ ? Math.abs(w1 - w0) : Math.abs(t1 - t0), d: alongZ ? Math.abs(t1 - t0) : Math.abs(w1 - w0), mat }) }
  const sign = (t, w, key, sz = 0.7, y = 1.8, h = 2.4) => { const [x, z] = W(t, w); out.signs.push({ kind: 'sign', poles: [[x, z]], postH: h, plates: [{ cx: x, cz: z, y, fx: -ux, fz: -uz, w: sz, h: sz, key }] }) }
  const hw = e.hw

  if (e.type === 'work') {
    const big = e.kind === 'art', n = big ? 3 : 2, t0 = big ? 0.4 : 2.4 // ruas locais: nada antes de 2,4 m (casas dos quarteirões colam no fim da rua)
    for (let k = 0; k < n; k++) obj('barrier', -1.4, (k - (n - 1) / 2) * 2.0, ryLat)
    for (const w of [-n - 0.35, n + 0.35]) obj('cone', -1.4, w) // nas pontas da fileira de barreiras (não dentro dela)
    // cones guiando quem chega; nas ruas locais o cruzamento fica só 8 m antes da ponta: uma fileira só, antes da faixa de pedestre
    for (const t of big ? [-4, -7, -10] : [-2.8]) for (const w of [-hw + 0.6, hw - 0.6]) obj('cone', t + R() * 0.5, w + (R() - 0.5) * 0.3)
    sign(-13, hw + 1.0, 'work')
    if (big) sign(-19, hw + 1.0, 'speed:30')
    const half = big ? 6.5 : 4.5
    rect(t0, 7.2, -half, half, 'dirt')
    rect(Math.max(2.6, t0 + 0.4), 8.6 - (big ? 0 : 1.5), -0.5, 0.9, 'trench')
    // grade provisória em U (antes das peças soltas, para elas desviarem dela)
    const back = big ? 8.2 : 7.0, nBack = big ? 5 : 3
    for (let k = 0; k < nBack; k++) obj('tfence', back, (k - (nBack - 1) / 2) * 2.5, ryLat)
    for (const w of [-half - 1.2, half + 1.2]) for (let t = t0 + 1.2; t < back - 1; t += 2.5) obj('tfence', t, w, ryAxis)
    if (big) {
      obj('excavator', 3.6, -3.4, ryLat + (R() > 0.5 ? 0 : Math.PI))
      obj('dirt', 2.4, 4.4, R() * 6)
      obj('pipes', 5.9, 2.0, ryAxis)
    } else {
      obj('dirt', 3.4, -2.6, R() * 6)
      obj('pipes', 5.0, 2.2, ryAxis)
    }
    for (let k = 0; k < 4; k++) loose('cone', () => [t0 + 0.4 + R() * 4.6, (R() - 0.5) * 2 * (half - 0.8)])
  } else if (e.type === 'park') {
    // rotatória-praça: asfalto (r 8), meio-fio (r 5), gramado (r 4,6) com árvores, bancos e lampião
    const [cx, cz] = W(3, 0)
    out.discs.push({ x: cx, z: cz, r: 8, mat: 'asphalt' }, { x: cx, z: cz, r: 5.0, mat: 'curb' }, { x: cx, z: cz, r: 4.6, mat: 'grass' })
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, bx = cx + Math.cos(a) * 3.2, bz = cz + Math.sin(a) * 3.2
      out.objs.push({ type: 'bench', x: bx, z: bz, ry: Math.atan2(-Math.cos(a), -Math.sin(a)), s: 1 })
    }
    out.objs.push({ type: 'lamp', x: cx, z: cz, ry: 0, s: 1 })
    for (const [dx, dz] of [[1.5, 1.5], [-1.5, -1.5]]) out.trees.push({ x: cx + dx, z: cz + dz, s: 1.0 + R() * 0.2, k: 0.5 + R() * 0.4 })
    for (const [dx, dz] of [[1.6, -1.6], [-1.6, 1.6], [0, 2.4], [0, -2.4]]) out.bushes.push({ x: cx + dx, z: cz + dz, s: 0.8, c: R() })
    for (let k = 0; k < 10; k++) { const a = R() * 6.28, r = 1 + R() * 3.3; out.tufts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, s: 0.6 + R() * 0.4, ry: R() * 6, c: R() }) }
    // flores no gramado: viram tufos coloridos via lista de flores
    out.flowers = []
    for (let k = 0; k < 14; k++) { const a = R() * 6.28, r = 1 + R() * 3.4; out.flowers.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, s: 1, ry: R() * 6, c: Math.floor(R() * 5) }) }
    out.block.x = cx; out.block.z = cz; out.block.r = 14
  } else if (e.type === 'wild') {
    // a estrada morre no mato: areia invadindo o asfalto, tronco caído, arbustos, pedras e árvores fechando o caminho
    out.softRects = [{ ...(() => { const [x, z] = W(-1.2, 0); return { x, z } })(), w: alongZ ? 5.6 : 3.4, d: alongZ ? 3.4 : 5.6, color: 0xd9b979 }]
    rect(0.5, 4.5, -3.6, 3.6, 'dirt')
    sign(0.9, 0, 'deadend', 0.7, 1.6, 2.2)
    obj('bollard', 0.2, -2.2); obj('bollard', 0.2, 2.2)
    { const [x, z] = W(2.6, 0); out.logs.push({ x, z, len: 5.2, t: 1.0, ry: ryLat }) }
    for (let k = 0; k < 9; k++) { const [x, z] = W(3 + R() * 2.8, (R() - 0.5) * 9); out.bushes.push({ x, z, s: 0.8 + R() * 0.6, c: R() }) }
    for (let k = 0; k < 16; k++) { const [x, z] = W(1.5 + R() * 5, (R() - 0.5) * 9); out.tufts.push({ x, z, s: 1 + R() * 0.6, ry: R() * 6, c: R() }) }
    for (let k = 0; k < 3; k++) { const [x, z] = W(2 + R() * 4, (R() - 0.5) * 8); out.rocks.push({ x, z, s: 0.7 + R() * 0.8, ry: R() * 6 }) }
    for (const w of [-3.4, 0.5, 3.6]) { const [x, z] = W(6 + R() * 1.5, w); out.trees.push({ x, z, s: 0.9 + R() * 0.3, k: R() }) }
  } else if (e.type === 'pocket') {
    rect(0.2, 6.4, -hw - 1.2, hw + 1.2, 'paved')
    for (const w of [-hw + 0.1, hw - 0.1]) obj('bench', 3.0, w * 1.0, Math.atan2(-lx * Math.sign(w), -lz * Math.sign(w)))
    obj('bollard', 0.6, -1.5); obj('bollard', 0.6, 0); obj('bollard', 0.6, 1.5)
    obj('lamp', 2.8, hw + 0.9)
    { const [x, z] = W(4.4, 0); out.trees.push({ x, z, s: 1.0, k: 0.6 }) }
    for (const w of [-2.4, 2.4]) { const [x, z] = W(5.4, w); out.bushes.push({ x, z, s: 0.8, c: R() }) }
  }
  cache.set(e.id, out)
  return out
}

export function PlacesNear(x0, x1, z0, z1) { return EndsNear(x0, x1, z0, z1).map((e) => ({ e, p: PlaceEnd(e) })) }
