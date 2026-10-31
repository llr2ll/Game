import * as THREE from 'three'
import { DoorsNear, HasBuilding, PointInBuilding } from '../../shared/worldgen/buildings-registry'
import { AddColliders, RemoveColliders } from '../../engine/world/collision'
import { BALANCE } from './config/balance'

// Barricadas (J4): de dentro da casa, perto da porta, Usar prega tábuas do estoque do grupo.
// Só seguram zumbis (gente e tiro passam pela fresta). Zumbi encostado bate até quebrar; as tábuas caem em estágios.
// Estado por porta (id = posição): continua lá quando o chunk sai e volta. Números em balance.js · barricade.
const B = BALANCE.barricade, Z = BALANCE.zombies
const COST = { build: B.build.planks, repair: B.repair.planks, reinforce: B.reinforce.planks }
const LABEL = { build: '🪵 Barricar', repair: '🔨 Consertar', reinforce: '🪵 Reforçar' }
const BOARD_GEO = new THREE.BoxGeometry(1, 0.2, 0.1)
const WOOD = new THREE.MeshLambertMaterial({ color: 0xc9965a })
const WOOD_HIT = new THREE.MeshBasicMaterial({ color: 0xffe2b8 })
const BOARDS = [[0.45, 0.18], [0.95, -0.22], [1.45, 0.15], [0.7, -0.08]] // altura, inclinação (a 4ª só na reforçada)
// barrinha de vida deitada sobre a porta (de cima, as tábuas se sobrepõem; a barrinha mostra qual porta está fraca)
const HP_GEO = new THREE.PlaneGeometry(1, 0.3).translate(0.5, 0, 0).rotateX(-Math.PI / 2)
const HP_BACK = new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.75, depthTest: false, toneMapped: false })
const HP_COLORS = [0xe25555, 0xe0b23c, 0x6fd36f] // pouca · média · muita vida

