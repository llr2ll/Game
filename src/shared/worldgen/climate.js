import * as THREE from 'three'
import { gust, shade } from '../../engine/render/style'
import { events } from '../../engine/core/events'

// =====================================================================================
//  Clima: ciclo dia/noite (nascer e pôr do sol, lua), tempo (limpo, nublado, chuva, tempestade, neblina)
//  e vento de desenho animado (rabiscos brancos com laçada, como em Link's Awakening).
//  Tudo barato: cores das luzes/névoa mudam na CPU; sombras de nuvem e chão molhado são algumas linhas
//  no shader Lambert; a chuva é UM LineSegments animado na GPU; o vento são poucas fitas com ~100 vértices.
//  Teclas: N = avança 1 hora · K = próximo tempo (Shift+K = troca na hora, sem transição)
// =====================================================================================

const DAY_SECONDS = 600 // um dia inteiro dura 10 minutos (padrão; o jogo pode passar daySeconds)
const TRANSITION = 25 // segundos para mudar de um tempo para outro

// ---------- sombras de nuvem + chão molhado: injetados em TODOS os MeshLambertMaterial ----------
// Uniforms como objetos simples {x,y,z,w}: o three clona Vector4, mas copia objetos comuns por referência,
// então todos os materiais Lambert compartilham os mesmos valores sem precisar tocar em cada um.
const CLOUD = { x: 0, y: 0, z: 0, w: 0 } // deslocamento x/z das nuvens, cobertura 0..1, escuridão da sombra
const WET = { x: 0, y: 0, z: 0, w: 0 } // x = chão molhado 0..1, y = clarão do relâmpago
{
  const lib = THREE.ShaderLib.lambert
  lib.uniforms.uCloud = { value: CLOUD }
  lib.uniforms.uWet = { value: WET }
  lib.vertexShader = lib.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vCloudW;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 cl_w = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cl_w = instanceMatrix * cl_w;
        #endif
        vCloudW = (modelMatrix * cl_w).xz;
      }`)
  lib.fragmentShader = lib.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform vec4 uCloud;
      uniform vec4 uWet;
      varying vec2 vCloudW;
      float cl_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float cl_n(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(cl_h(i), cl_h(i + vec2(1.0, 0.0)), f.x), mix(cl_h(i + vec2(0.0, 1.0)), cl_h(i + 1.0), f.x), f.y);
      }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= 1.0 - uWet.x * 0.2;`)
    .replace('#include <aomap_fragment>', `#include <aomap_fragment>
      if (uCloud.z > 0.001) {
        vec2 cl_p = (vCloudW + uCloud.xy) * 0.03;
        float cl = cl_n(cl_p) * 0.65 + cl_n(cl_p * 2.3 + 7.0) * 0.35;
        // borda bem marcada: manchas de nuvem "de desenho", não um borrão
        float cl_m = smoothstep(1.0 - uCloud.z, 1.0 - uCloud.z + 0.05, cl);
        reflectedLight.directDiffuse *= 1.0 - cl_m * uCloud.w;
      }
      reflectedLight.indirectDiffuse += diffuseColor.rgb * uWet.y;`)
}

