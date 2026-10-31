// Jogadores controlados pelo computador, SÓ PARA TESTE (?bots=1 a 3 na URL). Não fazem parte do jogo.
// Usam o mesmo contrato do celular (game.setInput / game.act), como se fossem um celular a mais.
// Ocupam as vagas livres (a vaga define a classe), seguem o primeiro jogador humano, atacam o zumbi mais perto,
// usam os botões da classe e levantam quem caiu perto. Tecla B: espalhar (cada um corre ~30 m para um lado, para testar a tela dividida) / voltar.
const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)

export function CreateBots(game, count) {
  const bots = [] // { id, i, skillT, goal }
  let spread = false

  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'b' || e.repeat || !bots.length || (e.target && e.target.tagName === 'INPUT')) return
    spread = !spread
    const lead = leader()
    for (const b of bots) {
      const p = game.players.get(b.id), from = lead || p
      const a = (b.i / bots.length) * Math.PI * 2 + 0.6
      b.goal = spread && from ? { x: from.x + Math.sin(a) * 30, z: from.z + Math.cos(a) * 30 } : null
    }
  })
  const leader = () => [...game.players.values()].find((p) => !p.id.startsWith('bot') && !p.dead)

  // botões da classe: quando vale a pena apertar (z = zumbis vivos com a distância até o bot)
  function skills(p, z) {
    const within = (r) => z.filter((e) => e.d < r).length
    const c = p.cls.id
    if (c === 'gunner') return within(9) >= 3 ? 'b3' : null // granada no bolo
    if (c === 'samurai') return within(3) >= 3 ? 'b2' : z[0] && z[0].d > 4 && z[0].d < 8 ? 'b1' : null // redemoinho / investida
    if (c === 'mage') return within(5) >= 2 ? 'b2' : within(10) >= 3 ? 'b1' : null // nova de gelo / meteoro
    if (c === 'bard') {
      const hurt = [...game.players.values()].some((o) => o !== p && near(o, p) < 5 && (o.dead || o.hp < o.max * 0.5))
      return hurt ? 'b1' : within(10) >= 3 ? 'b2' : null // canção de cura / balada
    }
    return null
  }

  return {
    // depois que os humanos entram: os bots ocupam as vagas livres
    add(freeSlots) {
      for (let i = 0; i < Math.min(count, freeSlots.length); i++) {
        const id = `bot${i + 1}`
        game.addPlayer(id, `🤖 Bot ${i + 1}`, freeSlots[i])
        bots.push({ id, i, skillT: 1 + i * 0.4, goal: null })
      }
    },
    clear() { bots.length = 0; spread = false },
    update(dt) {
      const lead = leader()
      for (const b of bots) {
        const p = game.players.get(b.id)
        if (!p || p.dead) continue
        // aliado caído a até 12 m: vai até ele e aperta Usar (levantar)
        const down = [...game.players.values()].find((o) => o !== p && o.dead && !o.out && near(o, p) < 12)
        if (down) {
          const dx = down.x - p.x, dz = down.z - p.z, d = Math.hypot(dx, dz), go = d > 1
          game.setInput(b.id, { mx: go ? dx / d : 0, mz: go ? dz / d : 0, ax: 0, az: 0, run: d > 4 ? 1 : 0 })
          if (!go && !p.task) game.act(b.id, 'use')
          continue
        }
        // para onde ir: o ponto de espalhar, ou um lugar ao lado do líder
        const a = (b.i / 3) * Math.PI * 2
        const goal = b.goal || (lead ? { x: lead.x + Math.sin(a) * 3, z: lead.z + Math.cos(a) * 3 } : p)
        const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz)
        const go = d > 1.5 ? 1 : 0
        // zumbis vivos por perto, do mais perto para o mais longe
        const z = game.enemies.filter((e) => e.dying <= 0 && (e.lv || 0) === (p.lv || 0)).map((e) => ({ e, d: near(e, p) })).filter((o) => o.d < 14).sort((u, v) => u.d - v.d)
        const t = z[0] && z[0].d < (p.cls.ranged ? 12 : 4) ? z[0].e : null
        const ax = t ? t.x - p.x : 0, az = t ? t.z - p.z : 0, al = Math.hypot(ax, az) || 1
        game.setInput(b.id, { mx: go ? dx / d : 0, mz: go ? dz / d : 0, ax: t ? ax / al : 0, az: t ? az / al : 0, run: d > 8 && !t ? 1 : 0 })
        if (p.held) game.act(b.id, 'shove') // agarrado: empurra
        if ((b.skillT -= dt) <= 0) {
          b.skillT = 1.5
          const s = skills(p, z)
          if (s) game.act(b.id, s)
        }
      }
    },
  }
}
