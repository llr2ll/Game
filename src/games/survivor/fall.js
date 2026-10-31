import { BALANCE } from './config/balance'

// Queda (J6): quem cai fica no chão por `fall.bleed` s esperando ajuda. Um aliado ao lado aperta Usar e fica parado
// `fall.lift` s para levantar; durante o levantar, Usar de novo gasta 1 🩹 e levanta na hora. Sem ajuda a tempo:
// fica fora até o próximo amanhecer. Sozinho: Usar levanta sozinho (`solo.selfLift` vez até cada amanhecer) ou com o remédio.
// Números em balance.js · rules.fall e solo.
const F = BALANCE.rules.fall, SOLO = BALANCE.solo

// ctx: { players (Map), tasks (tasks.js), inv (estoque do grupo), fx, say(texto, s), sfx(nome, opções) }
export function CreateFall({ players, tasks, inv, fx, say, sfx }) {
  let selfLeft = SOLO.selfLift // levantar sozinho que ainda resta até o amanhecer (só no solo)
  const solo = () => players.size === 1
  const downed = (o) => o.dead && !o.out // caído e ainda dá para levantar
  const lifting = (p) => p.task && p.task.a === 'lift'

  // aliado caído mais perto ao alcance (mesmo andar)
  function target(p) {
    let best = null, bd = F.reach
    for (const o of players.values()) {
      if (o === p || !downed(o) || (o.lv || 0) !== (p.lv || 0)) continue
      const d = Math.hypot(o.x - p.x, o.z - p.z)
      if (d < bd) { bd = d; best = o }
    }
    return best
  }
  // levanta ali mesmo (by = quem ajudou; o próprio, se levantou sozinho)
  function rise(o, by, medkit) {
    Object.assign(o, { dead: false, out: false, downT: 0, hp: o.max * F.hp, stamina: 100, tired: false, invulnT: F.invulnerable })
    o.model.hurt()
    fx.ring(o.x, o.gy || 0, o.z, medkit ? 0xff8a9a : 0x7aff9a, 0.2, 1.6, 0.7)
    say(by === o ? `${o.name} levantou sozinho${medkit ? ' com 🩹' : ''}!` : `${by.name} levantou ${o.name}${medkit ? ' com 🩹' : ''}!`, 1.8)
    sfx('revive', { x: o.x, z: o.z })
  }
  function medkit(p, o) {
    inv.remedio--
    p.task = null
    rise(o, p, true)
  }
  function lift(p, o) {
    tasks.start(p, { a: 'lift', icon: '🤝', o, need: F.lift, at: o, noise: F.noise, down: p === o, valid: () => downed(o), done: () => { if (p === o) selfLeft--; rise(o, p) } })
    sfx('swap', { x: o.x, z: o.z })
  }

  return {
    // alguém acabou de cair
    down(p) {
      p.downT = F.bleed; p.out = false
      if (!solo()) return say(`🆘 ${p.name} caiu! Levantem em ${F.bleed} s (Usar ao lado)`, 3)
      say(selfLeft > 0 ? '🆘 Você caiu! Usar = levantar sozinho' : inv.remedio > 0 ? '🆘 Você caiu! Usar = 🩹 remédio' : '🆘 Você caiu!', 3)
    },
    // Usar: levantar o aliado caído ao lado (ou a si mesmo, no solo). Durante o levantar, Usar de novo = remédio. false = nada a fazer
    use(p) {
      if (lifting(p)) { if (inv.remedio > 0) medkit(p, p.task.o); return true }
      if (p.dead) {
        if (!solo() || p.out || p.task) return false
        if (selfLeft > 0) lift(p, p)
        else if (inv.remedio > 0) medkit(p, p)
        else return false
        return true
      }
      if (p.task || p.vehicle) return false
      const o = target(p)
      if (!o) return false
      lift(p, o)
      if (inv.remedio > 0) say(`🤝 Levantando ${o.name}… (Usar de novo = 🩹 na hora)`, 2)
      return true
    },
    // texto do botão Usar (celular)
    label(p) {
      if (lifting(p)) return inv.remedio > 0 ? '🩹 Levantar já' : '🤝 Levantando…'
      if (p.dead) return !solo() || p.out ? '' : selfLeft > 0 ? '💪 Levantar sozinho' : inv.remedio > 0 ? '🩹 Usar remédio' : ''
      return !p.task && !p.vehicle && target(p) ? '🤝 Levantar' : ''
    },
    // a cada quadro: o tempo de quem está caído corre; acabou = fora até o amanhecer
    tick(dt) {
      const helped = new Set()
      for (const q of players.values()) if (lifting(q)) helped.add(q.task.o) // sendo levantado: o tempo para
      for (const p of players.values()) {
        if (!downed(p) || helped.has(p)) continue
        if ((p.downT -= dt) <= 0) { p.out = true; p.downT = 0; say(`💀 ${p.name} ficou fora até o amanhecer`, 3) }
      }
    },
    // alguém caído ainda consegue levantar sozinho? (no solo: a derrota espera)
    canRise: () => solo() && [...players.values()].some((o) => downed(o) && (selfLeft > 0 || inv.remedio > 0)),
    // amanheceu: quem está no chão volta (a lista) e o levantar sozinho recarrega
    dawn() { selfLeft = SOLO.selfLift; return [...players.values()].filter((o) => o.dead) },
    rise: (o) => rise(o, o),
    // começo da partida: no solo, o remédio inicial
    start() { selfLeft = SOLO.selfLift; if (solo()) inv.remedio += SOLO.medkit },
    clear() { selfLeft = SOLO.selfLift; for (const p of players.values()) { p.out = false; p.downT = 0 } },
  }
}