// ---------- paleta do dia (t: 0 = meia-noite, 0.25 = 6h, 0.5 = meio-dia, 0.75 = 18h) ----------
// top/mid/bot = gradiente do céu · fog · hs/hg/hi = luz de céu, de chão e intensidade · sc/si = sol (ou lua)
const KEYS = [
  [0.00, { top: '#0b1640', mid: '#1c2b5c', bot: '#2a3a6e', fog: '#1e2a55', hs: '#8e9cc8', hg: '#3a4656', hi: 1.15, sc: '#a8bcf0', si: 0.6 }],
  [0.21, { top: '#1d2a66', mid: '#4a4a8a', bot: '#7a5a9a', fog: '#4a4a80', hs: '#a0a0d0', hg: '#4a4a60', hi: 1.2, sc: '#b0b8ff', si: 0.3 }],
  [0.26, { top: '#6a9ee0', mid: '#f0b890', bot: '#ffa868', fog: '#f0b088', hs: '#ffd0b0', hg: '#8a8a60', hi: 1.55, sc: '#ff9a50', si: 1.4 }],
  [0.34, { top: '#78c8f0', mid: '#d8f0d8', bot: '#f0f6c0', fog: '#d8eeb0', hs: '#eef6ff', hg: '#aac860', hi: 2.0, sc: '#fff0d8', si: 1.8 }],
  [0.50, { top: '#78c8f0', mid: '#cdeccf', bot: '#eef6b0', fog: '#cfeaa0', hs: '#e6f4ff', hg: '#aac860', hi: 2.15, sc: '#fff6e0', si: 2.0 }],
  [0.66, { top: '#78c8f0', mid: '#cdeccf', bot: '#eef6b0', fog: '#cfeaa0', hs: '#e6f4ff', hg: '#aac860', hi: 2.1, sc: '#fff1d0', si: 1.9 }],
  [0.735, { top: '#5a78c8', mid: '#f0a080', bot: '#ff9058', fog: '#f09a78', hs: '#ffc0a0', hg: '#9a7a50', hi: 1.5, sc: '#ff8040', si: 1.5 }],
  [0.79, { top: '#24306a', mid: '#5a4a80', bot: '#8a5a8a', fog: '#5a4a7a', hs: '#a69ac8', hg: '#4a4060', hi: 1.2, sc: '#c0b0ff', si: 0.3 }],
  [1.00, null], // = 0.00
].map(([t, k]) => [t, k && Object.fromEntries(Object.entries(k).map(([n, v]) => [n, typeof v === 'string' ? new THREE.Color(v) : v]))])
KEYS[KEYS.length - 1][1] = KEYS[0][1]

// ---------- tipos de tempo ----------
// cloud = cobertura das sombras de nuvem · over = céu fechado (escurece e tira a cor) · rain · fog · wind = força do vento
const WEATHER = {
  clear: { name: 'Limpo', icon: '☀️', w: 4, cloud: 0.18, over: 0, rain: 0, fog: 0, wind: 1 },
  cloudy: { name: 'Nublado', icon: '⛅', w: 3, cloud: 0.5, over: 0.3, rain: 0, fog: 0.05, wind: 1.5 },
  rain: { name: 'Chuva', icon: '🌧️', w: 2, cloud: 0.8, over: 0.65, rain: 0.55, fog: 0.25, wind: 1.8 },
  storm: { name: 'Tempestade', icon: '⛈️', w: 1, cloud: 0.95, over: 0.85, rain: 1, fog: 0.35, wind: 2.8, bolts: true },
  fog: { name: 'Neblina', icon: '🌫️', w: 1.5, cloud: 0.1, over: 0.45, rain: 0, fog: 1, wind: 0.4 },
}
const ORDER = Object.keys(WEATHER)
const PARAMS = ['cloud', 'over', 'rain', 'fog', 'wind']

function pickWeather(not) {
  const list = ORDER.filter((k) => k !== not)
  let r = Math.random() * list.reduce((s, k) => s + WEATHER[k].w, 0)
  for (const k of list) if ((r -= WEATHER[k].w) <= 0) return k
  return list[0]
}

