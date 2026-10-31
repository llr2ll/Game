import * as THREE from 'three'
import { SpotsNear } from '../../shared/worldgen/buildings-registry'
import { BALANCE } from './config/balance'
import { has } from './levels'

// Saque nas casas (J3). Usar perto de um móvel: revista (parado, barulho pequeno) e talvez acha um item.
// Móvel já revistado (ou mesa/cama/sofá): Usar desmonta (mais tempo, barulho de martelo) e dá tábuas.
// O que foi revistado/desmontado não volta, nem se o chunk sair e voltar (o id do móvel é a posição).
// Itens vão para o estoque do grupo; munição vai direto para os Atiradores. Números em balance.js · loot.
const L = BALANCE.loot
const UP = BALANCE.upgrades
export const ITEMS = { tabuas: ['🪵', 'tábuas'], remedio: ['🩹', 'remédio'], municao: ['📦', 'munição'], gasolina: ['⛽', 'gasolina'], raro: ['⭐', 'achado raro'] }
// prefixo da chave do móvel (buildings.js) → nome, dá para revistar? (os outros só desmontam)
const KINDS = [
  ['dresser', 'cômoda', true], ['wardrobe', 'guarda-roupa', true], ['shelf', 'estante', true], ['chest', 'baú', true], ['desk', 'escrivaninha', true],
  ['stove', 'fogão', true], ['counter', 'balcão', true], ['shopCounter', 'balcão', true], ['display', 'vitrine', true], ['crates', 'caixotes', true],
  ['barrel', 'barril', true], ['sacks', 'sacos', true], ['table', 'mesa', false], ['bed', 'cama', false], ['sofa', 'sofá', false],
]
const kindCache = new Map()
const kindOf = (key) => {
  if (!kindCache.has(key)) { const k = KINDS.find(([pre]) => key.startsWith(pre)); kindCache.set(key, k ? { name: k[1], search: k[2] } : null) }
  return kindCache.get(key)
}
const randInt = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1))
function pick(weights) {
  let r = Math.random() * Object.values(weights).reduce((s, w) => s + w, 0)
  for (const [k, w] of Object.entries(weights)) if ((r -= w) < 0) return k
  return 'tabuas'
}
const MARK_GEO = new THREE.OctahedronGeometry(0.22, 0).scale(1, 1.4, 1) // losango em pé, visível de cima
const MARK = { search: new THREE.MeshBasicMaterial({ color: 0xffc81e, toneMapped: false }), dismantle: new THREE.MeshBasicMaterial({ color: 0xd9894a, toneMapped: false }) } // amarelo: revistar · laranja: desmontar

