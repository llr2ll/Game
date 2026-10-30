import * as THREE from 'three'
import { resolve, Blocked, HitWall } from '../world/collision'
import { GroundAt, TooDeep } from '../world/sidewalk'
import { FloorAt, PointInBuilding } from '../world/buildings-registry'
import { InZone } from '../world/layout'
import { ChunkLoaded } from '../world/chunks/manager'
import { CreateZombieModel, VARIANTS, GETUP_T } from './zombie-model'
import { Navigate, wrap, turnTo } from './pathing'
import { sfx, gate } from '../audio/sfx'

// Zumbis no estilo Project Zomboid: andam devagar e em bando, enxergam num cone à frente e ouvem barulho
// (tiro, explosão, carro, corrida). Chegando perto dão o bote e AGARRAM: o jogador fica preso e leva mordidas
// até se soltar — empurrão (V / botão Empurrar), puxar o stick para longe, ou um aliado derrubar o zumbi.
// Empurrão faz tropeçar ou derruba; zumbi caído toma pisão. Quem fica longe dos jogadores renasce perto deles.
//
// Estados: wander (vaga) · investigate (vai até um barulho) · chase · lunge (bote) · grab · stagger (tropeça)
//          down (caído) · getup · feed (come quem caiu) · dead (corpo no chão, afunda e some)
const RADIUS = 0.42
const SPEED = { wander: 0.6, investigate: 1.2, chase: 1.9, fast: 3.3 }
const SIGHT = { day: 16, night: 9 }, FOV = 1.2, FEEL = 3.2, LOSE_T = 6 // FEEL = percebe por perto mesmo sem ver
const REACH = 0.95, HOLD = 0.68, LUNGE_T = 0.42
const BITE = [6, 9], SCRATCH = 3
const SPAWN_MIN = 24, SPAWN_MAX = 36, FAR = 52, MAX_ZOMBIES = 55, CORPSE_T = 14, MAX_CORPSES = 20
const BLOOD = 0x6a1612

const _v = new THREE.Vector3()
const rnd = (a, b) => a + Math.random() * (b - a)
const sameLv = (a, b) => (a.lv || 0) === (b.lv || 0)

