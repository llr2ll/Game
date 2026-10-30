import * as THREE from 'three'

// =====================================================================================
//  Iluminação pública que funciona: os postes acendem ao anoitecer (e na tempestade, como uma fotocélula)
//  e apagam ao amanhecer; os semáforos trocam verde → amarelo → vermelho, uma via de cada vez.
//  Barato para o FPS:
//  - vidro das luminárias e lentes dos semáforos: materiais COMPARTILHADOS (muda a cor uma vez, todos acendem)
//  - cone de luz, poça de luz no chão e halo: instanciados por chunk, shader aditivo de poucas linhas
//  - luz de verdade (SpotLight) só num punhado fixo (SPOTS) que vai para os postes mais perto dos jogadores;
//    a quantidade de luzes nunca muda, então o three nunca recompila os shaders
// =====================================================================================

const SPOTS = 6, SPOT_I = 16, SPOT_RANGE = 11, SPOT_DECAY = 1.5, SPOT_ANGLE = 0.68, SPOT_PEN = 0.7
const WARM = new THREE.Color(0xffd08a)
const night = { value: 0 } // 0 = apagado, 1 = aceso (compartilhado por todos os shaders abaixo)

// ---------- vidro: apagado é um vidro azulado; aceso, branco-quente acima de 1 (sem tone mapping = "brilha") ----------
export const LampGlassMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
const GLASS_OFF = new THREE.Color(0.55, 0.66, 0.72), GLASS_ON = new THREE.Color(1.6, 1.3, 0.8)
LampGlassMat.color.copy(GLASS_OFF)

const fx = (vertexShader, fragmentShader, o = {}) => new THREE.ShaderMaterial({
  uniforms: { uNight: night, uColor: { value: WARM } }, vertexShader, fragmentShader,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, ...o,
})
// cone de luz (apex no vidro, base no chão): mais forte no miolo e perto da lâmpada, some nas bordas e ao tocar o chão
const BeamMat = fx(`
  varying float vH; varying float vEdge;
  void main() {
    vec4 p = vec4(position, 1.0); vec3 apex = vec3(0.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; apex = instanceMatrix[3].xyz;
    #endif
    p = modelMatrix * p; apex = (modelMatrix * vec4(apex, 1.0)).xyz;
    vH = -position.y;
    vec2 n = normalize(p.xz - apex.xz + 1e-4), v = normalize(cameraPosition.xz - p.xz + 1e-4);
    vEdge = abs(dot(n, v));
    gl_Position = projectionMatrix * viewMatrix * p;
  }`, `
  uniform float uNight; uniform vec3 uColor; varying float vH; varying float vEdge;
  void main() {
    float a = uNight * 0.15 * pow(vEdge, 1.4) * (1.0 - 0.55 * vH) * smoothstep(0.0, 0.1, vH) * (1.0 - smoothstep(0.8, 1.0, vH));
    gl_FragColor = vec4(uColor, a);
  }`, { side: THREE.DoubleSide })
// poça de luz no chão: disco com queda suave
const PoolMat = fx(`
  varying float vD;
  void main() {
    vD = length(position.xz);
    vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
    #endif
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
  }`, `
  uniform float uNight; uniform vec3 uColor; varying float vD;
  void main() { float k = 1.0 - vD * vD; gl_FragColor = vec4(uColor, uNight * 0.3 * k * k); }`, { polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 })
// halo em volta do vidro: quad virado para a câmera
const HaloMat = fx(`
  varying vec2 vUv;
  void main() {
    vec3 c = vec3(0.0); float s = 1.0;
    #ifdef USE_INSTANCING
      c = instanceMatrix[3].xyz; s = length(instanceMatrix[0].xyz);
    #endif
    vec4 mv = viewMatrix * modelMatrix * vec4(c, 1.0);
    mv.xy += position.xy * s;
    mv.z += 0.3; // um pouco para a frente: não some dentro do vidro
    vUv = position.xy;
    gl_Position = projectionMatrix * mv;
  }`, `
  uniform float uNight; uniform vec3 uColor; varying vec2 vUv;
  void main() { float k = max(0.0, 1.0 - length(vUv) * 2.0); gl_FragColor = vec4(uColor, uNight * 0.6 * k * k * k); }`)
const BEAM_GEO = new THREE.ConeGeometry(1, 1, 18, 1, true).translate(0, -0.5, 0) // apex em y = 0, base (raio 1) em y = -1
const POOL_GEO = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2)
const HALO_GEO = new THREE.PlaneGeometry(1, 1)