// ctx: { scene, fx, inv (estoque do grupo), say(texto, s), sfx(nome, opções), tasks, impact(x, z, tipo, força) }
export function CreateBarricades({ scene, fx, inv, say, sfx, tasks, impact }) {
  const bars = new Map() // id da porta -> { id, x, z, hp, max, strong, b, door, group, col, flashT }
  let scanT = 0, warnT = 0

  // porta ao alcance de quem está dentro da casa (térreo)
  function doorFor(p) {
    if (p.dead || p.vehicle || (p.lv || 0) !== 0 || !PointInBuilding(p.x, p.z)) return null
    let best = null, bd = B.reach
    for (const d of DoorsNear(p.x, p.z, B.reach)) { const dd = Math.hypot(d.x - p.x, d.z - p.z); if (dd < bd) { bd = dd; best = d } }
    return best
  }
  function actionOf(d) {
    const bar = bars.get(d.id)
    if (!bar) return 'build'
    if (bar.hp < bar.max) return 'repair'
    return bar.strong ? null : 'reinforce'
  }
  // tábuas visíveis (menos tábuas = mais perto de quebrar) e barrinha de vida
  function refresh(bar) {
    if (!bar.group) return
    const k = Math.max(0, bar.hp / bar.max), show = Math.max(1, Math.ceil(k * bar.boards.length))
    bar.boards.forEach((m, i) => (m.visible = i < show))
    bar.hpFill.scale.x = Math.max(0.02, k) * bar.w
    bar.hpFill.material.color.setHex(HP_COLORS[k > 0.5 ? 2 : k > 0.25 ? 1 : 0])
  }
  // desenho + colisor (só para zumbis) quando a casa está carregada
  function attach(bar, d) {
    bar.b = d.b; bar.door = d.d
    d.d.lock = true // zumbi não abre esta porta
    const g = new THREE.Group()
    g.position.set(d.x + d.ox * 0.25, d.y, d.z + d.oz * 0.25) // do lado de fora da porta
    g.rotation.y = d.ry
    bar.boards = BOARDS.slice(0, bar.strong ? 4 : 3).map(([y, tilt]) => {
      const m = new THREE.Mesh(BOARD_GEO, WOOD)
      m.scale.x = d.w * 1.2
      m.position.y = y
      m.rotation.set(0.45, 0, tilt) // escorada: o topo pende para fora (assim aparece vista de cima)
      g.add(m)
      return m
    })
    bar.w = d.w
    const back = new THREE.Mesh(HP_GEO, HP_BACK)
    back.scale.x = d.w; back.position.set(-d.w / 2, 2.5, 0); back.renderOrder = 4
    bar.hpFill = new THREE.Mesh(HP_GEO, new THREE.MeshBasicMaterial({ color: HP_COLORS[2], depthTest: false, toneMapped: false }))
    bar.hpFill.position.set(-d.w / 2, 2.51, 0); bar.hpFill.renderOrder = 5
    g.add(back, bar.hpFill)
    scene.add(g)
    bar.group = g
    const wideX = Math.abs(d.oz) > Math.abs(d.ox) // porta numa parede ao longo de x
    bar.col = { x: d.x + d.ox * 0.2, z: d.z + d.oz * 0.2, hw: wideX ? d.w / 2 + 0.1 : 0.25, hd: wideX ? 0.25 : d.w / 2 + 0.1, h: 1, lv: 0, door: true, only: 'zombie' }
    AddColliders([bar.col])
    refresh(bar)
  }
  function detach(bar) {
    if (bar.col) RemoveColliders([bar.col])
    if (bar.group) { scene.remove(bar.group); bar.hpFill.material.dispose() }
    if (bar.door) bar.door.lock = false
    bar.b = bar.door = bar.group = bar.col = bar.boards = bar.hpFill = null
  }
  function finish(p, d, a) {
    if (inv.tabuas < COST[a]) { say('Faltam tábuas 🪵', 1.4); return }
    inv.tabuas -= COST[a]
    let bar = bars.get(d.id)
    if (a === 'build') {
      bar = { id: d.id, x: d.x, z: d.z, hp: B.hp, max: B.hp, strong: false, flashT: 0 }
      bars.set(d.id, bar)
      attach(bar, d)
      say(`${p.name} barricou a porta 🪵`)
    } else if (a === 'repair' && bar) {
      bar.hp = Math.min(bar.max, bar.hp + B.repair.hp)
      refresh(bar)
      say(`${p.name} consertou a barricada 🔨`)
    } else if (a === 'reinforce' && bar) {
      Object.assign(bar, { strong: true, max: B.hp * 2, hp: B.hp * 2 })
      if (bar.b) { const dd = DoorsNear(bar.x, bar.z, 0.3).find((o) => o.id === bar.id); detach(bar); if (dd) attach(bar, dd) } // redesenha com a 4ª tábua
      say(`${p.name} reforçou a barricada 🪵🪵`)
    }
    sfx('bang', { x: d.x, z: d.z })
    fx.burst(d.x, d.y + 1, d.z, 0xb07a48, 8, 3, 0.5)
  }
  function smash(bar) {
    const { x, z } = bar
    detach(bar)
    bars.delete(bar.id)
    sfx('crash', { x, z, power: 0.5, vol: 0.9 })
    fx.burst(x, 1, z, 0xb07a48, 16, 5, 0.8)
    if (impact) impact(x, z, 'crash', 0.6)
    say('💥 Uma barricada quebrou!', 2)
  }

  return {
    // Usar perto da porta (por dentro): barricar, consertar ou reforçar. false = nada a fazer aqui
    // ready = só se der para fazer agora (tem tábuas); sem ready, avisa quantas tábuas faltam
    use(p, ready = false) {
      if (p.task) return true
      const d = doorFor(p), a = d && actionOf(d)
      if (!a) return false
      if (inv.tabuas < COST[a]) {
        if (ready) return false
        say(`Precisa de ${COST[a]} 🪵 (revistem e desmontem móveis)`, 1.8); sfx('ui', { f: 300 }); return true
      }
      tasks.start(p, { a, icon: a === 'repair' ? '🔨' : '🪵', need: B[a].time, at: d, noise: B.noise, beat: 'bang', done: (pp) => finish(pp, d, a) })
      sfx('bang', { x: d.x, z: d.z })
      return true
    },
    // texto do botão Usar (celular) perto da porta
    label(p, ready = false) { const d = doorFor(p), a = d && actionOf(d); return a && (!ready || inv.tabuas >= COST[a]) ? `${LABEL[a]} (${COST[a]})` : '' },
    // zumbi encostado numa barricada bate nela; true = bateu
    bash(e) {
      if ((e.lv || 0) !== 0) return false
      for (const bar of bars.values()) {
        const c = bar.col
        if (!c || Math.hypot(Math.max(0, Math.abs(e.x - c.x) - c.hw), Math.max(0, Math.abs(e.z - c.z) - c.hd)) > e.radius + 0.25) continue
        bar.hp -= Z.bash.damage
        sfx('bang', { x: bar.x, z: bar.z })
        fx.burst(bar.x, 1.1, bar.z, 0xb07a48, 3, 2.5, 0.35)
        if (bar.boards) { for (const m of bar.boards) m.material = WOOD_HIT; bar.flashT = 0.08 }
        if (warnT <= 0) { say('⚠ Barricada sob ataque!', 1.6); warnT = 5 }
        if (bar.hp <= 0) smash(bar)
        else refresh(bar)
        return true
      }
      return false
    },
    update(dt) {
      warnT -= dt
      for (const bar of bars.values()) if (bar.flashT > 0 && (bar.flashT -= dt) <= 0 && bar.boards) for (const m of bar.boards) m.material = WOOD
      if ((scanT -= dt) > 0) return
      scanT = 0.25
      // a casa saiu da memória: tira o desenho; voltou: põe de novo (o estado continua)
      for (const bar of bars.values()) {
        if (bar.b && !HasBuilding(bar.b)) detach(bar)
        if (!bar.b) { const d = DoorsNear(bar.x, bar.z, 0.3).find((o) => o.id === bar.id); if (d) attach(bar, d) }
      }
    },
    // para testes e para o placar: { id, hp, max, strong }
    list: () => [...bars.values()].map(({ id, hp, max, strong }) => ({ id, hp, max, strong })),
    clear() { for (const bar of bars.values()) detach(bar); bars.clear(); warnT = 0 },
  }
}
