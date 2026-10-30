import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// =====================================================================================
//  Kit visual (estilo "diorama de brinquedo", tipo Link's Awakening) — pensado para FPS:
//  - tudo usa MeshLambertMaterial (iluminação barata) e cores por vértice
//  - peças de um mesmo objeto são FUNDIDAS numa geometria só (1 draw call em vez de dezenas)
//  - brilho/sombra "assados" nas cores dos vértices (AO falso, luz no topo): custo zero em runtime
//  - balanço do vento feito no vertex shader (GPU), sem nenhum custo de CPU
// =====================================================================================

export const wind = { value: 0 } // uniform compartilhado: index.js soma o tempo aqui
export const gust = { value: 1 } // força do vento (o clima muda): multiplica o balanço das plantas
// sombras falsas seguem o sol: off = vetor da sombra no chão (-sol.xz / sol.y), alpha = força (nublado/noite = fraca)
export const shade = { off: { value: new THREE.Vector2(-0.87, 0) }, alpha: { value: 1 } }

function sway(mat, amp, speed) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind
    sh.uniforms.uGust = gust
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uGust;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sw_h = max(position.y, 0.0);
        #ifdef USE_INSTANCING
          vec2 sw_p = instanceMatrix[3].xz;
        #else
          vec2 sw_p = vec2(0.0);
        #endif
        float sw_a = uWind * ${speed.toFixed(2)} + sw_p.x * 0.55 + sw_p.y * 0.4;
        transformed.x += (sin(sw_a) + 0.35 * sin(sw_a * 2.3 + 1.0)) * sw_h * ${amp.toFixed(4)} * uGust - sw_h * ${amp.toFixed(4)} * (uGust - 1.0) * 0.8;
        transformed.z += cos(sw_a * 0.9) * sw_h * ${(amp * 0.6).toFixed(4)} * uGust;`)
  }
  mat.customProgramCacheKey = () => `sway-${amp}-${speed}`
  return mat
}

function shadowTexture() {
  if (typeof document === 'undefined') return null
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')
    if (!x) return null
    const g = x.createRadialGradient(32, 32, 3, 32, 32, 32)
    g.addColorStop(0, 'rgba(24,64,12,0.62)')
    g.addColorStop(0.6, 'rgba(24,64,12,0.4)')
    g.addColorStop(1, 'rgba(24,64,12,0)')
    x.fillStyle = g
    x.fillRect(0, 0, 64, 64)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  } catch { return null }
}
const shTex = shadowTexture()

// As sombras dos chunks/entidades foram posicionadas com o sol fixo à direita (centro ~0.15 do tamanho para -x).
// Aqui o vertex shader desfaz esse deslocamento e aplica o do sol atual: desloca e estica na direção da sombra.
function sunShadow(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uShOff = shade.off
    sh.uniforms.uShA = shade.alpha
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uShOff;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec2 sh_c = instanceMatrix[3].xz;
          float sh_s = 0.5 * (length(instanceMatrix[0].xyz) + length(instanceMatrix[2].xyz));
        #else
          vec2 sh_c = vec2(0.0);
          float sh_s = 1.0;
        #endif
        float sh_l = length(uShOff);
        vec2 sh_d = sh_l > 1e-4 ? uShOff / sh_l : vec2(-1.0, 0.0);
        vec2 sh_r = mvPosition.xz - sh_c;
        sh_r += sh_d * dot(sh_r, sh_d) * sh_l * 0.4;
        mvPosition.xz = sh_c + sh_r + (vec2(0.15, 0.0) + uShOff * 0.17) * sh_s;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uShA;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= uShA;')
  }
  mat.customProgramCacheKey = () => 'sun-shadow'
  return mat
}

const lambert = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o })
export const MAT = {
  solid: lambert(),
  ground: lambert(),
  foliage: sway(lambert(), 0.012, 1.4), // copas das árvores
  grass: sway(lambert(), 0.12, 2.0), // capim alto
  flower: sway(lambert(), 0.08, 1.8),
  litter: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }), // olhos, lâmpadas
  flash: new THREE.MeshBasicMaterial({ color: 0xffd86a }),
  // sombra "de contato" falsa: um quad com gradiente radial (bem mais barato que shadow map)
  shadow: sunShadow(new THREE.MeshBasicMaterial({ map: shTex, color: shTex ? 0xffffff : 0x1c4a0e, opacity: shTex ? 1 : 0.3, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
}
export const SHADOW_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

// ---------- peças com cor por vértice ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color()

// P(geometria, cor, { p, r, s, tip, grad, lit, fn })
//  tip  = cor do topo (gradiente pela altura local)      grad = [fator embaixo, fator em cima] (AO falso)
//  lit  = quanto as faces voltadas pra cima clareiam      fn(c, nx,ny,nz, lx,ly,lz, t) = ajuste livre por vértice
function dropFaces(g, omit) {
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count / 3
  const keep = []
  for (let t = 0; t < n; t++) if (!omit(nor.getX(t * 3), nor.getY(t * 3), nor.getZ(t * 3))) keep.push(t)
  if (keep.length === n) return g
  const np = new Float32Array(keep.length * 9), nn = new Float32Array(keep.length * 9)
  keep.forEach((t, i) => { for (let k = 0; k < 9; k++) { np[i * 9 + k] = pos.array[t * 9 + k]; nn[i * 9 + k] = nor.array[t * 9 + k] } })
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(np, 3))
  out.setAttribute('normal', new THREE.BufferAttribute(nn, 3))
  return out
}

// extra options: omit(nx,ny,nz) -> true remove those faces; tri(c, cx,cy,cz, nx,ny,nz) per-face color tweak (centroid in part-local space)
export function P(geo, color, o = {}) {
  const { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], tip = null, grad = null, lit = 0, fn = null, tri = null, omit = null } = o
  let g = geo.index ? geo.toNonIndexed() : geo.clone()
  g.deleteAttribute('uv')
  if (omit) g = dropFaces(g, omit)
  g.computeBoundingBox()
  const bb = g.boundingBox, h = Math.max(bb.max.y - bb.min.y, 1e-6)
  const pos = g.attributes.position, nor = g.attributes.normal
  const base = new THREE.Color(color), top = tip != null ? new THREE.Color(tip) : null
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - bb.min.y) / h
    _c.copy(base)
    if (top) _c.lerp(top, t)
    if (grad) _c.multiplyScalar(grad[0] + (grad[1] - grad[0]) * t)
    if (lit) _c.multiplyScalar(1 + lit * nor.getY(i))
    if (fn) fn(_c, nor.getX(i), nor.getY(i), nor.getZ(i), pos.getX(i), pos.getY(i), pos.getZ(i), t)
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b
  }
  if (tri) {
    for (let t = 0; t < pos.count; t += 3) {
      const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3, cy = (pos.getY(t) + pos.getY(t + 1) + pos.getY(t + 2)) / 3, cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3
      for (let k = 0; k < 3; k++) {
        _c.setRGB(col[(t + k) * 3], col[(t + k) * 3 + 1], col[(t + k) * 3 + 2])
        tri(_c, cx, cy, cz, nor.getX(t), nor.getY(t), nor.getZ(t))
        col[(t + k) * 3] = _c.r; col[(t + k) * 3 + 1] = _c.g; col[(t + k) * 3 + 2] = _c.b
      }
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.applyMatrix4(_m.compose(_v.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(s[0], s[1], s[2])))
  return g
}

export function merge(parts) {
  const g = mergeGeometries(parts)
  g.computeBoundingSphere()
  parts.forEach((x) => x.dispose())
  return g
}

// atalhos de geometria
export const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d)
export const sph = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h)
export const cyl = (rt, rb, h, seg = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)
export const cone = (r, h, seg = 8, open = false) => new THREE.ConeGeometry(r, h, seg, 1, open)
export const cap = (r, l, rs = 8) => new THREE.CapsuleGeometry(r, l, 3, rs)
export const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d)
export const box = (w, h, d, color, p, o = {}) => P(bx(w, h, d), color, { p, ...o })
// tampas de troncos/postes mais claras (como as toras do jogo de referência)
export const capLight = (amount = 1.35) => (c, nx, ny) => { if (Math.abs(ny) > 0.9) c.multiplyScalar(amount) }

// prisma triangular (empena de telhado): base dw em z, altura rise em y, comprimento len em x; base apoiada em y=0 (sem face inferior)
export function prism(dw, rise, len) {
  const x0 = -len / 2, x1 = len / 2, hz = dw / 2
  const A0 = [x0, 0, -hz], B0 = [x0, 0, hz], C0 = [x0, rise, 0], A1 = [x1, 0, -hz], B1 = [x1, 0, hz], C1 = [x1, rise, 0]
  const ctr = [0, rise / 3, 0], pos = []
  const add = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const m = [(a[0] + b[0] + c[0]) / 3 - ctr[0], (a[1] + b[1] + c[1]) / 3 - ctr[1], (a[2] + b[2] + c[2]) / 3 - ctr[2]]
    if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) [b, c] = [c, b]
    pos.push(...a, ...b, ...c)
  }
  add(A0, B0, C0); add(A1, B1, C1); add(A0, A1, C1); add(A0, C1, C0); add(B0, B1, C1); add(B0, C1, C0)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}