// ctx: { scene, fx, gore, players (Map), hurt(p, dmg), hit(e, dmg, p, kx, kz), night() }
export function CreateHorde(ctx) {
  const { scene, fx, gore } = ctx
  const list = []
  const st = { spawnT: 0, noiseT: 0, farT: 0, time: 0 }
  const alivePlayers = () => [...ctx.players.values()].filter((p) => !p.dead)

  function make(x, z) {
    const m = CreateZombieModel((Math.random() * VARIANTS) | 0)
    const e = { type: 'zombie', radius: RADIUS, group: m.root, rig: m, kx: 0, kz: 0, slowT: 0, side: 1, carT: 0 }
    m.root.scale.setScalar(rnd(0.92, 1.08))
    scene.add(m.root)
    list.push(e)
    reset(e, x, z)
    return e
  }
  // (re)nasce num ponto: também usado para reaproveitar quem ficou longe demais
  function reset(e, x, z) {
    const fast = Math.random() < Math.min(0.08 + st.time / 1200, 0.3) // corredores ficam mais comuns com o tempo
    const hp = fast ? rnd(4.5, 5.5) : rnd(7, 9.5) // ~4 tiros de pistola, 3 golpes de katana
    Object.assign(e, {
      x, z, lx: x, lz: z, fy: GroundAt(x, z), lv: 0, heading: Math.random() * Math.PI * 2, vel: 0,
      hp, maxHp: hp, fast, score: fast ? 15 : 10, speed: fast ? rnd(3.0, 3.5) : rnd(1.6, 2.15),
      state: 'wander', stT: 0, dur: 0, target: null, seenT: 0, tx: x, tz: z, goal: null, waitT: rnd(0, 3),
      senseT: Math.random() * 0.3, cool: 0.5, biteT: 0, bite: 0, hitT: 0, imp: 0, dying: 0, fallDir: -1,
      kx: 0, kz: 0, slowT: 0, path: null, pathT: 0, unstick: 0, stuckT: 0, sx: x, sz: z, moving: 0, t: Math.random() * 10,
    })
    if (e.ice) e.ice.visible = false
    e.rig.restore() // reaproveitado: volta inteiro
    e.group.position.set(x, e.fy, z)
  }
  function remove(i) { scene.remove(list[i].group); list.splice(i, 1) }

  // ---------------------------------------------------------------- estados
  function setState(e, s, dur = 0) { e.state = s; e.stT = 0; e.dur = dur }
  function release(e) { if (e.state === 'grab') { e.cool = Math.max(e.cool, 1.2); setState(e, 'chase') } }
  function stagger(e, dur) {
    if (e.state === 'dead' || e.state === 'down') return
    release(e)
    setState(e, 'stagger', dur)
    if (gate('zstagger', 0.1)) sfx('zstagger', { x: e.x, z: e.z })
  }
  function knockDown(e, dx, dz) {
    if (e.state === 'dead') return
    release(e)
    // empurrado na direção para onde olha = cai de bruços; de frente = de costas
    if (e.state !== 'down') { e.fallDir = dx * Math.sin(e.heading) + dz * Math.cos(e.heading) > 0 ? 1 : -1; sfx('bodyfall', { x: e.x, z: e.z, delay: 0.3 }) }
    setState(e, 'down', rnd(2.2, 3.6))
  }
  function chase(e, p) {
    if (e.state === 'grab' || e.state === 'dead') return
    e.target = p; e.seenT = 0; e.tx = p.x; e.tz = p.z
    if (e.state === 'wander' || e.state === 'investigate' || e.state === 'feed') setState(e, 'chase')
  }
  function investigate(e, x, z) {
    e.goal = { x, z }
    setState(e, 'investigate')
  }

  // ---------------------------------------------------------------- sentidos
  // visão: cone à frente, alcance menor à noite, paredes bloqueiam (amostra a linha a cada 1 m)
  function sees(e, p, range) {
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz)
    if (d > range || !sameLv(e, p)) return false
    if (d < FEEL) return true
    if (Math.abs(wrap(Math.atan2(dx, dz) - e.heading)) > FOV) return false
    const n = Math.floor(d)
    for (let i = 1; i < n; i++) if (HitWall(e.x + (dx * i) / d, e.z + (dz * i) / d, e.lv || 0)) return false
    return true
  }
  function sense(e, players, range) {
    const cur = e.state === 'chase' && e.target && !e.target.dead ? e.target : null
    if (cur && sees(e, cur, range)) { e.seenT = 0; e.tx = cur.x; e.tz = cur.z }
    let best = null, bd = Infinity
    for (const p of players) {
      if (p.dead || p === cur) continue
      const d = Math.hypot(p.x - e.x, p.z - e.z)
      if (d < bd && sees(e, p, e.state === 'feed' ? Math.min(range, 6) : range)) { best = p; bd = d }
    }
    if (!best) return
    if (e.state === 'chase') {
      // troca de alvo se outro está bem mais perto (ou perdeu o atual de vista)
      if (!cur || e.seenT > 0 || bd < Math.hypot(cur.x - e.x, cur.z - e.z) - 3) { e.target = best; e.seenT = 0; e.tx = best.x; e.tz = best.z }
      return
    }
    chase(e, best)
    // o bando vem junto: quem está vagando por perto vai ver o que é
    for (const o of list) if (o !== e && (o.state === 'wander' || o.state === 'feed') && Math.hypot(o.x - e.x, o.z - e.z) < 8) investigate(o, best.x + rnd(-2, 2), best.z + rnd(-2, 2))
  }
  // barulho: quem ouve vai até o lugar (não sabe exatamente onde, erra mais de longe)
  function noise(x, z, r) {
    for (const e of list) {
      if (e.state !== 'wander' && e.state !== 'investigate' && !(e.state === 'feed' && r > 15)) continue
      const d = Math.hypot(e.x - x, e.z - z)
      if (d > r) continue
      const j = d * 0.15
      investigate(e, x + rnd(-j, j), z + rnd(-j, j))
    }
  }

  // ---------------------------------------------------------------- dano e empurrão
  // retorna true se matou
  function damage(e, dmg, kx, kz, p) {
    if (e.state === 'dead') return false
    if (e.state === 'down') dmg *= 1.3
    e.hp -= dmg
    e.hitT = 0.12
    e.kx += kx; e.kz += kz; e.imp += Math.hypot(kx, kz)
    // força do golpe somada no mesmo instante (os 7 chumbos da espingarda contam como um tiro só)
    const now = performance.now()
    if (now - (e.accT || 0) > 80) e.acc = 0
    e.acc += dmg; e.accT = now
    const low = e.state === 'down' || e.state === 'getup'
    gore.spray(e.x, e.fy + (low ? 0.35 : rnd(0.9, 1.4)), e.z, kx, kz, 4 + Math.round(dmg * 3), 2.5 + dmg, e.lv, e.fy)
    if (p && !p.dead && e.state !== 'grab') chase(e, p) // quem bate chama atenção
    if (e.hp > 0) {
      if (gate('zhit', 0.035)) sfx('zhit', { x: e.x, z: e.z, dmg })
      if (!low && Math.random() < Math.min(0.3, (e.acc - 1) * 0.06)) dismember(e, Math.random() < 0.5 ? 'armL' : 'armR', kx, kz, 2.5) // vivo e sem braço: continua vindo
      return false
    }
    sfx('zdeath', { x: e.x, z: e.z })
    // golpe que mata: quanto mais forte, mais pedaços voam (cabeça, braços; explosão/atropelamento levam as pernas)
    const pw = e.acc
    if (Math.random() < 0.25 + pw * 0.08) dismember(e, 'head', kx, kz, 1.6)
    for (const a of ['armL', 'armR']) if (Math.random() < 0.1 + pw * 0.06) dismember(e, a, kx, kz, 1.4)
    if (pw >= 3.5) for (const l of ['legL', 'legR']) if (Math.random() < 0.15 + (pw - 3.5) * 0.12) dismember(e, l, kx, kz, 1.4)
    gore.puddle(e.x + e.kx / 7 + Math.sin(e.heading) * 0.5, e.z + e.kz / 7 + Math.cos(e.heading) * 0.5, e.lv, e.fy, rnd(0.8, 1.3), 0.7, 5) // poça sob o corpo
    release(e)
    if (e.state !== 'down' && e.state !== 'getup') e.fallDir = kx * Math.sin(e.heading) + kz * Math.cos(e.heading) > 0 ? 1 : -1
    setState(e, 'dead')
    e.dying = CORPSE_T
    return true
  }
  // arranca uma parte: vira pedaço voando, o toco espirra por `bleed` segundos
  function dismember(e, name, kx, kz, bleed) {
    const pt = e.rig.sever(name)
    if (!pt) return
    gore.gib(pt.mesh, kx * 1.5, kz * 1.5, e.lv, e.fy, name)
    gore.jet(pt.bone, pt.dir, bleed, e)
    pt.bone.getWorldPosition(_v)
    gore.spray(_v.x, _v.y, _v.z, kx, kz, 14, 4, e.lv, e.fy)
    if (gate('gib', 0.05)) sfx('runover', { x: e.x, z: e.z })
  }
  // força do golpe decide: pouca = só sacode · média = tropeça · muita = cai
  function react(e) {
    const k = e.imp
    e.imp = 0
    if (e.state === 'dead' || e.state === 'down') return
    const n = Math.hypot(e.kx, e.kz) || 1
    if (k >= 9) knockDown(e, e.kx / n, e.kz / n)
    else if (k >= 4.5 && e.state !== 'getup') stagger(e, 0.35 + Math.min(k, 9) * 0.05)
  }

  // Empurrão (todas as classes): solta quem agarrou, faz tropeçar ou derruba até 3 na frente; zumbi caído no pé toma pisão
  function shove(p) {
    if (p.dead || p.vehicle || p.swim || p.shoveCd > 0 || p.atk > 0.2) return
    p.shoveCd = 0.55
    const tired = p.stamina < 10
    p.stamina = Math.max(0, p.stamina - 9)
    let a = p.aiming ? p.aimAngle : p.facing
    const mine = list.filter((e) => e.state === 'grab' && e.target === p)
    if (mine.length) a = Math.atan2(mine[0].x - p.x, mine[0].z - p.z)
    const front = [], downs = []
    for (const e of list) {
      if (e.state === 'dead' || !sameLv(e, p)) continue
      const d = Math.hypot(e.x - p.x, e.z - p.z), off = Math.abs(wrap(Math.atan2(e.x - p.x, e.z - p.z) - a))
      if (e.state === 'down') { if (d < 1.5 && (off < 1.3 || d < 0.8)) downs.push([d, e]) } else if (e.state === 'grab' && e.target === p) front.push([0, e])
      else if (d < 1.75 + e.radius && (off < 1.0 || d < 0.9)) front.push([d, e])
    }
    p.facing = a
    if (!p.aiming) p.aimAngle = a
    if (!front.length && downs.length) {
      const e = downs.sort((u, v) => u[0] - v[0])[0][1]
      p.model.play('stomp', 0.42)
      p.atk = 0.35; p.slowAct = 0.3; p.slowT = 0.35
      ctx.hit(e, 3.2, p, 0, 0)
      sfx('stomp', { x: e.x, z: e.z })
      fx.burst(e.x, e.fy + 0.3, e.z, BLOOD, 5, 2.5, 0.4, 0.9)
      fx.puff(e.x, e.fy + 0.1, e.z, 0xb8ac98, 0.4, 0.5, 0.4)
      return
    }
    p.model.play('shove', 0.38)
    p.atk = 0.3; p.slowAct = 0.5; p.slowT = 0.3
    const y = (p.y || 0) + 1.1
    fx.arc(p.x, y, p.z, a, 0.4, 1.7, 1.6, 0xfff4e0, 0.18, 0.3)
    front.sort((u, v) => u[0] - v[0])
    sfx('shove', { x: p.x, z: p.z, cls: p.cls.id, hit: Math.min(front.length, 3) })
    for (const [, e] of front.slice(0, 3)) {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1, ux = d > 0.05 ? dx / d : Math.sin(a), uz = d > 0.05 ? dz / d : Math.cos(a)
      const behind = ux * Math.sin(e.heading) + uz * Math.cos(e.heading) > 0.3 // de costas para o jogador: cai fácil
      const chance = tired ? 0.15 : behind ? 1 : e.state === 'stagger' ? 0.75 : 0.35
      if (Math.random() < chance) knockDown(e, ux, uz)
      else stagger(e, rnd(0.6, 0.9))
      const push = tired ? 4.5 : 7.5
      e.kx += ux * push; e.kz += uz * push
      e.cool = Math.max(e.cool, 1.1)
      if (!e.target) e.target = p
      fx.puff(e.x, e.fy + 0.2, e.z, 0xc8bca8, 0.35, 0.45, 0.4)
    }
    noise(p.x, p.z, 5)
  }

  // ---------------------------------------------------------------- um zumbi, por quadro. true = remover
  function step(e, dt, players, range) {
    e.t += dt; e.stT += dt
    e.hitT = Math.max(0, e.hitT - dt)
    e.bite = Math.max(0, e.bite - dt * 4)
    if (e.state === 'dead') {
      e.dying -= dt
      e.vel = 0
      const kd = Math.exp(-7 * dt)
      e.x += e.kx * dt; e.z += e.kz * dt; e.kx *= kd; e.kz *= kd
      e.group.position.set(e.x, e.fy - Math.max(0, 1.5 - e.dying) * 0.35, e.z) // afunda no chão antes de sumir
      if (e.stT < 1.5) e.rig.animate(dt, e) // termina de cair; depois o corpo fica parado
      return e.dying <= 0
    }
    e.cool -= dt
    const ox = e.x, oz = e.z
    // empurrão (tiro forte, onda do bardo, explosão, atropelamento) e lentidão (gelo do mago)
    if (e.state !== 'grab') {
      const kd = Math.exp(-7 * dt)
      e.x += e.kx * dt; e.z += e.kz * dt; e.kx *= kd; e.kz *= kd
    } else e.kx = e.kz = 0
    if (e.imp > 0) react(e)
    const slow = (e.slowT = Math.max(0, e.slowT - dt)) > 0 ? 0.4 : 1
    if (e.ice) e.ice.visible = slow < 1
    if ((e.senseT -= dt) <= 0 && (e.state === 'wander' || e.state === 'investigate' || e.state === 'chase' || e.state === 'feed')) {
      e.senseT = rnd(0.22, 0.34)
      sense(e, players, range)
    }

    const p = e.target
    switch (e.state) {
      case 'wander': {
        if (!e.goal) {
          if ((e.waitT -= dt) <= 0) {
            // anda até um ponto perto; às vezes puxa para o lado de algum jogador (o bando vai se aproximando)
            let a = Math.random() * Math.PI * 2
            const near = Math.random() < 0.35 && nearest(e, players)
            if (near) a = Math.atan2(near.x - e.x, near.z - e.z) + rnd(-0.6, 0.6)
            const d = rnd(4, 10)
            e.goal = { x: e.x + Math.sin(a) * d, z: e.z + Math.cos(a) * d }
            e.dur = rnd(6, 12); e.stT = 0
          } else e.heading += Math.sin(e.t * 0.7) * dt * 0.3
        } else if (Navigate(e, e.goal.x, e.goal.z, 0, SPEED.wander * slow, 0.7, dt, 2.5) < 0.8 || e.stT > e.dur) { e.goal = null; e.waitT = rnd(1.5, 5) }
        break
      }
      case 'investigate': {
        if (Navigate(e, e.goal.x, e.goal.z, 0, SPEED.investigate * slow, 1.2, dt, 4) < 1.4 || e.stT > 20) { setState(e, 'wander'); e.goal = null; e.waitT = rnd(2, 4) }
        break
      }
      case 'chase': {
        if (!p || p.dead) { e.target = null; setState(e, 'wander'); e.goal = null; e.waitT = 1; break }
        e.seenT += dt
        // perdeu de vista: vai até onde viu por último
        if (e.seenT > LOSE_T) { e.target = null; investigate(e, e.tx, e.tz); break }
        const knows = e.seenT < 0.6
        const gx = knows ? p.x : e.tx, gz = knows ? p.z : e.tz
        const reach = REACH + (p.pad || 0) // pad: quem está num veículo é alcançado pela lataria
        const d = Navigate(e, gx, gz, knows ? p.gy ?? 0 : 0, e.speed * slow, reach * 0.85, dt, e.fast ? 7 : 5)
        if (!knows && d < 1.2) { e.target = null; setState(e, 'wander'); e.goal = null; e.waitT = rnd(1, 3); break }
        // bote: no alcance, mesmo andar; pular ou a investida do samurai escapam
        if (knows && d <= reach && e.cool <= 0 && sameLv(e, p) && p.jy < 0.9 && !(p.invulnT > 0)) { setState(e, 'lunge', LUNGE_T); sfx('snarl', { x: e.x, z: e.z, fast: e.fast }) }
        break
      }
      case 'lunge': {
        if (!p || p.dead) { setState(e, 'wander'); break }
        const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1
        e.heading = turnTo(e.heading, Math.atan2(dx, dz), 10, dt)
        if (e.stT < e.dur * 0.6 && d > 0.75 + (p.pad || 0)) { e.x += (dx / d) * 1.6 * slow * dt; e.z += (dz / d) * 1.6 * slow * dt }
        if (e.stT < e.dur) break
        const ok = d <= REACH + 0.35 + (p.pad || 0) && sameLv(e, p) && p.jy < 0.9 && !(p.invulnT > 0)
        if (ok && p.vehicle) { ctx.hurt(p, 5); e.cool = 1.1; setState(e, 'chase'); sfx('bang', { x: e.x, z: e.z }) } // bate na lataria
        else if (ok && !p.swim) { setState(e, 'grab'); sfx('grab', { x: p.x, z: p.z }); e.biteT = rnd(0.7, 1.0); ctx.hurt(p, SCRATCH); fx.burst(p.x, (p.y || 0) + 1.2, p.z, BLOOD, 4, 2, 0.35, 0.8) }
        else { e.cool = 0.8; setState(e, 'chase') }
        break
      }
      case 'grab': {
        if (!p || p.dead) { setState(e, 'feed', rnd(8, 14)); e.target = null; break }
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1
        if (p.vehicle || p.swim || p.invulnT > 0 || d > 1.6 || !sameLv(e, p)) { release(e); stagger(e, 0.4); break }
        // fica preso ao jogador, de frente para ele
        const k = 1 - Math.exp(-10 * dt)
        e.x += (p.x + (dx / d) * HOLD - e.x) * k; e.z += (p.z + (dz / d) * HOLD - e.z) * k
        e.heading = turnTo(e.heading, Math.atan2(-dx, -dz), 12, dt)
        if ((e.biteT -= dt) <= 0) {
          e.biteT = rnd(1.1, 1.6); e.bite = 1
          sfx('bite', { x: p.x, z: p.z })
          ctx.hurt(p, rnd(BITE[0], BITE[1]))
          fx.burst(p.x, (p.y || 0) + 1.4, p.z, BLOOD, 6, 2.5, 0.45, 0.9)
        }
        break
      }
      case 'stagger': {
        if (e.stT >= e.dur) setState(e, p && !p.dead ? 'chase' : 'wander')
        break
      }
      case 'down': {
        if (e.stT >= e.dur) setState(e, 'getup', GETUP_T)
        break
      }
      case 'getup': {
        if (e.stT >= e.dur) { e.seenT = 0; setState(e, p && !p.dead ? 'chase' : 'wander') }
        break
      }
      case 'feed': {
        if (e.stT >= e.dur) { setState(e, 'wander'); e.goal = null }
        break
      }
    }

    // chão: colisão, água, andares das casas
    resolve(e, e.lv !== undefined && FloorAt(e.x, e.z, e.fy ?? 0) ? Math.min(e.radius * 0.8, 0.6) : e.radius * 0.8, null, 0)
    const lx = e.lx ?? e.x, lz = e.lz ?? e.z
    if (TooDeep(e.x, e.z)) { if (!TooDeep(e.x, lz)) e.z = lz; else if (!TooDeep(lx, e.z)) e.x = lx; else { e.x = lx; e.z = lz } } // zumbis não nadam
    const feet = e.fy ?? GroundAt(e.x, e.z)
    let fl = FloorAt(e.x, e.z, feet)
    if (fl && fl.blocked) { e.x = lx; e.z = lz; fl = FloorAt(e.x, e.z, feet) }
    e.lx = e.x; e.lz = e.z
    e.fy = fl ? fl.y : GroundAt(e.x, e.z)
    e.lv = fl ? fl.lv : 0

    const moved = Math.hypot(e.x - ox, e.z - oz) / Math.max(dt, 1e-4)
    e.vel += (Math.min(moved, 5) - e.vel) * (1 - Math.exp(-10 * dt))
    e.moving = e.vel > 0.3 ? 1 : 0
    e.group.position.set(e.x, e.fy, e.z)
    e.group.rotation.y = e.heading
    return false
  }
  function nearest(e, players) {
    let best = null, bd = Infinity
    for (const p of players) { if (p.dead) continue; const d = (p.x - e.x) ** 2 + (p.z - e.z) ** 2; if (d < bd) { bd = d; best = p } }
    return best
  }

  // ---------------------------------------------------------------- população: mantém a horda em volta dos jogadores
  function wanted(alive) {
    if (!alive.length) return 0
    let n = 18 + 7 * (alive.length - 1) + Math.floor(st.time / 45) * 2
    if (ctx.night()) n *= 1.3
    if (alive.some((p) => InZone(p.x, p.z, 10))) n *= 1.25 // povoados e cidades: mais gente (morta)
    return Math.min(MAX_ZOMBIES, Math.round(n))
  }
  // ponto livre num anel em volta de um jogador, fora da vista, em chunk carregado (com colisores)
  function spawnPoint(alive) {
    for (let n = 0; n < 14; n++) {
      const t = alive[(Math.random() * alive.length) | 0]
      const a = Math.random() * Math.PI * 2, d = rnd(SPAWN_MIN, SPAWN_MAX) + (t.vehicle ? 8 : 0)
      const x = t.x + Math.sin(a) * d, z = t.z + Math.cos(a) * d
      if (!ChunkLoaded(x, z) || Blocked(x, z, 0.8) || PointInBuilding(x, z, 1.2)) continue
      if (alive.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < (SPAWN_MIN - 4) ** 2)) continue
      if (n < 8 && !InZone(x, z, 8) && Math.random() < 0.45) continue // prefere povoados
      return [x, z]
    }
    return null
  }
  function arrive(e, alive) {
    // parte já chega andando na direção dos jogadores (o mundo nunca fica parado)
    if (Math.random() < 0.35) { const t = alive[(Math.random() * alive.length) | 0]; investigate(e, t.x + rnd(-8, 8), t.z + rnd(-8, 8)) }
  }

  function update(dt) {
    const players = [...ctx.players.values()], alive = players.filter((p) => !p.dead)
    st.time += dt
    const range = ctx.night() ? SIGHT.night : SIGHT.day
    for (let i = list.length - 1; i >= 0; i--) if (step(list[i], dt, players, range)) remove(i)

    // empurra uns aos outros (e para fora dos jogadores); caídos e corpos não ocupam espaço
    for (let i = 0; i < list.length; i++) {
      const a = list[i]
      if (a.state === 'dead' || a.state === 'down') continue
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]
        if (b.state === 'dead' || b.state === 'down') continue
        const dx = b.x - a.x, dz = b.z - a.z, min = (a.radius + b.radius) * 0.9, d2 = dx * dx + dz * dz
        if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2), q = (min - d) / 2; a.x -= (dx / d) * q; a.z -= (dz / d) * q; b.x += (dx / d) * q; b.z += (dz / d) * q }
      }
      for (const p of alive) {
        if (p.vehicle || !sameLv(a, p)) continue
        const dx = a.x - p.x, dz = a.z - p.z, min = a.state === 'grab' && a.target === p ? HOLD : 0.45 + a.radius * 0.9, d2 = dx * dx + dz * dz
        if (d2 < min * min && d2 > 1e-6) { const d = Math.sqrt(d2), q = min - d; a.x += (dx / d) * q * 0.8; a.z += (dz / d) * q * 0.8; p.x -= (dx / d) * q * 0.2; p.z -= (dz / d) * q * 0.2 }
      }
    }

    // agarrões: quantos seguram cada jogador (movimento lento) e escapar puxando o stick para longe
    for (const p of players) { p.held = 0; p.hx = 0; p.hz = 0 }
    for (const e of list) if (e.state === 'grab' && e.target) { const p = e.target; p.held++; p.hx += e.x - p.x; p.hz += e.z - p.z }
    for (const p of players) {
      p.shoveCd = Math.max(0, (p.shoveCd || 0) - dt)
      if (!p.held) { p.struggle = Math.max(0, (p.struggle || 0) - dt); continue }
      const { mx, mz } = p.input, m = Math.hypot(mx, mz), h = Math.hypot(p.hx, p.hz) || 1
      if (m > 0.5 && (mx * p.hx + mz * p.hz) / (m * h) < -0.3) p.struggle = (p.struggle || 0) + (dt * 0.55) / p.held
      else p.struggle = Math.max(0, (p.struggle || 0) - dt * 0.3)
      if (p.struggle >= 1) {
        p.struggle = 0
        sfx('escape', { x: p.x, z: p.z, cls: p.cls.id })
        for (const e of list) if (e.state === 'grab' && e.target === p) { const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1; stagger(e, 0.7); e.kx += (dx / d) * 5; e.kz += (dz / d) * 5 }
      }
    }

    // barulho dos jogadores: carro ligado, correndo, andando
    if ((st.noiseT -= dt) <= 0) {
      st.noiseT = 0.4
      for (const p of alive) {
        const v = p.vehicle
        const r = v ? (v.seats[0] && Math.hypot(v.vx, v.vz) > 1 ? 18 : 0) : p.running ? 8 : p.speed > 0.5 ? 3 : 0
        if (r) noise(p.x, p.z, r)
      }
    }

    // longe demais (ou em chunk descarregado): renasce perto dos jogadores
    if ((st.farT -= dt) <= 0 && alive.length) {
      st.farT = 0.5
      const want = wanted(alive)
      let living = list.filter((e) => e.state !== 'dead').length
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i]
        if (e.state === 'dead' || e.state === 'grab') continue
        const n = nearest(e, alive), d = Math.hypot(n.x - e.x, n.z - e.z)
        if (living > want + 6 && d > 30 && e.state !== 'chase') { remove(i); living--; continue } // horda menor (amanheceu)
        if (d < FAR && ChunkLoaded(e.x, e.z)) continue
        const pt = spawnPoint(alive)
        if (pt) { reset(e, pt[0], pt[1]); arrive(e, alive) } else { remove(i); living-- }
      }
      // corpos demais: os mais antigos afundam
      const corpses = list.filter((e) => e.state === 'dead').sort((a, b) => a.dying - b.dying)
      for (let i = 0; i < corpses.length - MAX_CORPSES; i++) corpses[i].dying = Math.min(corpses[i].dying, 1.5)
    }
    // nascimento contínuo até a população desejada
    if (alive.length && (st.spawnT -= dt) <= 0) {
      const want = wanted(alive), living = list.reduce((n, e) => n + (e.state !== 'dead'), 0)
      st.spawnT = living < want * 0.5 ? 0.12 : 0.45
      if (living < want) { const pt = spawnPoint(alive); if (pt) arrive(make(pt[0], pt[1]), alive) }
    }

    for (const e of list) if (e.state !== 'dead') e.rig.animate(dt, e)
  }

  function clear() {
    for (const e of list) scene.remove(e.group)
    list.length = 0
    Object.assign(st, { spawnT: 1.5, noiseT: 0, farT: 0, time: 0 })
  }
  // jogador saiu/caiu/entrou no carro: quem estava agarrado solta
  function releasePlayer(p) { for (const e of list) if (e.target === p && e.state === 'grab') release(e) }

  return { list, update, damage, shove, noise, clear, releasePlayer, get time() { return st.time }, alive: () => list.reduce((n, e) => n + (e.state !== 'dead'), 0) }
}
