import * as THREE from 'three'
import { CreatePlayerModel } from '../../../shared/characters/player'
import { UpdatePlayerMovement } from '../../../shared/characters/player-movement'
import { ClassOf, InitClassState, CreateAbilities } from '../abilities/classes'
import { CreateHorde } from '../enemies/zombies'
import { WEAPONS } from '../config/weapons'
import { Blocked } from '../../../engine/world/collision'
import { GroundAt } from '../../../shared/worldgen/sidewalk'
import { CreateWaterFX } from '../../../shared/fx/water-fx'
import { CreateFX } from '../../../shared/fx/effects'
import { CreateGore } from '../../../shared/fx/gore'
import { CreateVehicles } from '../../../shared/vehicles/vehicles'
import { sfx } from '../../../shared/audio/sfx'
import { ApplyInput } from '../../../engine/input/contract'
import { BALANCE } from '../config/balance'
import { PLAYER_COLORS } from '../../../engine/render/splitscreen'
import { CreateLoot } from '../loot'
import { CreateTasks } from '../tasks'
import { CreateBarricades } from '../barricades'
import { CreateBase } from '../base'
import { CreateSiege } from '../siege'

const MAX_PLAYERS = 4
// números das regras: config/balance.js
const RU = BALANCE.rules, PL = BALANCE.player, J = BALANCE.juice
const REVIVE_T = RU.revive.time
// movimento (shared) com os números deste jogo; a balada do Bardo também acelera
const MOVE = { ...PL, buffSpeed: BALANCE.bard.courage.speed }
// anel da cor da vaga no chão, sob os pés: com classes repetidas, cada um se acha na tela (desenhado depois da sombra)
const RING_GEO = new THREE.RingGeometry(0.5, 0.68, 28).rotateX(-Math.PI / 2)
const RING_MAT = PLAYER_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false }))

