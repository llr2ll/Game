import * as THREE from 'three'
import { DoorsNear, WindowsNear, BuildingAt, HasBuilding, PointInBuilding } from '../../shared/worldgen/buildings-registry'
import { AddColliders, RemoveColliders, Blocked } from '../../engine/world/collision'
import { BALANCE } from './config/balance'

// Entradas das casas: portas (J4) e janelas do térreo (J5a).
// - De dentro da casa, perto de uma entrada, Usar prega tábuas do estoque do grupo: barricar, consertar, reforçar.
// - Porta barricada só segura zumbis (gente e tiro passam pela fresta); zumbi encostado bate até quebrar.
// - Janela: zumbi atrás de alguém lá dentro vai pela janela se ela for mais perto que a porta; bate na barricada (se houver),
//   quebra o vidro e pula para dentro (leva alguns segundos). Janela quebrada continua quebrada.
// Estado por entrada (id = posição): continua lá quando o chunk sai e volta. Números em balance.js · barricade, window.
const B = BALANCE.barricade, W = BALANCE.window, Z = BALANCE.zombies
const COST = { build: B.build.planks, repair: B.repair.planks, reinforce: B.reinforce.planks }
const LABEL = { build: '🪵 Barricar', repair: '🔨 Consertar', reinforce: '🪵 Reforçar' }
const BOARD_GEO = new THREE.BoxGeometry(1, 0.2, 0.1)
const WOOD = new THREE.MeshLambertMaterial({ color: 0xc9965a })
const WOOD_HIT = new THREE.MeshBasicMaterial({ color: 0xffe2b8 })
const DOOR_BOARDS = [[0.45, 0.18], [0.95, -0.22], [1.45, 0.15], [0.7, -0.08]] // altura, inclinação (a 4ª só na reforçada)
const WIN_BOARDS = [[-0.32, 0.16], [0.02, -0.2], [0.34, 0.12], [-0.12, -0.06]] // em volta do centro da janela
// barrinha de vida deitada sobre a entrada (de cima, as tábuas se sobrepõem; a barrinha mostra qual está fraca)
const HP_GEO = new THREE.PlaneGeometry(1, 0.3).translate(0.5, 0, 0).rotateX(-Math.PI / 2)
const HP_BACK = new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.75, depthTest: false, toneMapped: false })
const HP_COLORS = [0xe25555, 0xe0b23c, 0x6fd36f] // pouca · média · muita vida
// janela quebrada: buraco escuro por fora
const HOLE_GEO = new THREE.PlaneGeometry(1, 1)
const HOLE_MAT = new THREE.MeshBasicMaterial({ color: 0x15100c, side: THREE.DoubleSide })
const HOLD = { hold: true } // zumbi parado na janela (batendo ou pulando)
const rnd = (a, b) => a + Math.random() * (b - a)

// descritores de entrada (porta ou janela), com o que é preciso para desenhar
const doorEntry = (d) => ({ kind: 'door', id: d.id, x: d.x, z: d.z, ox: d.ox, oz: d.oz, w: d.w, y: d.y, ry: d.ry, d: d.d, b: d.b })
const winEntry = (w) => ({ kind: 'window', id: w.id, x: w.x, z: w.z, ox: w.nx, oz: w.nz, w: w.w, y: w.b.y, cy: w.y - w.b.y, ry: Math.atan2(w.nx, w.nz), b: w.b })
const inside = (en, k = 0.8) => ({ x: en.x - en.ox * k, z: en.z - en.oz * k }) // ponto dentro da casa, na frente da entrada
const outside = (en, k = 0.6) => ({ x: en.x + en.ox * k, z: en.z + en.oz * k })

