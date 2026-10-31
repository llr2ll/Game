// Replay determinístico: 100 s de partida com 4 jogadores (uma classe cada) fazendo sempre os mesmos movimentos,
// com o sorteio (Math.random) e o relógio fixos. Roda sem navegador e sem desenhar (via Vite).
// Devolve um resumo (hash) do estado final: posição, vida, fôlego, mana, munição e abates dos jogadores; posição, vida e
// estado dos zumbis; pontos. Mesmo código de jogo = mesmo hash. Usado pelo npm run check (scripts/sim-fingerprint.txt).
// Rode sempre em processo novo (node scripts/sim.mjs): o Three.js e o Vite guardam estado entre rodadas.
// SIM_TRACE=arquivo grava um rastro quadro a quadro (para achar onde dois replays se separam).
import { createHash } from 'node:crypto'

export async function SimFingerprint(vite, frames = 3000) {
  // o motor de áudio registra uma tecla ao carregar; fora do navegador isso não existe
  globalThis.addEventListener ??= () => {}
  // sorteio e relógio fixos
  let seed = 20261030, calls = 0
  const trace = process.env.SIM_TRACE ? [] : null
  const realRandom = Math.random, realPerf = globalThis.performance, realLimit = Error.stackTraceLimit
  Error.stackTraceLimit = 3 // só precisamos de quem chamou o sorteio (mais rápido)
  // só o código do jogo (src/) usa a sequência fixa. O Vite (um id por arquivo carregado) e o Three.js (um id por objeto)
  // também sorteiam; se entrassem na sequência, acrescentar um arquivo ou um objeto mudaria o replay inteiro.
  Math.random = () => {
    if (!(new Error().stack.split('\n')[2] || '').includes('/src/')) return 0.5
    calls++
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296
  }
  let now = 0
  Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true, writable: true })
  try {
    const THREE = await vite.ssrLoadModule('three')
    const load = (p) => vite.ssrLoadModule(p)
    const { CreateChunks } = await load('/src/engine/world/chunks.js')
    const { SetDeepTest } = await load('/src/engine/world/collision.js')
    const { SetIndoorRoute } = await load('/src/engine/world/pathing.js')
    const { SetIndoorTest } = await load('/src/engine/audio/engine.js')
    const { events } = await load('/src/engine/core/events.js')
    const { TrimCaches } = await load('/src/engine/core/memo.js')
    const { GenerateChunk } = await load('/src/shared/worldgen/generator.js')
    const { CHUNK_SIZE } = await load('/src/shared/worldgen/map.js')
    const reg = await load('/src/shared/worldgen/buildings-registry.js')
    const { TooDeep } = await load('/src/shared/worldgen/sidewalk.js')
    const { CreateGame } = await load('/src/games/survivor/rules/survival.js')

    const scene = new THREE.Scene(), colliders = []
    SetDeepTest(TooDeep); SetIndoorRoute(reg.ChaseTarget); SetIndoorTest(reg.PointInBuilding)
    const chunks = CreateChunks({ scene, colliders, size: CHUNK_SIZE, generate: GenerateChunk, afterUnload: TrimCaches,
      onLoad: (c) => reg.AddBuildings(c.userData.buildings), onUnload: (c) => reg.RemoveBuildings(c.userData.buildings) })
    let night = false
    const game = CreateGame(scene, colliders, null, { onEnd: () => {}, night: () => night, loaded: chunks.loaded })
    const off = events.on('vehicle-spot', (p) => game.vehicles.register(p))
    chunks.update([{ x: 0, z: 0 }]); chunks.process(999)

    const ids = ['local', 'p1', 'p2', 'p3']
    ids.forEach((id, slot) => game.addPlayer(id, `J${slot + 1}`, slot))
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0], [0.7, -0.7], [-0.7, 0.7]]
    const dt = 1 / 30
    for (let f = 0; f < frames; f++) {
      now += dt * 1000
      if (f === frames / 2) night = true
      const list = [...game.players.values()]
      // saque: no quadro 600 o 4º jogador vai até um móvel, revista e depois desmonta (fica parado até o quadro 760)
      const looter = list[3]
      if (looter && f === 600) { const sp = reg.SpotsNear(0, 0, 0, 60).find((x) => /^(dresser|wardrobe|chest|shelf|desk|stove|counter)/.test(x.key)); if (sp) Object.assign(looter, { x: sp.fx, z: sp.fz, lv: 0, vx: 0, vz: 0 }) }
      // barricada: no quadro 1700 (noite) o mesmo jogador entra na casa mais perto, barrica e reforça a porta (parado até 1900)
      if (looter && f === 1700) {
        game.loot.inv.tabuas += 4
        const d = reg.DoorsNear(0, 0, 60).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0]
        if (d) Object.assign(looter, { x: d.x - d.ox * 1.2, z: d.z - d.oz * 1.2, lv: 0, vx: 0, vz: 0 })
      }
      list.forEach((p, i) => {
        if (p === looter && f >= 1700 && f < 1900) {
          game.setInput(p.id, { mx: 0, mz: 0, ax: 0, az: 0, run: 0, fire: 0 })
          if (f === 1701 || f === 1790) game.act(p.id, 'use')
          return
        }
        if (p === looter && f >= 600 && f < 760) {
          game.setInput(p.id, { mx: 0, mz: 0, ax: 0, az: 0, run: 0, fire: 0 })
          if (f === 601 || f === 660) game.act(p.id, 'use')
          return
        }
        const [mx, mz] = DIRS[(Math.floor(f / 75) + i) % DIRS.length]
        // mira no zumbi vivo mais perto (até 14 m) e ataca
        let best = null, bd = 196
        for (const e of game.enemies) { if (e.dying > 0) continue; const d = (e.x - p.x) ** 2 + (e.z - p.z) ** 2; if (d < bd) { bd = d; best = e } }
        const ax = best ? best.x - p.x : 0, az = best ? best.z - p.z : 0, l = Math.hypot(ax, az) || 1
        game.setInput(p.id, { mx, mz, ax: best ? ax / l : 0, az: best ? az / l : 0, run: f % 300 < 120 ? 1 : 0, fire: best ? 1 : 0 })
        const k = (f + i * 37) % 240
        if (k === 60) game.act(p.id, 'b1')
        if (k === 140) game.act(p.id, 'b2')
        if (k === 200) game.act(p.id, 'b3')
        if (f % 50 === i * 7) game.act(p.id, 'shove')
        if (f % 210 === i * 11) game.act(p.id, 'jump')
        if (f === 900 + i) game.act(p.id, 'use')
        if (f === 1200 + i) game.act(p.id, 'use')
      })
      game.update(dt)
      reg.UpdateDoors(dt, list, game.enemies)
      chunks.update(list.length ? list : [{ x: 0, z: 0 }], 3)
      chunks.process(1)
      if (trace) trace.push(`${f} r${calls} e${game.enemies.length} ` + [...game.players.values()].map((p) => `${p.x.toFixed(4)},${p.z.toFixed(4)},${p.hp.toFixed(3)}`).join(' ') + ' | ' + game.enemies.slice(0, 6).map((e) => `${e.x.toFixed(3)},${e.z.toFixed(3)},${e.hp.toFixed(2)},${e.state}`).join(' '))
    }
    if (trace) (await import('node:fs')).writeFileSync(process.env.SIM_TRACE, trace.join('\n'))
    const r = (v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)
    const state = {
      st: { time: r(game.st.time), score: game.st.score, over: game.st.over },
      players: [...game.players.values()].map((p) => [p.id, r(p.x), r(p.z), r(p.hp), r(p.stamina), r(p.mana), p.kills, p.dead, p.weapon, JSON.stringify(p.ammo), !!p.vehicle]),
      enemies: game.enemies.map((e) => [r(e.x), r(e.z), r(e.hp), e.state, e.fast]),
      cars: game.vehicles.list.length,
      loot: game.loot.text(),
      bars: game.bars.list(),
    }
    off()
    return { hash: createHash('sha256').update(JSON.stringify(state)).digest('hex'), summary: `${state.players.filter((p) => !p[7]).length}/4 vivos · ${state.enemies.length} zumbis · ${state.st.score} pontos · saque ${state.loot} · barricadas ${state.bars.map((b) => `${b.hp}/${b.max}`).join(' ') || 'nenhuma'}` }
  } finally {
    Math.random = realRandom
    Error.stackTraceLimit = realLimit
    Object.defineProperty(globalThis, 'performance', { value: realPerf, configurable: true, writable: true })
  }
}

// rodar: node scripts/sim.mjs (--json = só o resultado, para o check)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { createServer } = await import('vite')
  const path = await import('node:path')
  const vite = await createServer({ root: path.resolve(import.meta.dirname, '..'), logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  try {
    const t = Date.now(), s = await SimFingerprint(vite)
    console.log(process.argv.includes('--json') ? JSON.stringify(s) : `${s.summary} · ${s.hash} · ${((Date.now() - t) / 1000).toFixed(1)} s`)
  } finally { await vite.close() }
}