// ctx: { scene, fx, players (Map), say(texto, s), sfx(nome, opções), tasks (tasks.js: parado fazendo algo), xp(p, n) }
export function CreateLoot({ scene, fx, players, say, sfx, tasks, xp = () => {} }) {
  const done = new Map() // id do móvel -> 1 revistado · 2 desmontado
  const inv = { tabuas: 0, remedio: 0, municao: 0, gasolina: 0, raro: 0 }
  const marks = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(MARK_GEO, MARK.search); m.visible = false; scene.add(m); return m })
  let t = 0

  // o que dá para fazer neste móvel agora: 'search', 'dismantle' ou null
  function actionOf(s) {
    const k = kindOf(s.key), st = done.get(s.id) || 0
    if (!k || st >= 2) return null
    return k.search && !st ? 'search' : 'dismantle'
  }
  // móvel ao alcance do jogador (o mais perto), com algo a fazer
  function target(p) {
    let best = null, bd = Infinity
    for (const s of SpotsNear(p.x, p.z, p.lv || 0, L.glow)) {
      if (!actionOf(s)) continue
      const d = Math.min(Math.hypot(s.fx - p.x, s.fz - p.z), Math.hypot(s.x - p.x, s.z - p.z) - s.r)
      if (d < L.reach && d < bd) { bd = d; best = s }
    }
    return best
  }
  function give(p, item) {
    const [icon, name] = ITEMS[item]
    const gunners = item === 'municao' ? [...players.values()].filter((o) => o.cls.id === 'gunner') : []
    if (gunners.length) {
      const caps = BALANCE.rules.ammoCap
      for (const g of gunners) for (const w of ['carbine', 'shotgun']) g.ammo[w].reserve = Math.min(g.ammo[w].reserve + L.ammo[w], Math.max(g.ammo[w].reserve, caps[w]))
      say(`${p.name} achou ${icon} ${name} para o Atirador`)
    } else {
      const n = item === 'tabuas' ? randInt(L.planks) : 1
      inv[item] += n
      say(`${p.name} achou ${icon} ${n > 1 ? `${n} ` : ''}${name}`)
    }
    sfx('supply')
  }
  function finish(p, { s, a }) {
    const k = kindOf(s.key), y = s.y + 1
    if (a === 'search') {
      done.set(s.id, 1)
      xp(p, BALANCE.levels.xp.search)
      if (Math.random() >= L.chance * (players.size === 1 ? BALANCE.solo.loot : 1)) { say(`${p.name}: ${k.name} sem nada`, 1.4); sfx('ui', { f: 300 }); return }
      give(p, pick(L.rooms[s.room] || L.rooms.terreo))
      fx.burst(s.fx, y, s.fz, 0xffe08a, 8, 3, 0.5)
    } else {
      done.set(s.id, 2)
      const n = randInt(L.dismantle.planks)
      inv.tabuas += n
      say(`${p.name} desmontou ${k.name}: +${n} 🪵`)
      sfx('bang', { x: s.x, z: s.z })
      fx.burst(s.x, y, s.z, 0xb07a48, 10, 3.5, 0.6)
      fx.puff(s.x, s.y + 0.6, s.z, 0xc8b8a0, 0.6, 1, 0.6)
    }
  }

  return {
    inv,
    // Usar: começa a revistar/desmontar o móvel mais perto. false = não há móvel ao alcance
    use(p) {
      if (p.task) return true
      const s = target(p)
      if (!s) return false
      const a = actionOf(s), search = a === 'search'
      const k = search ? (has(p, 'looter') ? UP.looter : null) : has(p, 'carpenter') ? UP.carpenter : null // Saqueador / Carpinteiro: mais rápido e quieto
      tasks.start(p, { a, icon: search ? '🔍' : '🪚', need: (search ? L.search.time : L.dismantle.time) / (k ? k.speed : 1), at: s, noise: (search ? L.search.noise : L.dismantle.noise) * (k ? k.noise : 1), beat: search ? null : 'bang', done: (pp) => finish(pp, { s, a }) })
      sfx(search ? 'swap' : 'bang', { x: s.x, z: s.z })
      return true
    },
    // texto do botão Usar (celular) quando há móvel ao alcance
    label(p) { const s = !p.dead && !p.vehicle && target(p); return s ? (actionOf(s) === 'search' ? '🔍 Revistar' : '🪚 Desmontar') : '' },
    // brilho nos móveis perto de alguém
    update(dt, list) {
      t += dt
      let n = 0
      const seen = new Set()
      for (const p of list) {
        if (p.dead || p.vehicle) continue
        for (const s of SpotsNear(p.x, p.z, p.lv || 0, L.glow)) {
          const a = n < marks.length && !seen.has(s.id) && actionOf(s)
          if (!a) continue
          seen.add(s.id)
          const m = marks[n++]
          m.material = MARK[a]
          m.visible = true
          m.position.set(s.fx, s.y + 1.2 + Math.sin(t * 3 + s.x) * 0.08, s.fz)
          m.rotation.y = t * 2
          m.scale.setScalar(1 + Math.sin(t * 6 + s.z) * 0.15) // pulsa
        }
      }
      for (let i = n; i < marks.length; i++) marks[i].visible = false
    },
    // estoque do grupo, curto (placar e celular)
    text() { return Object.entries(ITEMS).filter(([k]) => inv[k] || k === 'tabuas' || k === 'remedio').map(([k, [icon]]) => `${icon} ${inv[k]}`).join('  ') },
    clear() {
      done.clear()
      for (const k in inv) inv[k] = 0
      for (const m of marks) m.visible = false
    },
  }
}
