import * as THREE from 'three'
import { WATER_Y, BridgesNear, WaterSD } from './water'
import { wind } from '../../engine/render/style'
import { P, merge, box } from '../../engine/render/style'
import { CHUNK_SIZE, ROAD_HALF } from './layout'

// Água no estilo da referência: azul vivo, mais claro no raso, contorno de espuma branca ondulando na margem
// e brilhos animados — tudo num MeshBasicMaterial com um pedacinho de shader (sem reflexo/PBR: custo mínimo).
// A profundidade (nível da água - chão) vai num atributo por vértice e a GPU interpola.
export const WaterMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
WaterMat.onBeforeCompile = (sh) => {
  sh.uniforms.uTime = wind
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aDepth;\nvarying float vD;\nvarying vec2 vW;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvD = aDepth;\nvW = (modelMatrix * vec4(position, 1.0)).xz;')
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vD;\nvarying vec2 vW;')
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
      float d = clamp(vD / 1.1, 0.0, 1.0);
      vec3 col = mix(vec3(0.45, 0.86, 0.95), vec3(0.12, 0.46, 0.82), smoothstep(0.05, 0.9, d));
      // anel de espuma que respira na margem
      float wob = 0.035 * sin(vW.x * 2.3 + uTime * 1.7) + 0.035 * sin(vW.y * 1.9 - uTime * 1.3);
      float foam = 1.0 - smoothstep(0.07, 0.15, vD + wob);
      float foam2 = (1.0 - smoothstep(0.0, 0.035, abs(vD - 0.24 - wob * 1.5))) * 0.55; // segunda linha, mais fina
      // brilhos: cristas de duas ondas cruzadas
      float r = sin(vW.x * 0.9 + sin(vW.y * 0.7 + uTime * 0.6) * 1.8 + uTime * 0.9) * sin(vW.y * 1.15 - uTime * 0.7 + sin(vW.x * 0.55) * 1.6);
      float spark = smoothstep(0.86, 0.93, r) * smoothstep(0.25, 0.6, vD);
      col = mix(col, vec3(1.0), clamp(max(max(foam, foam2), spark * 0.8), 0.0, 1.0));
      vec4 diffuseColor = vec4(col, 1.0);`)
}
WaterMat.customProgramCacheKey = () => 'water-la'

// malha da água do chunk: mesma grade de 1 m do terreno; só entram quadrados com algum canto abaixo da água
// h(i, j) = altura do terreno no vértice (i, j) do chunk (0..CHUNK_SIZE)
export function BuildWater(g, ox, oz, h, dispose) {
  const N = CHUNK_SIZE
  let any = false
  for (let j = 0; j <= N && !any; j++) for (let i = 0; i <= N; i++) if (h(i, j) < WATER_Y + 0.02) { any = true; break }
  if (!any) return
  const pos = [], dep = []
  const X = (i) => ox - 0.5 + i, Z = (j) => oz - 0.5 + j
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1)
    if (Math.min(a, b, c, d) >= WATER_Y + 0.02) continue
    if (WaterSD(X(i) + 0.5, Z(j) + 0.5) > 2) continue // só lagos/rios de verdade
    const v = [[i, j, a], [i, j + 1, c], [i + 1, j + 1, d], [i, j, a], [i + 1, j + 1, d], [i + 1, j, b]]
    for (const [ii, jj, hh] of v) { pos.push(X(ii), WATER_Y, Z(jj)); dep.push(WATER_Y - hh) }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1))
  const nrm = new Float32Array(pos.length); for (let k = 1; k < nrm.length; k += 3) nrm[k] = 1
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  geo.computeBoundingSphere()
  g.add(new THREE.Mesh(geo, WaterMat))
  dispose.push(geo)
}

// pontes de pedra onde o rio passa por baixo da estrada (só a parte que cai neste chunk)
export function BuildBridges(g, ox, oz, cols, dispose, MAT) {
  const x0 = ox - 0.5, x1 = x0 + CHUNK_SIZE, z0 = oz - 0.5, z1 = z0 + CHUNK_SIZE
  const parts = []
  for (const b of BridgesNear(x0, x1, z0, z1)) {
    if (b.z < z0 || b.z >= z1 || b.x < x0 || b.x >= x1) continue // cada ponte pertence ao chunk do seu centro
    const L = b.half * 2
    for (const s of [-1, 1]) {
      const x = b.x + s * (ROAD_HALF + 1.55)
      parts.push(box(0.42, 0.62, L, 0xb8b2a2, [x, 0.31, b.z], { grad: [0.85, 1.08], lit: 0.1 }))
      parts.push(box(0.52, 0.1, L + 0.1, 0xd4cebf, [x, 0.66, b.z], { lit: 0.2 }))
      for (const e of [-1, 1]) parts.push(box(0.6, 0.85, 0.6, 0xa9a392, [x, 0.42, b.z + e * (b.half + 0.25)], { grad: [0.85, 1.08] }))
      // cabeceira sobre o rio: parede de pedra descendo até o leito, com a boca escura do túnel
      const fx = b.x + s * (ROAD_HALF + 1.75)
      parts.push(box(0.4, 1.9, L, 0x948d7d, [fx, -0.9, b.z], { grad: [0.55, 1.0] }))
      parts.push(box(0.05, 1.05, (b.half - 2.6) * 2 + 0.6, 0x1b2733, [fx + s * 0.21, -1.0, b.z]))
      parts.push(box(0.12, 0.18, (b.half - 2.6) * 2 + 1.0, 0xc9c3b3, [fx + s * 0.22, -0.4, b.z], { lit: 0.2 }))
      cols.push({ x, z: b.z, hw: 0.26, hd: b.half + 0.55 })
    }
  }
  if (!parts.length) return
  const geo = merge(parts)
  g.add(new THREE.Mesh(geo, MAT.solid))
  dispose.push(geo)
}
