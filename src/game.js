import * as THREE from 'three'
import { CreatePlayerModel } from './characters/player'
import { UpdatePlayerMovement } from './characters/player-movement'
import { ClassOf, InitClassState, CreateAbilities } from './characters/classes'
import { CreateHorde } from './enemies/zombies'
import { WEAPONS } from './weapons/weapons'
import { Blocked } from './world/collision'
import { GroundAt } from './world/sidewalk'
import { CreateWaterFX } from './world/water-fx'
import { CreateFX } from './fx/effects'
import { CreateGore } from './fx/gore'
import { CreateVehicles } from './vehicles/vehicles'
import { sfx } from './audio/sfx'

const MAX_PLAYERS = 4
const REVIVE_T = 25, SUPPLY_T = 75

// hooks: { onEnd() (fim de jogo), night() (zumbis enxergam menos e são mais numerosos) }
export function CreateGame(scene, colliders, net, hooks = {}) {
  const players = new Map()
  const wfx = CreateWaterFX(scene) // ondas e respingos
  const fx = CreateFX(scene)
  const gore = CreateGore(scene) // sangue no chão/paredes e pedaços de zumbi
  const vehicles = CreateVehicles(scene, fx, wfx)
  const st = { time: 0, score: 0, over: false, overT: 0, msg: '', msgT: 0, sync: 0, supplyT: SUPPLY_T }

  const say = (t, s = 2.2) => { st.msg = t; st.msgT = s }
  const alive = () => [...players.values()].filter((p) => !p.dead)

  const horde = CreateHorde({ scene, fx, gore, players, hurt: (p, d) => hurt(p, d), hit: (...a) => hit(...a), night: hooks.night || (() => false) })
  const enemies = horde.list

  // dano num zumbi (todas as fontes: tiro, espada, magia, onda, pisão, atropelamento); p = quem leva o crédito
  function hit(e, dmg, p, kx = 0, kz = 0) {
    if (e.dying > 0) return
    if (horde.damage(e, dmg, kx, kz, p)) { st.score += e.score; if (p) p.kills++ }
  }
  const abilities = CreateAbilities({ scene, fx, wfx, colliders, enemies, players, hit, noise: horde.noise })

  // slot = vaga escolhida no lobby: define a classe (1 Atirador · 2 Samurai · 3 Mago · 4 Bardo) e o ponto de largada
  function addPlayer(id, name, slot) {
    if (players.has(id) || players.size >= MAX_PLAYERS) return
    const idx = slot ?? players.size
    const cls = ClassOf(idx)
    const model = CreatePlayerModel(cls.id)
    scene.add(model.root)
    const p = {
      id, name, idx, cls, model, x: (idx - 1.5) * 1.3, z: 0, vx: 0, vz: 0, aimAngle: Math.PI, facing: Math.PI, turn: 0, speed: 0, aiming: false, firing: false,
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
    scene.remove(p.model.root)
    players.delete(id)
  }
  function setInput(id, m) {
    const p = players.get(id)
    if (!p) return
    const i = p.input
    i.mx = +m.mx || 0; i.mz = +m.mz || 0; i.ax = +m.ax || 0; i.az = +m.az || 0; i.run = m.run ? 1 : 0
    i.fire = m.fire === undefined ? undefined : m.fire ? 1 : 0
    p.lastIn = performance.now()
  }
  // ações: b1/b2/b3 = botões da classe · shove = empurrar/pisar · use = entrar/sair do veículo · jump · (atirador) armas pelo nome
  function act(id, a) {
    const p = players.get(id)
    if (!p || p.dead) return
    if (a === 'shove') return horde.shove(p)
    if (a === 'use') return (!p.held || p.vehicle) && vehicles.use(p) // agarrado não consegue entrar no carro
    if (a === 'b1' || a === 'b2' || a === 'b3') return abilities.skill(p, +a[1] - 1)
    if (a === 'swap') return abilities.skill(p, 0) // controles antigos
    if (a === 'reload') return p.cls.id === 'gunner' && abilities.skill(p, 1)
    if (a === 'jump') { if (!p.vehicle && !p.held && p.jy <= 0.02) { p.vy = p.swim ? 7.5 : 9; sfx(p.swim ? 'swim' : 'jump', { x: p.x, z: p.z, cls: p.cls.id }) } return } // da água dá para pular para o píer/margem
    if (WEAPONS[a] && p.weapon) abilities.setWeapon(p, a)
  }

  function hurt(p, dmg) {
    if (p.dead || p.invulnT > 0) return
    if (p.vehicle) { vehicles.damage(p.vehicle, dmg * 0.9); dmg *= 0.35 } // a lataria protege
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
    Object.assign(p, { dead: false, hp: p.max * 0.5, x, z, vx: 0, vz: 0, jy: 0, vy: 0, lv: best.lv || 0, gy: best.gy, stamina: 100, tired: false, invulnT: 2 })
    p.model.hurt()
    fx.ring(x, best.gy || 0, z, 0x7aff9a, 0.2, 1.6, 0.7)
    say(`${p.name} voltou!`, 1.8)
    sfx('revive', { x, z })
  }

  function clearAll() {
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
    Object.assign(st, { time: 0, score: 0, over: false, msg: '', msgT: 0, supplyT: SUPPLY_T })
  }
  function restart() {
    clearAll()
    for (const p of players.values()) if (p.vehicle) vehicles.exit(p, true)
    vehicles.clear()
    Object.assign(st, { time: 0, score: 0, over: false, supplyT: SUPPLY_T })
    for (const p of players.values()) {
      Object.assign(p, { dead: false, stamina: 100, tired: false, jy: 0, vy: 0, lv: 0, gy: undefined, x: (p.idx - 1.5) * 1.3, z: 0, vx: 0, vz: 0, held: 0, struggle: 0, reviveT: 0 })
      InitClassState(p)
      if (p.weapon) p.model.setWeapon(p.weapon)
    }
  }

  function update(dt) {
    const now = performance.now()
    st.msgT = Math.max(0, st.msgT - dt)

    for (const p of players.values()) {
      if (now - p.lastIn > 1500 && p.id !== 'local') p.input.mx = p.input.mz = p.input.ax = p.input.az = 0
      if (p.hurtCar) { hurt(p, p.hurtCar); p.hurtCar = 0 }
      if (!p.dead && !p.vehicle) UpdatePlayerMovement(p, dt, colliders)
      else if (p.dead) { p.gy = GroundAt(p.x, p.z); p.jy = 0; p.y = p.gy; p.model.root.position.set(p.x, p.y, p.z); p.speed = 0; p.vx = p.vz = 0; p.aiming = p.firing = false }
      abilities.tick(p, dt)
      if (p.drown && !p.dead) { p.hp -= 8 * dt; if (p.hp <= 0) die(p) } // sem fôlego na água funda
    }

    // sobrevivência sem fim: o tempo conta, suprimentos de vez em quando, quem cai volta ao lado de um aliado
    if (players.size && !st.over) {
      if (st.time === 0) say('Sobreviva! Empurre os zumbis (V / Empurrar)', 4)
      st.time += dt
      const list = alive()
      for (const p of players.values()) if (p.dead && list.length && (p.reviveT -= dt) <= 0) revive(p, list)
      if ((st.supplyT -= dt) <= 0) {
        st.supplyT = SUPPLY_T
        for (const p of players.values()) for (const [w, add, cap] of [['carbine', 30, 180], ['shotgun', 8, 48]]) p.ammo[w].reserve = Math.min(p.ammo[w].reserve + add, cap)
        if ([...players.values()].some((p) => p.cls.id === 'gunner')) { say('📦 Suprimentos: +munição'); sfx('supply') }
      }
      if (!alive().length) { st.over = true; st.overT = 6; say(`FIM DE JOGO · sobreviveram ${clock(st.time)}`, 6); sfx('gameover') }
    } else if (st.over && (st.overT -= dt) <= 0) { if (hooks.onEnd) hooks.onEnd(); else restart() }

    // zumbis e veículos
    const list = [...players.values()]
    vehicles.update(dt, list, enemies, list.length ? list : [{ x: 0, z: 0 }], { hit })
    for (const p of list) p.model.animate(dt, p) // depois dos veículos: quem está sentado já tem a posição do banco
    wfx.update(dt, list.filter((p) => !p.vehicle), enemies)
    if (players.size) horde.update(dt)
    abilities.update(dt)
    fx.update(dt)
    gore.update(dt)

    // estado para os celulares
    if (net && (st.sync -= dt) <= 0) {
      st.sync = 0.15
      for (const p of players.values()) {
        if (p.id === 'local') continue
        const inf = abilities.info(p)
        const car = p.vehicle ? 2 : !p.dead && vehicles.nearest(p) ? 1 : 0
        net.send(p.id, { t: 'state', hp: Math.ceil(p.hp), max: p.max, cls: `${p.cls.icon} ${p.cls.name}`, w: inf.text, btn: inf.buttons.map((b) => [b.l, +b.cd.toFixed(2)]), car, dead: p.dead, st: Math.round(p.stamina), time: Math.floor(st.time), score: st.score, held: p.held ? 1 : 0, rv: p.dead && !st.over ? Math.ceil(p.reviveT) : 0 })
      }
    }
  }

  return { players, enemies, vehicles, st, clear, addPlayer, removePlayer, setInput, act, update, alive, zombies: () => horde.alive(), info: (p) => abilities.info(p) }
}

export const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