// ---------- chuva: riscos animados na GPU, ancorados no mundo e embrulhados numa caixa em volta de cada câmera ----------
const RAIN_MAX = 2400, RAIN_S = 44, RAIN_H = 24
function CreateRain(scene) {
  const pos = new Float32Array(RAIN_MAX * 6), end = new Float32Array(RAIN_MAX * 2)
  for (let i = 0; i < RAIN_MAX; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random()
    pos.set([x, y, z, x, y, z], i * 6)
    end[i * 2 + 1] = 1
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
  const u = { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uW: { value: new THREE.Vector2() }, uD: { value: new THREE.Vector2() }, uA: { value: 0.5 } }
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uT; uniform vec3 uC; uniform vec2 uW; uniform vec2 uD;
      attribute float aEnd;
      varying float vF;
      const float S = ${RAIN_S.toFixed(1)}, H = ${RAIN_H.toFixed(1)};
      void main() {
        float sp = 22.0 * (0.8 + 0.4 * fract(position.x * 91.7 + position.z * 13.1));
        float y = fract(position.y - uT * sp / H) * H;
        vec2 xz = position.xz * S + uD;
        xz = uC.xz + mod(xz - uC.xz + S * 0.5, S) - S * 0.5;
        vec3 p = vec3(xz.x, uC.y - H * 0.5 + y, xz.y);
        p -= vec3(uW.x, -sp, uW.y) * 0.04 * aEnd; // cauda do risco: para trás na direção da queda
        vF = smoothstep(0.0, 3.0, y) * (1.0 - smoothstep(H - 3.0, H, y));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uA; varying float vF;
      void main() { gl_FragColor = vec4(0.82, 0.9, 1.0, uA * vF); }`,
  })
  const mesh = new THREE.LineSegments(geo, mat)
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  mesh.visible = false
  scene.add(mesh)
  const fwd = new THREE.Vector3()
  return {
    update(dt, amount, wx, wz) {
      u.uT.value += dt
      u.uW.value.set(wx, wz)
      u.uD.value.x += wx * dt; u.uD.value.y += wz * dt
      u.uA.value = 0.35 + 0.25 * amount
      const n = Math.round(RAIN_MAX * amount)
      mesh.visible = n > 0
      geo.setDrawRange(0, n * 2)
    },
    // antes de desenhar cada tela: a caixa de chuva vai para onde essa câmera olha
    view(cam) {
      cam.getWorldDirection(fwd)
      u.uC.value.copy(cam.position).addScaledVector(fwd, 16)
    },
  }
}

// ---------- vento de desenho animado: fitas brancas que passam, fazem uma laçada e somem ----------
const SEG = 48
const CAM_FWD = new THREE.Vector3(0, -15, -10).normalize() // as câmeras do jogo olham todas nessa direção
function CreateWisps(scene, max = 10) {
  const pool = []
  for (let i = 0; i < max; i++) {
    const pos = new Float32Array((SEG + 1) * 2 * 3)
    const idx = []
    for (let k = 0; k < SEG; k++) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(idx)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.renderOrder = 4
    mesh.visible = false
    scene.add(mesh)
    pool.push({ mesh, pos, mat, on: false })
  }
  const dir = new THREE.Vector3(), upS = new THREE.Vector3(), c = new THREE.Vector3(), prev = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3()
  const path = (w, s, out) => {
    // linha na direção do vento com uma leve onda; entre loopA e loopB dá uma volta completa (a laçada)
    out.copy(w.start).addScaledVector(dir, s * w.L).addScaledVector(upS, Math.sin(s * 6.3 + w.ph) * 0.25)
    if (s > w.la && s < w.lb) {
      const th = ((s - w.la) / (w.lb - w.la)) * Math.PI * 2 * w.turns
      out.addScaledVector(dir, -Math.sin(th) * w.R).addScaledVector(upS, w.R * (1 - Math.cos(th)) * w.up)
    }
    return out
  }
  let spawnT = 0
  return {
    update(dt, strength, wx, wz, focus, bright = 1) {
      const wl = Math.hypot(wx, wz) || 1
      dir.set(wx / wl, 0, wz / wl)
      upS.crossVectors(CAM_FWD, dir).normalize().negate() // "para cima" na tela, perpendicular ao vento
      if (upS.y < 0) upS.negate()
      if ((spawnT -= dt * strength) <= 0 && focus.length) {
        spawnT = 0.9 + Math.random() * 1.6
        const w = pool.find((p) => !p.on)
        if (w) {
          const f = focus[(Math.random() * focus.length) | 0]
          const L = 9 + Math.random() * 5
          w.on = true
          w.t = 0
          w.life = 1.6 + Math.random() * 0.8
          w.L = L
          w.start = new THREE.Vector3(f.x + (Math.random() - 0.5) * 16, (f.gy || 0) + 1.2 + Math.random() * 2.2, f.z + (Math.random() - 0.5) * 12).addScaledVector(dir, -L * 0.5)
          w.la = 0.35 + Math.random() * 0.2
          w.lb = w.la + 0.12 + Math.random() * 0.05
          w.turns = Math.random() < 0.3 ? 2 : 1
          w.R = 0.45 + Math.random() * 0.35
          w.up = Math.random() < 0.5 ? 1 : -1
          w.ph = Math.random() * 6
          w.width = 0.07 + Math.random() * 0.04
          w.len = 0.32 + Math.random() * 0.12
          w.mesh.visible = true
        }
      }
      for (const w of pool) {
        if (!w.on) continue
        w.t += dt
        const k = w.t / w.life
        if (k >= 1) { w.on = false; w.mesh.visible = false; continue }
        // a "cabeça" percorre o caminho; a fita visível é o trecho [cabeça - len, cabeça], afinando nas pontas
        const head = k * (1 + w.len), s0 = Math.max(0, head - w.len), s1 = Math.min(1, head)
        for (let i = 0; i <= SEG; i++) {
          const f = i / SEG, s = s0 + (s1 - s0) * f
          path(w, s, c)
          path(w, Math.max(0, s - 0.004), prev)
          tan.subVectors(c, prev)
          if (tan.lengthSq() < 1e-8) tan.copy(dir)
          side.crossVectors(tan, CAM_FWD).normalize().multiplyScalar(Math.sin(Math.PI * f) * w.width)
          w.pos.set([c.x + side.x, c.y + side.y, c.z + side.z, c.x - side.x, c.y - side.y, c.z - side.z], i * 6)
        }
        w.mesh.geometry.attributes.position.needsUpdate = true
        w.mat.opacity = 0.85 * bright * Math.min(1, k * 6, (1 - k) * 4)
      }
    },
  }
}

// ---------- o clima ----------
export function CreateClimate(scene, light, { daySeconds = DAY_SECONDS } = {}) {
  const rain = CreateRain(scene)
  const wisps = CreateWisps(scene)
  const st = { t: 0.3, kind: 'clear', next: 120, bolt: 0, boltT: 6, flash: 0, wet: 0, windA: Math.PI, windT: 0, ws: 1 }
  const cur = Object.fromEntries(PARAMS.map((p) => [p, WEATHER.clear[p]]))
  const pal = Object.fromEntries(Object.keys(KEYS[0][1]).map((k) => [k, typeof KEYS[0][1][k] === 'number' ? 0 : new THREE.Color()]))
  const dirV = new THREE.Vector3(), tmp = new THREE.Color(), grey = new THREE.Color()
  const sky = { top: new THREE.Color(), mid: new THREE.Color(), bot: new THREE.Color() }
  let skyT = 0, skyKey = ''

  function palette(t) {
    let i = 0
    while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++
    const [ta, a] = KEYS[i], [tb, b] = KEYS[i + 1]
    const k = THREE.MathUtils.smoothstep(t, ta, tb)
    for (const n in pal) {
      if (typeof a[n] === 'number') pal[n] = a[n] + (b[n] - a[n]) * k
      else pal[n].copy(a[n]).lerp(b[n], k)
    }
  }
  // céu fechado: puxa a cor para um cinza da mesma luminosidade e escurece um pouco
  const overcast = (c, k) => {
    const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11
    return c.lerp(grey.setRGB(l * 0.95, l, l * 1.04), k * 0.75).multiplyScalar(1 - k * 0.3)
  }

  // sol de dia, lua de noite: mesmo arco (nasce à esquerda, passa alto e um pouco "para a câmera", se põe à direita)
  function body(t) {
    const day = t >= 0.25 && t < 0.75
    const h = (day ? t - 0.25 : (t + 0.25) % 1) * Math.PI * 2
    return { day, dir: dirV.set(-Math.cos(h), Math.sin(h) * 1.1, 0.3).normalize() }
  }

  function setWeather(kind) { st.kind = kind; st.next = 90 + Math.random() * 150; st.boltT = 3 + Math.random() * 5 }

  addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return
    const k = e.key.toLowerCase()
    if (k === 'n') st.t = (st.t + 1 / 24) % 1
    if (k === 'k') {
      setWeather(ORDER[(ORDER.indexOf(st.kind) + 1) % ORDER.length])
      if (e.shiftKey) { for (const p of PARAMS) cur[p] = WEATHER[st.kind][p]; st.wet = WEATHER[st.kind].rain > 0.15 ? 1 : 0 }
    }
  })

  return {
    get time() { return st.t },
    get weather() { return WEATHER[st.kind] },
    // para o som: força do vento (com rajada), chuva 0..1, chão molhado 0..1, neblina 0..1
    get wind() { return st.ws },
    get rain() { return cur.rain },
    get wet() { return st.wet },
    get fog() { return cur.fog },
    // "14:30" + ícone (lua à noite quando o céu está limpo)
    label() {
      const m = Math.floor(st.t * 24 * 60), hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60 - (m % 10)).padStart(2, '0')
      const night = st.t < 0.24 || st.t > 0.78
      const w = WEATHER[st.kind]
      return `${night && (st.kind === 'clear' || st.kind === 'cloudy') ? '🌙' : w.icon} ${hh}:${mm} · ${w.name}`
    },
    set(kind) { if (WEATHER[kind]) setWeather(kind) },

    // focus = pontos onde aparecem os rabiscos de vento (jogadores ou centro do menu)
    update(dt, focus) {
      st.t = (st.t + dt / daySeconds) % 1
      if ((st.next -= dt) <= 0) setWeather(pickWeather(st.kind))
      const goal = WEATHER[st.kind], kk = 1 - Math.exp(-dt * 3 / TRANSITION)
      for (const p of PARAMS) cur[p] += (goal[p] - cur[p]) * kk
      st.wet += ((cur.rain > 0.15 ? 1 : 0) - st.wet) * (1 - Math.exp(-dt / (cur.rain > 0.15 ? 12 : 40))) // molha rápido, seca devagar

      // vento: direção passeia devagar em volta de "para a esquerda", com rajadas
      st.windT += dt
      st.windA = Math.PI + Math.sin(st.windT * 0.03) * 0.5 + Math.sin(st.windT * 0.011 + 2) * 0.3
      const gustK = 1 + 0.25 * Math.sin(st.windT * 0.7) * Math.sin(st.windT * 0.23 + 1)
      const ws = (st.ws = cur.wind * gustK)
      const wx = Math.cos(st.windA) * ws * 2.2, wz = Math.sin(st.windA) * ws * 2.2
      gust.value = 0.8 + ws * 0.45

      // relâmpagos (só na tempestade): dois piscos rápidos
      if (goal.bolts && cur.rain > 0.7 && (st.boltT -= dt) <= 0) {
        st.boltT = 4 + Math.random() * 9; st.bolt = 0.45
        const far = Math.random() * 2.4 // o trovão chega depois do clarão (quanto mais longe, mais tarde e mais grave)
        events.emit('thunder', { delay: 0.15 + far, near: far < 0.5, vol: 1 - far * 0.2 }) // o jogo toca o trovão
      }
      if (st.bolt > 0) { st.bolt -= dt; const b = st.bolt; st.flash = b > 0.33 || (b > 0.12 && b < 0.24) ? 1 : 0 } else st.flash *= Math.exp(-dt * 20)

      // ---- luzes e cores ----
      palette(st.t)
      const { day, dir } = body(st.t)
      const up = THREE.MathUtils.smoothstep(dir.y, 0.03, 0.25) // sol/lua perto do horizonte = luz direta some
      const o = cur.over
      light.sun.position.copy(dir).multiplyScalar(20)
      light.sun.color.copy(pal.sc)
      overcast(light.sun.color, o)
      light.sun.intensity = pal.si * up * (1 - 0.75 * o)
      light.hemi.color.copy(pal.hs); overcast(light.hemi.color, o)
      light.hemi.groundColor.copy(pal.hg); overcast(light.hemi.groundColor, o * 0.6)
      light.hemi.intensity = pal.hi * (1 - 0.15 * o) + st.flash * 2.5

      // névoa: distância encurta com neblina/chuva; cor puxa para um branco acinzentado (escuro à noite)
      const fog = scene.fog, bright = Math.min(1, pal.hi / 2.1)
      fog.color.copy(pal.fog); overcast(fog.color, o)
      fog.color.lerp(tmp.setRGB(0.86, 0.89, 0.9).multiplyScalar(0.35 + 0.65 * bright), cur.fog * 0.7)
      fog.near = 32 - 27 * cur.fog
      fog.far = 90 - 58 * cur.fog
      if (st.flash > 0.05) fog.color.lerp(tmp.setRGB(0.9, 0.92, 1), st.flash * 0.6)

      // sombras: deslocadas para o lado oposto ao sol (compridas de manhã/fim de tarde); somem com céu fechado
      const s = up * (day ? 1 : 0.5) * (1 - 0.85 * o) * (1 - 0.5 * cur.fog)
      let sx = -dir.x / Math.max(dir.y, 0.28), sz = -dir.z / Math.max(dir.y, 0.28)
      const sl = Math.hypot(sx, sz)
      if (sl > 2.6) { sx *= 2.6 / sl; sz *= 2.6 / sl }
      shade.off.value.set(sx * s, sz * s)
      shade.alpha.value = 0.45 + 0.55 * s

      // nuvens: manchas andando com o vento; mais escuras com sol forte
      CLOUD.x -= wx * 0.9 * dt; CLOUD.y -= wz * 0.9 * dt
      CLOUD.z = cur.cloud * (1 - 0.35 * cur.fog)
      CLOUD.w = 0.55 * up * (day ? 1 : 0.4) * (1 - 0.6 * o)
      WET.x = st.wet
      WET.y = st.flash * 0.35

      // céu (só aparece no menu/horizonte): repinta poucas vezes por segundo
      if ((skyT -= dt) <= 0 || st.flash > 0.05) {
        skyT = 0.25
        for (const k of ['top', 'mid', 'bot']) {
          overcast(sky[k].copy(pal[k]), o)
          sky[k].lerp(fog.color, cur.fog * 0.6)
          if (st.flash > 0.05) sky[k].lerp(tmp.setRGB(0.92, 0.94, 1), st.flash * 0.7)
        }
        const key = sky.top.getHexString() + sky.mid.getHexString() + sky.bot.getHexString()
        if (key !== skyKey) { skyKey = key; light.paintSky(`#${sky.top.getHexString()}`, `#${sky.mid.getHexString()}`, `#${sky.bot.getHexString()}`) }
      }

      rain.update(dt, cur.rain < 0.03 ? 0 : cur.rain, wx * 1.4, wz * 1.4)
      wisps.update(dt, Math.max(0.15, cur.wind) * (1 - 0.5 * cur.rain), wx, wz, focus, (0.35 + 0.65 * bright) * (1 - 0.4 * cur.fog))
    },
    // chamado antes de desenhar cada tela (split screen)
    view(cam) { rain.view(cam) },
  }
}