// lamps: [{ x, y, z (vidro), gy (chão sob o vidro), r (raio no chão), halo, spot }] -> 3 draw calls por chunk
const _m4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion()
export function BuildLampFx(g, lamps, dispose) {
  if (!lamps.length) return
  const mk = (geo, mat, place, order) => {
    const im = new THREE.InstancedMesh(geo, mat, lamps.length)
    lamps.forEach((l, i) => { place(l); im.setMatrixAt(i, _m4.compose(_p, _q, _s)) })
    im.renderOrder = order
    g.add(im)
    dispose.push(im)
  }
  mk(POOL_GEO, PoolMat, (l) => { _p.set(l.x, l.gy + 0.04, l.z); _s.set(l.r * 1.35, 1, l.r * 1.35) }, 2)
  mk(BEAM_GEO, BeamMat, (l) => { _p.set(l.x, l.y, l.z); _s.set(l.r, l.y - l.gy, l.r) }, 6)
  mk(HALO_GEO, HaloMat, (l) => { _p.set(l.x, l.y + 0.08, l.z); _s.setScalar(l.halo) }, 7)
}

// ---------- semáforos: 2 fases (uma por via), lentes 0 vermelho · 1 amarelo · 2 verde ----------
const GREEN = 9, YELLOW = 2.5, ALL_RED = 1.5, HALF = GREEN + YELLOW + ALL_RED, CYCLE = HALF * 2
const T_ON = [0xff3b2f, 0xffc23a, 0x3bff7a].map((c) => new THREE.Color(c)), T_OFF = [0x3a1714, 0x3a3014, 0x143a22].map((c) => new THREE.Color(c))
export const TrafficMat = [0, 1].map(() => [0, 1, 2].map((c) => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: T_OFF[c] })))
// qual lente está acesa na fase g no instante t
export function TrafficState(t, g) { const u = (t + g * HALF) % CYCLE; return u < GREEN ? 2 : u < GREEN + YELLOW ? 1 : 0 }

// alvo do acendimento: acende ~17h50–18h20, apaga ~5h45–6h05 (t: 0 = meia-noite, 0.5 = meio-dia); tempestade = noite
const sm = THREE.MathUtils.smoothstep
export const LampTarget = (t, over = 0) => Math.max(t < 0.5 ? 1 - sm(t, 0.24, 0.255) : sm(t, 0.745, 0.765), over >= 0.8 ? 1 : 0)

export function CreateStreetLights(scene) {
  const spots = []
  for (let i = 0; i < SPOTS; i++) {
    const s = new THREE.SpotLight(WARM, 0, SPOT_RANGE, SPOT_ANGLE, SPOT_PEN, SPOT_DECAY)
    s.position.set(0, -50, 0); s.target.position.set(0, -60, 0)
    scene.add(s, s.target)
    spots.push(s)
  }
  let t = 0, scanT = 0, near = Infinity
  const cand = []
  const loaded = new Set() // postes dos chunks carregados (o jogo põe e tira junto com os chunks)
  return {
    add(list) { if (list && list.length) loaded.add(list) },
    remove(list) { loaded.delete(list) },
    reset() { loaded.clear() },
    // para o som: quão aceso (0..1) e a distância do poste aceso mais perto de alguém
    get lit() { return night.value },
    get near() { return near },
    // time = hora do clima (0..1), over = céu fechado do tempo atual, focus = jogadores (ou o centro do menu)
    update(dt, time, over, focus) {
      t += dt
      // aquece/esfria devagar, como lâmpada de rua de verdade
      night.value += (LampTarget(time, over) - night.value) * (1 - Math.exp(-dt * 1.5))
      if (night.value < 0.002) night.value = 0
      const on = night.value > 0
      LampGlassMat.color.copy(GLASS_OFF).lerp(GLASS_ON, night.value)
      BeamMat.visible = PoolMat.visible = HaloMat.visible = on
      for (let g = 0; g < 2; g++) { const lit = TrafficState(t, g); for (let c = 0; c < 3; c++) TrafficMat[g][c].color.copy(c === lit ? T_ON[c] : T_OFF[c]) }

      // as SPOTS luzes de verdade vão para os postes mais perto de alguém (reavalia 4x por segundo)
      if ((scanT -= dt) <= 0) {
        scanT = 0.25
        cand.length = 0
        if (on) for (const list of loaded) for (const l of list) {
          if (!l.spot) continue
          let d = Infinity
          for (const f of focus) d = Math.min(d, (f.x - l.x) ** 2 + (f.z - l.z) ** 2)
          if (d < 900) cand.push([d, l])
        }
        cand.sort((a, b) => a[0] - b[0])
        near = cand.length ? Math.sqrt(cand[0][0]) : Infinity
        spots.forEach((s, i) => {
          const l = cand[i] && cand[i][1]
          if (!l) { s.userData.l = null; return }
          s.userData.l = l
          s.position.set(l.x, l.y - 0.05, l.z)
          s.target.position.set(l.x, l.gy, l.z)
        })
      }
      for (const s of spots) s.intensity = s.userData.l ? SPOT_I * night.value : 0
    },
  }
}
