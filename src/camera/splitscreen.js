import * as THREE from 'three'

// Split screen dinâmico.
// - Jogadores perto uns dos outros formam UM grupo = UMA tela (histerese: junta a < MERGE, separa só a > SPLIT).
// - Layout pelo número de telas: 1 = cheia · 2 = linha vertical · 3 = duas em cima (linha vertical) + uma embaixo (linha horizontal) · 4 = 2x2.
// - Uma câmera por tela, desenhadas com viewport + scissor no mesmo renderer.
export const PLAYER_COLORS = ['#c85b72', '#4a86c8', '#e0b23c', '#57a773']

const MERGE = 13, SPLIT = 19 // distâncias (unidades do mundo)
const GAP = 4 // divisória em px
const CAM_Y = 15, CAM_Z = 10, BASE_DIST = Math.hypot(CAM_Y, CAM_Z), PITCH_SIN = Math.sin(Math.atan2(CAM_Y - 0.5, CAM_Z))

export function CreateSplitScreen(renderer, scene) {
  const cams = [0, 1, 2, 3].map(() => new THREE.PerspectiveCamera(55, 1, 0.4, 150))
  const state = new Map() // id do líder -> { f: foco suavizado, z: zoom }
  const linked = new Set() // pares "a|b" atualmente juntos (histerese)
  const size = new THREE.Vector2()
  const target = new THREE.Vector3()

  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6'
  document.body.appendChild(holder)
  const labels = [0, 1, 2, 3].map(() => {
    const d = document.createElement('div')
    d.style.cssText = 'position:absolute;display:none;color:#fff;font:700 13px system-ui,sans-serif;background:#000a;padding:4px 10px;border-radius:6px;border-left:5px solid #fff;text-shadow:0 1px 2px #000'
    holder.appendChild(d)
    return d
  })

  // ---- efeito "miniatura" (tilt-shift): faixas desfocadas no topo e na base de cada tela ----
  // Feito com CSS backdrop-filter: roda no compositor da GPU, custa ZERO no pipeline do three.js
  // e respeita o split screen (um par de faixas por tela). Tecla T liga/desliga.
  let tilt = true
  const tiltHolder = document.createElement('div')
  tiltHolder.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1'
  document.body.appendChild(tiltHolder)
  // se o FPS ficar baixo por 3 s seguidos, o desfoque (que custa GPU no compositor) desliga sozinho
  let slow = 0
  window.addEventListener('fps', (e) => {
    if (!tilt) return
    slow = e.detail < 40 ? slow + 1 : 0
    if (slow >= 3) { tilt = false; bands.forEach(([t]) => (t._k = null)) }
  })
  const band = (up) => {
    const d = document.createElement('div')
    const mask = `linear-gradient(${up ? 'to bottom' : 'to top'}, #000 0%, rgba(0,0,0,0.6) 35%, transparent 100%)`
    d.style.cssText = `position:absolute;display:none;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);-webkit-mask-image:${mask};mask-image:${mask}`
    tiltHolder.appendChild(d)
    return d
  }
  const bands = [0, 1, 2, 3].map(() => [band(true), band(false)])
  const vignette = document.createElement('div')
  vignette.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(20,45,0,0.2) 100%)'
  tiltHolder.appendChild(vignette)
  const hud = document.getElementById('hud')
  if (hud) hud.style.zIndex = '3' // HUD fica acima do desfoque
  function placeBands(rects) {
    bands.forEach(([t, b], i) => {
      const r = rects[i]
      if (!r || !tilt) { t.style.display = b.style.display = 'none'; return }
      const k = `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`
      if (t._k !== k) {
        t._k = k
        const th = Math.round(r.h * 0.22), bh = Math.round(r.h * 0.18)
        for (const [el, top, h] of [[t, r.y, th], [b, r.y + r.h - bh, bh]]) {
          el.style.left = `${r.x}px`; el.style.top = `${top}px`; el.style.width = `${r.w}px`; el.style.height = `${h}px`; el.style.display = 'block'
        }
      }
    })
  }
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 't' && !(e.target && e.target.tagName === 'INPUT')) { tilt = !tilt; bands.forEach(([t]) => (t._k = null)) }
  })

  // ---- agrupamento por proximidade ----
  function buildGroups(players) {
    const alive = players.filter((p) => !p.dead)
    const core = [...(alive.length ? alive : players)].sort((a, b) => a.idx - b.idx)
    const parent = core.map((_, i) => i)
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
    const ids = new Set(core.map((p) => p.id))
    for (const k of linked) { const [a, b] = k.split('|'); if (!ids.has(a) || !ids.has(b)) linked.delete(k) }
    for (let i = 0; i < core.length; i++)
      for (let j = i + 1; j < core.length; j++) {
        const key = `${core[i].id}|${core[j].id}`
        const d = Math.hypot(core[i].x - core[j].x, core[i].z - core[j].z)
        if (d < (linked.has(key) ? SPLIT : MERGE)) { linked.add(key); parent[find(i)] = find(j) } else linked.delete(key)
      }
    const byRoot = new Map()
    core.forEach((p, i) => { const r = find(i); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(p) })
    const groups = [...byRoot.values()].map((c) => ({ core: c, members: [...c] })).sort((a, b) => a.core[0].idx - b.core[0].idx)
    // quem caiu assiste pela tela do grupo vivo mais próximo
    if (alive.length) {
      const cen = groups.map((g) => ({ x: g.core.reduce((s, p) => s + p.x, 0) / g.core.length, z: g.core.reduce((s, p) => s + p.z, 0) / g.core.length }))
      for (const p of players) {
        if (!p.dead) continue
        let best = 0, bd = Infinity
        cen.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = i } })
        groups[best].members.push(p)
      }
    }
    return groups
  }

  // ---- layout ----
  function layout(n, W, H) {
    const w2 = W / 2, h2 = H / 2
    const R = n <= 1 ? [[0, 0, W, H]]
      : n === 2 ? [[0, 0, w2, H], [w2, 0, w2, H]]
      : n === 3 ? [[0, 0, w2, h2], [w2, 0, w2, h2], [0, h2, W, h2]]
      : [[0, 0, w2, h2], [w2, 0, w2, h2], [0, h2, w2, h2], [w2, h2, w2, h2]]
    const g = GAP / 2
    return R.map(([x, y, w, h]) => {
      const l = x > 0 ? g : 0, r = x + w < W - 0.5 ? g : 0, t = y > 0 ? g : 0, b = y + h < H - 0.5 ? g : 0
      return { x: x + l, y: y + t, w: w - l - r, h: h - t - b }
    })
  }

  // ---- por frame: grupos, retângulos e câmeras ----
  function update(players, dt) {
    renderer.getSize(size)
    const W = size.x, H = size.y
    const groups = players.length ? buildGroups(players) : [{ core: [], members: [] }]
    const rects = layout(groups.length, W, H)
    const k = 1 - Math.exp(-4 * dt)

    return groups.map((g, i) => {
      const rect = rects[i], cam = cams[i], aspect = rect.w / rect.h
      // telas muito largas ganham FOV vertical menor, para não mostrar além dos chunks carregados
      const fov = Math.min(55, THREE.MathUtils.radToDeg(2 * Math.atan(1 / aspect)))
      const t = Math.tan(THREE.MathUtils.degToRad(fov / 2))

      const n = g.core.length || 1
      let cx = 0, cy = 0, cz = 0, lx = 0, lz = 0, fast = 0
      for (const p of g.core) { cx += p.x; cy += p.gy || 0; cz += p.z; lx += p.lookX || 0; lz += p.lookZ || 0; if (p.vehicle) fast = Math.max(fast, p.speed) }
      cx /= n; cy /= n; cz /= n
      let sx = 0, sz = 0
      for (const p of g.core) { sx = Math.max(sx, Math.abs(p.x - cx)); sz = Math.max(sz, Math.abs(p.z - cz)) }
      // afasta a câmera se o grupo não couber na tela
      // de carro: a tela abre com a velocidade e olha para onde ele vai
      const zoomT = Math.min(2.2, Math.max(1, (sx + 2.5) / (t * aspect * BASE_DIST), (sz + 2.5) / ((t * BASE_DIST) / PITCH_SIN))) * (1 + Math.min(fast / 22, 1) * 0.35)
      const ll = Math.hypot(lx, lz) / n, lk = ll > 7 ? 7 / ll : 1
      cx += (lx / n) * lk; cz += (lz / n) * lk

      const leader = g.core[0]
      const key = leader ? leader.id : '_'
      target.set(cx, cy, cz)
      let s = state.get(key)
      if (!s) state.set(key, (s = { f: target.clone(), z: zoomT }))
      if (s.f.distanceTo(target) > 45) s.f.copy(target) // teleporte/renascimento: não varre o mapa
      s.f.lerp(target, k)
      s.z += (zoomT - s.z) * (1 - Math.exp(-3 * dt))
      // os outros do grupo herdam a câmera: ao separar, cada um continua de onde a tela estava
      for (const m of g.members) {
        if (m === leader) continue
        let ms = state.get(m.id)
        if (!ms) state.set(m.id, (ms = { f: new THREE.Vector3(), z: 1 }))
        ms.f.copy(s.f); ms.z = s.z
      }

      cam.fov = fov
      cam.aspect = aspect
      cam.updateProjectionMatrix()
      cam.position.set(s.f.x, s.f.y + CAM_Y * s.z, s.f.z + CAM_Z * s.z)
      cam.lookAt(s.f.x, s.f.y + 0.5, s.f.z)
      return { cam, rect, group: g }
    })
  }

  // before(view): chamado antes de desenhar cada tela (ex.: trocar casa fechada pelo recorte do andar de quem está nela)
  function render(views, before) {
    renderer.getSize(size)
    const H = size.y
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, size.x, H)
    renderer.setClearColor(0x0d0907)
    renderer.clear() // o que sobra entre as telas vira a divisória
    renderer.setScissorTest(true)
    views.forEach(({ cam, rect }, i) => {
      renderer.setViewport(rect.x, H - rect.y - rect.h, rect.w, rect.h)
      renderer.setScissor(rect.x, H - rect.y - rect.h, rect.w, rect.h)
      if (before) before(views[i])
      renderer.render(scene, cam)
    })
    renderer.setScissorTest(false)
    placeBands(views.map((v) => v.rect))

    labels.forEach((el, i) => {
      const v = views.length > 1 ? views[i] : null
      if (!v) { el.style.display = 'none'; return }
      const names = v.group.members.map((p) => `${p.dead ? '☠ ' : ''}${p.name}`).join(' + ')
      el.textContent = names
      el.style.borderLeftColor = PLAYER_COLORS[(v.group.core[0] || v.group.members[0] || { idx: 0 }).idx % 4]
      el.style.left = `${v.rect.x + 10}px`
      el.style.top = `${v.rect.y + 10}px`
      el.style.display = 'block'
    })
  }

  return {
    update,
    render,
    // tela cheia com uma câmera qualquer (menu)
    full(camera) {
      renderer.getSize(size)
      renderer.setScissorTest(false)
      renderer.setViewport(0, 0, size.x, size.y)
      renderer.render(scene, camera)
      placeBands([{ x: 0, y: 0, w: size.x, h: size.y }])
      labels.forEach((el) => (el.style.display = 'none'))
    },
    reset() { state.clear(); linked.clear() },
  }
}