// hooks: { onEnd() (fim de jogo), night() (zumbis enxergam menos e são mais numerosos), loaded(x, z) (chunk carregado?),
//          clock() / setClock(t) (hora do dia 0..1: o cerco conta as noites; sem relógio = sem cerco),
//          shake(x, z, power, time, radius) (tremor nas telas perto) }
export function CreateGame(scene, colliders, net, hooks = {}) {
  const players = new Map()
  const wfx = CreateWaterFX(scene) // ondas e respingos
  const fx = CreateFX(scene)
  const gore = CreateGore(scene) // sangue no chão/paredes e pedaços de zumbi
  const vehicles = CreateVehicles(scene, fx, wfx)
  const st = { time: 0, score: 0, over: false, overT: 0, msg: '', msgT: 0, sync: 0, stopT: 0, result: null }

  // sensação de impacto: tremor nas telas perto e, nos golpes fortes, uma pausa curtinha no jogo (números em balance.js · juice)
  function impact(x, z, kind, amount = 1) {
    const sh = (J.shake[kind] || 0) * amount * J.shake.scale
    if (sh > 0 && hooks.shake) hooks.shake(x, z, sh, J.shake.time, J.shake.radius)
    if (J.hitStop[kind]) st.stopT = Math.max(st.stopT, J.hitStop[kind])
  }

  const say = (t, s = 2.2) => { st.msg = t; st.msgT = s }
  const alive = () => [...players.values()].filter((p) => !p.dead)

  const horde = CreateHorde({ scene, fx, gore, players, hurt: (p, d) => hurt(p, d), hit: (...a) => hit(...a), night: hooks.night || (() => false), loaded: hooks.loaded || (() => true), impact, bash: (e) => bars.bash(e), entry: (e, x, z, dt) => bars.entry(e, x, z, dt), director: () => siege.director() })
  const enemies = horde.list

  // dano num zumbi (todas as fontes: tiro, espada, magia, onda, pisão, atropelamento); p = quem leva o crédito
  function hit(e, dmg, p, kx = 0, kz = 0) {
    if (e.dying > 0) return
    if (horde.damage(e, dmg, kx, kz, p)) { st.score += e.score; if (p) p.kills++ }
  }
  // barulho das habilidades: chama a horda e desenha o anel até onde o som chegou (no máx. 1 por lugar a cada pouco)
  const ringT = new Map()
  function noise(x, z, r) {
    horde.noise(x, z, r)
    const R = J.noiseRing
    if (r < R.min) return
    const k = `${Math.round(x / 3)},${Math.round(z / 3)}`
    if (ringT.get(k) > st.time) return
    if (ringT.size > 64) for (const [kk, t] of ringT) if (t <= st.time) ringT.delete(kk)
    ringT.set(k, st.time + R.every)
    fx.ring(x, GroundAt(x, z), z, R.color, 0.6, r, R.time, { alpha: R.alpha })
  }
  const abilities = CreateAbilities({ scene, fx, wfx, colliders, enemies, players, hit, noise, impact, night: hooks.night || (() => false) })
  const tasks = CreateTasks({ scene, noise, sfx }) // parado fazendo algo (revistar, desmontar, barricar)
  const loot = CreateLoot({ scene, fx, players, say, sfx, tasks }) // saque nas casas (Usar perto de um móvel)
  const bars = CreateBarricades({ scene, fx, inv: loot.inv, say, sfx, tasks, impact }) // barricadas em portas e janelas (Usar por dentro)
  const base = CreateBase({ scene, say, sfx }) // rádio: a casa onde ele está é a base
  const siege = CreateSiege({ clock: hooks.clock, base, say, sfx }) // noites, picos da horda contra a base, vitória

  // slot = vaga do lobby: cor e ponto de largada · choice = classe escolhida (0 Atirador · 1 Samurai · 2 Mago · 3 Bardo; sem escolha = a da vaga)
  function addPlayer(id, name, slot, choice) {
    if (players.has(id) || players.size >= MAX_PLAYERS) return
    const idx = slot ?? players.size
    const cls = ClassOf(choice ?? idx)
    const model = CreatePlayerModel(cls.id)
    const ring = new THREE.Mesh(RING_GEO, RING_MAT[idx % 4])
    ring.renderOrder = 2
    scene.add(model.root, ring)
    const p = {
      id, name, idx, cls, model, ring, x: (idx - 1.5) * 1.3, z: 0, vx: 0, vz: 0, aimAngle: Math.PI, facing: Math.PI, turn: 0, speed: 0, aiming: false, firing: false,
      jy: 0, vy: 0, gy: 0, y: 0, lv: 0, stamina: 100, tired: false, running: false, cool: 0, kills: 0, lastIn: performance.now(),
      dead: false, vehicle: null, seat: null, pad: 0, hurtCar: 0, held: 0, struggle: 0, shoveCd: 0, reviveT: 0,
      input: { mx: 0, mz: 0, ax: 0, az: 0, run: 0 },
    }
    InitClassState(p)
    if (p.weapon) model.setWeapon(p.weapon)
    players.set(id, p)
  }
  function removePlayer(id) {
    const p = players.get(id)
    if (!p) return
    if (p.vehicle) vehicles.exit(p, true)
    horde.releasePlayer(p)
    scene.remove(p.model.root, p.ring)
    players.delete(id)
  }
  function setInput(id, m) {
    const p = players.get(id)
    if (!p) return
    ApplyInput(p.input, m)
    p.lastIn = performance.now()
  }
  // ações: b1/b2/b3 = botões da classe · shove = empurrar/pisar · use = entrar/sair do veículo · jump · (atirador) armas pelo nome
  function act(id, a) {
    const p = players.get(id)
    if (!p || p.dead) return
    if (a === 'shove') return horde.shove(p)
    if (a === 'use') { if (!p.vehicle && !p.held && (bars.use(p, true) || loot.use(p) || base.use(p) || bars.use(p))) return; return (!p.held || p.vehicle) && vehicles.use(p) } // móvel ao alcance primeiro; agarrado não entra no carro
    if (a === 'b1' || a === 'b2' || a === 'b3') return abilities.skill(p, +a[1] - 1)
    if (a === 'swap') return abilities.skill(p, 0) // controles antigos
    if (a === 'reload') return p.cls.id === 'gunner' && abilities.skill(p, 1)
    if (a === 'jump') { if (!p.vehicle && !p.held && p.jy <= 0.02) { p.vy = p.swim ? PL.jumpWater : PL.jump; sfx(p.swim ? 'swim' : 'jump', { x: p.x, z: p.z, cls: p.cls.id }) } return } // da água dá para pular para o píer/margem
    if (WEAPONS[a] && p.weapon) abilities.setWeapon(p, a)
  }

  function hurt(p, dmg) {
    if (p.dead || p.invulnT > 0) return
    if (p.vehicle) { vehicles.damage(p.vehicle, dmg * RU.vehicle.carDamage); dmg *= RU.vehicle.playerDamage } // a lataria protege
    p.hp -= dmg
    p.model.hurt()
    if (p.hp > 0 && !(p.hurtT > performance.now())) { p.hurtT = performance.now() + 350; sfx('hurt', { x: p.x, z: p.z, cls: p.cls.id }) }
    net && p.id !== 'local' && net.send(p.id, { t: 'hit' })
    if (p.hp <= 0) die(p)
  }
  function die(p) {
    p.hp = 0; p.dead = true; p.reload = 0; p.dashT = 0; p.struggle = 0
    p.reviveT = REVIVE_T
    if (p.vehicle) vehicles.exit(p, true)
    p.model.die()
    sfx('death', { x: p.x, z: p.z, cls: p.cls.id })
  }
  // quem caiu volta depois de um tempo ao lado de um aliado vivo (o bardo revive na hora com a canção)
  function revive(p, list) {
    let best = list[0]
    for (const o of list) if ((o.x - p.x) ** 2 + (o.z - p.z) ** 2 < (best.x - p.x) ** 2 + (best.z - p.z) ** 2) best = o
    let x = best.x, z = best.z
    for (let n = 0; n < 8; n++) {
      const a = (n / 8) * Math.PI * 2, tx = best.x + Math.sin(a) * 1.4, tz = best.z + Math.cos(a) * 1.4
      if (!Blocked(tx, tz, 0.5, best.lv || 0)) { x = tx; z = tz; break }
    }
    Object.assign(p, { dead: false, hp: p.max * RU.revive.hp, x, z, vx: 0, vz: 0, jy: 0, vy: 0, lv: best.lv || 0, gy: best.gy, stamina: 100, tired: false, invulnT: RU.revive.invulnerable })
    p.model.hurt()
    fx.ring(x, best.gy || 0, z, 0x7aff9a, 0.2, 1.6, 0.7)
    say(`${p.name} voltou!`, 1.8)
    sfx('revive', { x, z })
  }

  // fim da partida: resultado na tela por um tempo e depois volta ao menu
  function finish(win) {
    st.over = true
    st.overT = RU.resultTime
    const kills = [...players.values()].reduce((n, p) => n + p.kills, 0)
    st.result = { win, nights: win ? BALANCE.siege.nights : Math.max(0, siege.st.night - (siege.st.wasNight ? 1 : 0)), of: BALANCE.siege.nights, time: clock(st.time), kills, score: st.score, bars: bars.list().length, broken: bars.broken().length, loot: loot.text(), base: !!base.at() }
    st.msg = ''; st.msgT = 0 // o painel de resultado (hud.js) mostra tudo
    sfx(win ? 'supply' : 'gameover')
  }
  function clearAll() {
    siege.clear()
    loot.clear()
    bars.clear()
    base.clear()
    tasks.clear(players.values())
    horde.clear()
    abilities.clear()
    fx.clear()
    gore.clear()
  }
  // volta ao estado inicial, sem jogadores nem zumbis (usado ao voltar para o lobby)
  function clear() {
    for (const p of [...players.keys()]) removePlayer(p)
    clearAll()
    vehicles.clear()
    Object.assign(st, { time: 0, score: 0, over: false, msg: '', msgT: 0, stopT: 0, result: null })
  }
  function restart() {
    clearAll()
    for (const p of players.values()) if (p.vehicle) vehicles.exit(p, true)
    vehicles.clear()
    Object.assign(st, { time: 0, score: 0, over: false, stopT: 0, result: null })
    for (const p of players.values()) {
      Object.assign(p, { dead: false, stamina: 100, tired: false, jy: 0, vy: 0, lv: 0, gy: undefined, x: (p.idx - 1.5) * 1.3, z: 0, vx: 0, vz: 0, held: 0, struggle: 0, reviveT: 0 })
      InitClassState(p)
      if (p.weapon) p.model.setWeapon(p.weapon)
    }
  }

  function update(dt) {
    // pausa no impacto: o jogo quase para por alguns centésimos de segundo
    if (st.stopT > 0) { st.stopT -= dt; dt *= 0.05 }
    const now = performance.now()
    st.msgT = Math.max(0, st.msgT - dt)

    for (const p of players.values()) {
      if (now - p.lastIn > 1500 && p.id !== 'local') p.input.mx = p.input.mz = p.input.ax = p.input.az = 0
      if (p.hurtCar) { hurt(p, p.hurtCar); p.hurtCar = 0 }
      if (!p.dead && !p.vehicle) UpdatePlayerMovement(p, dt, colliders, MOVE)
      else if (p.dead) { p.gy = GroundAt(p.x, p.z); p.jy = 0; p.y = p.gy; p.model.root.position.set(p.x, p.y, p.z); p.speed = 0; p.vx = p.vz = 0; p.aiming = p.firing = false }
      abilities.tick(p, dt)
      tasks.tick(p, dt)
      if (p.drown && !p.dead) { p.hp -= PL.drown * dt; if (p.hp <= 0) die(p) } // sem fôlego na água funda
    }

    // cerco: começa ao meio-dia; aguentar as noites até o resgate; quem cai volta ao lado de um aliado
    if (players.size && !st.over) {
      if (st.time === 0) {
        if (hooks.setClock) hooks.setClock(BALANCE.siege.start)
        say(`📻 Rádio: o exército chega no amanhecer do ${BALANCE.siege.nights + 1}º dia. Ponham o rádio numa casa e barriquem!`, 6)
      }
      st.time += dt
      const list = alive()
      for (const p of players.values()) if (p.dead && list.length && (p.reviveT -= dt) <= 0) revive(p, list)
      if (siege.update() === 'win') finish(true)
      else if (!alive().length) finish(false)
    } else if (st.over && (st.overT -= dt) <= 0) { if (hooks.onEnd) hooks.onEnd(); else restart() }

    // zumbis e veículos
    const list = [...players.values()]
    vehicles.update(dt, list, enemies, list.length ? list : [{ x: 0, z: 0 }], { hit, impact })
    for (const p of list) { // depois dos veículos: quem está sentado já tem a posição do banco
      p.model.animate(dt, p)
      p.ring.visible = !p.vehicle
      p.ring.position.set(p.x, (p.y || 0) - (p.jy || 0) + 0.1, p.z) // no chão, mesmo pulando
    }
    wfx.update(dt, list.filter((p) => !p.vehicle), enemies)
    if (players.size) horde.update(dt)
    abilities.update(dt)
    loot.update(dt, list)
    bars.update(dt)
    base.update(dt)
    tasks.update(list)
    fx.update(dt)
    gore.update(dt)

    // estado para os celulares
    if (net && (st.sync -= dt) <= 0) {
      st.sync = 0.15
      for (const p of players.values()) {
        if (p.id === 'local') continue
        const inf = abilities.info(p)
        const car = p.vehicle ? 2 : !p.dead && vehicles.nearest(p) ? 1 : 0
        net.send(p.id, { t: 'state', hp: Math.ceil(p.hp), max: p.max, cls: `${p.cls.icon} ${p.cls.name}`, w: inf.text, btn: inf.buttons.map((b) => [b.l, +b.cd.toFixed(2)]), car, dead: p.dead, st: Math.round(p.stamina), time: Math.floor(st.time), score: st.score, held: p.held ? 1 : 0, rv: p.dead && !st.over ? Math.ceil(p.reviveT) : 0, u: bars.label(p, true) || loot.label(p) || base.label(p) || bars.label(p), inv: invText() })
      }
    }
  }

  // estoque do grupo + base marcada (placar e celular)
  const invText = () => loot.text() + (base.at() ? '  📻' : '')
  return { players, enemies, vehicles, loot, bars, base, siege, invText, st, clear, addPlayer, removePlayer, setInput, act, update, alive, zombies: () => horde.alive(), info: (p) => abilities.info(p) }
}

export const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