// ctx: { scene, fx, inv (estoque do grupo), say(texto, s), sfx(nome, opções), tasks, impact(x, z, tipo, força), solo() (jogando sozinho?) }
export function CreateBarricades({ scene, fx, inv, say, sfx, tasks, impact, solo = () => false }) {
  const bars = new Map() // id da entrada -> { id, kind, x, z, hp, max, strong, b, door, group, col, boards, hpFill, flashT }
  const wins = new Map() // id da janela -> { id, glass, broken, en, hole }
  const usable = new Map() // id da janela -> dá para pular para dentro? (móvel ou escada na frente = não)
  let scanT = 0, warnT = 0

  // entrada ao alcance de quem está dentro da casa (térreo): porta ou janela, a mais perto
  function entryFor(p) {
    if (p.dead || p.vehicle || (p.lv || 0) !== 0 || !PointInBuilding(p.x, p.z)) return null
    let best = null, bd = Infinity
    for (const d of DoorsNear(p.x, p.z, B.reach)) { const dd = Math.hypot(d.x - p.x, d.z - p.z); if (dd < bd) { bd = dd; best = doorEntry(d) } }
    for (const w of WindowsNear(p.x, p.z, W.reach + 1)) { const en = winEntry(w), i = inside(en), dd = Math.hypot(i.x - p.x, i.z - p.z); if (dd < W.reach && dd < bd) { bd = dd; best = en } }
    return best
  }
  function actionOf(en) {
    const bar = bars.get(en.id)
    if (!bar) return 'build'
    if (bar.hp < bar.max) return 'repair'
    return bar.strong ? null : 'reinforce'
  }
  // acha de novo a entrada pelo id (depois que a casa volta para a memória)
  function find(kind, id, x, z) {
    const o = (kind === 'door' ? DoorsNear(x, z, 0.3) : WindowsNear(x, z, 0.3)).find((q) => q.id === id)
    return o ? (kind === 'door' ? doorEntry(o) : winEntry(o)) : null
  }

  // tábuas visíveis (menos tábuas = mais perto de quebrar) e barrinha de vida
  function refresh(bar) {
    if (!bar.group) return
    const k = Math.max(0, bar.hp / bar.max), show = Math.max(1, Math.ceil(k * bar.boards.length))
    bar.boards.forEach((m, i) => (m.visible = i < show))
    bar.hpFill.scale.x = Math.max(0.02, k) * bar.w
    bar.hpFill.material.color.setHex(HP_COLORS[k > 0.5 ? 2 : k > 0.25 ? 1 : 0])
  }
  // desenho (+ colisor só para zumbis, na porta) quando a casa está carregada
  function attach(bar, en) {
    const door = en.kind === 'door'
    bar.b = en.b
    if (door) { bar.door = en.d; en.d.lock = true } // zumbi não abre esta porta
    const g = new THREE.Group()
    g.position.set(en.x + en.ox * 0.25, en.y, en.z + en.oz * 0.25) // do lado de fora
    g.rotation.y = en.ry
    bar.boards = (door ? DOOR_BOARDS : WIN_BOARDS).slice(0, bar.strong ? 4 : 3).map(([y, tilt]) => {
      const m = new THREE.Mesh(BOARD_GEO, WOOD)
      m.scale.x = en.w * 1.2
      m.position.y = door ? y : en.cy + y
      m.rotation.set(door ? 0.45 : 0.3, 0, tilt) // escorada: o topo pende para fora (assim aparece vista de cima)
      g.add(m)
      return m
    })
    bar.w = en.w
    const hy = door ? 2.5 : en.cy + 0.9
    const back = new THREE.Mesh(HP_GEO, HP_BACK)
    back.scale.x = en.w; back.position.set(-en.w / 2, hy, 0); back.renderOrder = 4
    bar.hpFill = new THREE.Mesh(HP_GEO, new THREE.MeshBasicMaterial({ color: HP_COLORS[2], depthTest: false, toneMapped: false }))
    bar.hpFill.position.set(-en.w / 2, hy + 0.01, 0); bar.hpFill.renderOrder = 5
    g.add(back, bar.hpFill)
    scene.add(g)
    bar.group = g
    if (door) {
      const wideX = Math.abs(en.oz) > Math.abs(en.ox) // porta numa parede ao longo de x
      bar.col = { x: en.x + en.ox * 0.2, z: en.z + en.oz * 0.2, hw: wideX ? en.w / 2 + 0.1 : 0.25, hd: wideX ? 0.25 : en.w / 2 + 0.1, h: 1, lv: 0, door: true, only: 'zombie' }
      AddColliders([bar.col])
    }
    refresh(bar)
  }
  function detach(bar) {
    if (bar.col) RemoveColliders([bar.col])
    if (bar.group) { scene.remove(bar.group); bar.hpFill.material.dispose() }
    if (bar.door) bar.door.lock = false
    bar.b = bar.door = bar.group = bar.col = bar.boards = bar.hpFill = null
  }
  // buraco escuro na janela quebrada (quando a casa está carregada)
  function showHole(wn, en) {
    const m = new THREE.Mesh(HOLE_GEO, HOLE_MAT)
    m.scale.set(en.w * 0.8, 0.95, 1)
    m.position.set(en.x + en.ox * 0.13, en.y + en.cy, en.z + en.oz * 0.13)
    m.rotation.y = en.ry
    scene.add(m)
    wn.hole = m; wn.b = en.b
  }
  function finish(p, en, a) {
    if (inv.tabuas < COST[a]) { say('Faltam tábuas 🪵', 1.4); return }
    inv.tabuas -= COST[a]
    const what = en.kind === 'door' ? 'a porta' : 'a janela'
    let bar = bars.get(en.id)
    if (a === 'build') {
      bar = { id: en.id, kind: en.kind, x: en.x, z: en.z, hp: B.hp, max: B.hp, strong: false, flashT: 0 }
      bars.set(en.id, bar)
      attach(bar, en)
      say(`${p.name} barricou ${what} 🪵`)
    } else if (a === 'repair' && bar) {
      bar.hp = Math.min(bar.max, bar.hp + B.repair.hp)
      refresh(bar)
      say(`${p.name} consertou a barricada 🔨`)
    } else if (a === 'reinforce' && bar) {
      Object.assign(bar, { strong: true, max: B.hp * 2, hp: B.hp * 2 })
      if (bar.b) { const again = find(bar.kind, bar.id, bar.x, bar.z); detach(bar); if (again) attach(bar, again) } // redesenha com a 4ª tábua
      say(`${p.name} reforçou a barricada 🪵🪵`)
    }
    sfx('bang', { x: en.x, z: en.z })
    fx.burst(en.x, en.y + 1, en.z, 0xb07a48, 8, 3, 0.5)
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
  // uma pancada de zumbi numa barricada
  function hit(bar) {
    bar.hp -= Z.bash.damage * (solo() ? BALANCE.solo.bash : 1)
    sfx('bang', { x: bar.x, z: bar.z })
    fx.burst(bar.x, 1.1, bar.z, 0xb07a48, 3, 2.5, 0.35)
    if (bar.boards) { for (const m of bar.boards) m.material = WOOD_HIT; bar.flashT = 0.08 }
    if (warnT <= 0) { say('⚠ Barricada sob ataque!', 1.6); warnT = 5 }
    if (bar.hp <= 0) smash(bar)
    else refresh(bar)
  }
  // dá para entrar por esta janela? (o ponto lá dentro não pode estar ocupado por móvel ou escada)
  function canUse(en) {
    if (!usable.has(en.id)) { const i = inside(en); usable.set(en.id, !Blocked(i.x, i.z, 0.35, 0)) }
    return usable.get(en.id)
  }
  // zumbi na janela: barricada → vidro → pular
  function atWindow(e, en, dt) {
    e.heading = Math.atan2(-en.ox, -en.oz) // olha para dentro
    const bar = bars.get(en.id)
    let wn = wins.get(en.id)
    if (!wn) wins.set(en.id, (wn = { id: en.id, glass: W.glass, broken: false, en, hole: null, b: null }))
    if (bar || !wn.broken) {
      e.climbT = 0
      if ((e.winT = (e.winT || 0) - dt) > 0) return HOLD
      e.winT = rnd(Z.bash.every[0], Z.bash.every[1])
      if (bar) { hit(bar); return HOLD }
      wn.glass -= Z.bash.damage
      sfx('bang', { x: en.x, z: en.z, vol: 0.6 })
      if (wn.glass <= 0) {
        wn.broken = true
        sfx('crash', { x: en.x, z: en.z, power: 1, vol: 0.55 }) // vidro
        fx.burst(en.x + en.ox * 0.2, en.y + en.cy, en.z + en.oz * 0.2, 0xcfeaff, 12, 3.5, 0.5)
        showHole(wn, en)
      }
      return HOLD
    }
    // janela aberta: pula para dentro
    if ((e.climbT = (e.climbT || 0) + dt) < W.climb) return HOLD
    const i = inside(en)
    Object.assign(e, { x: i.x, z: i.z, lx: i.x, lz: i.z, lv: 0, climbT: 0, ent: null, entT: 0.6 })
    sfx('bodyfall', { x: i.x, z: i.z })
    return HOLD
  }

  return {
    // Usar perto de uma entrada (por dentro): barricar, consertar ou reforçar. false = nada a fazer aqui
    // ready = só se der para fazer agora (tem tábuas); sem ready, avisa quantas tábuas faltam
    use(p, ready = false) {
      if (p.task) return true
      const en = entryFor(p), a = en && actionOf(en)
      if (!a) return false
      if (inv.tabuas < COST[a]) {
        if (ready) return false
        say(`Precisa de ${COST[a]} 🪵 (revistem e desmontem móveis)`, 1.8); sfx('ui', { f: 300 }); return true
      }
      tasks.start(p, { a, icon: a === 'repair' ? '🔨' : '🪵', need: B[a].time, at: en, noise: B.noise, beat: 'bang', done: (pp) => finish(pp, en, a) })
      sfx('bang', { x: en.x, z: en.z })
      return true
    },
    // texto do botão Usar (celular) perto de uma entrada
    label(p, ready = false) { const en = entryFor(p), a = en && actionOf(en); return a && (!ready || inv.tabuas >= COST[a]) ? `${LABEL[a]} (${COST[a]})` : '' },
    // zumbi encostado numa porta barricada bate nela; true = bateu
    bash(e) {
      if ((e.lv || 0) !== 0) return false
      for (const bar of bars.values()) {
        const c = bar.col
        if (!c || Math.hypot(Math.max(0, Math.abs(e.x - c.x) - c.hw), Math.max(0, Math.abs(e.z - c.z) - c.hd)) > e.radius + 0.25) continue
        hit(bar)
        return true
      }
      return false
    },
    // zumbi indo até (tx, tz): se o alvo está numa casa e a janela é mais perto que a porta, vai pela janela.
    // Devolve null (segue normal, pela porta), { x, z } (ande até aqui) ou { hold } (parado na janela)
    entry(e, tx, tz, dt) {
      if ((e.entT = (e.entT || 0) - dt) <= 0) {
        e.entT = 0.3
        e.ent = null
        const b = (e.lv || 0) === 0 && BuildingAt(tx, tz)
        if (b && !(e.x > b.x0 && e.x < b.x1 && e.z > b.z0 && e.z < b.z1)) {
          const door = b.door, dd = Math.hypot(door.x + b.sn * 0.8 - e.x, door.z + b.cs * 0.8 - e.z)
          let bd = dd - W.prefer
          for (const w of b.windows) {
            const en = winEntry({ ...w, b }), o = outside(en), d = Math.hypot(o.x - e.x, o.z - e.z)
            if (d < bd && canUse(en)) { bd = d; e.ent = en }
          }
        }
      }
      const en = e.ent
      if (!en) return null
      const o = outside(en)
      if (Math.hypot(o.x - e.x, o.z - e.z) > 0.55) { e.climbT = 0; return o }
      return atWindow(e, en, dt)
    },
    update(dt) {
      warnT -= dt
      for (const bar of bars.values()) if (bar.flashT > 0 && (bar.flashT -= dt) <= 0 && bar.boards) for (const m of bar.boards) m.material = WOOD
      if ((scanT -= dt) > 0) return
      scanT = 0.25
      // a casa saiu da memória: tira o desenho; voltou: põe de novo (o estado continua)
      for (const bar of bars.values()) {
        if (bar.b && !HasBuilding(bar.b)) detach(bar)
        if (!bar.b) { const en = find(bar.kind, bar.id, bar.x, bar.z); if (en) attach(bar, en) }
      }
      for (const wn of wins.values()) {
        if (!wn.broken) continue
        if (wn.hole && !HasBuilding(wn.b)) { scene.remove(wn.hole); wn.hole = null; wn.b = null }
        if (!wn.hole) { const en = find('window', wn.id, wn.en.x, wn.en.z); if (en) showHole(wn, en) }
      }
    },
    // para testes e para o placar
    list: () => [...bars.values()].map(({ id, kind, hp, max, strong }) => ({ id, kind, hp, max, strong })),
    broken: () => [...wins.values()].filter((w) => w.broken).map((w) => w.id),
    clear() {
      for (const bar of bars.values()) detach(bar)
      bars.clear()
      for (const wn of wins.values()) if (wn.hole) scene.remove(wn.hole)
      wins.clear()
      warnT = 0
    },
  }
}
