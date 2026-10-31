import * as THREE from 'three'
import { BALANCE } from './config/balance'
import { UPGRADES } from './config/upgrades'

// XP e níveis (J7): cada jogador ganha XP (abates, revistar, consertar, noites). Ao subir de nível: coluna de luz, som,
// alguns segundos invulnerável e 3 melhorias sorteadas para escolher (celular: cartas; teclado: 1, 2 ou 3). A partida não pausa.
// Números em balance.js · levels e upgrades; nomes em config/upgrades.js.
const L = BALANCE.levels, U = BALANCE.upgrades
const need = (n) => L.need[Math.min(n - 1, L.need.length - 1)] // XP para sair do nível n
export const has = (p, id) => !!(p.mods && p.mods.has(id)) // o jogador tem essa melhoria?

// cerimônia: coluna de luz dourada que sobe e some
const BEAM_TIME = 1.4
const BEAM_GEO = new THREE.CylinderGeometry(0.5, 0.8, 9, 20, 1, true).translate(0, 4.5, 0)
const BEAM_MAT = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })

// ctx: { scene, fx, players (Map), say(texto, s), sfx(nome, opções), move (números do movimento: o Pulmão de atleta muda o fôlego) }
export function CreateLevels({ scene, fx, players, say, sfx, move }) {
  const beams = [] // { mesh, p, t }
  const inGroup = (cls) => [...players.values()].some((o) => o.cls.id === cls)
  // sorteia as cartas: melhorias que o jogador ainda não tem (gerais, da classe dele e combinações com quem está no grupo)
  function deal(p) {
    const pool = UPGRADES.filter((u) => !p.mods.has(u.id) && (!u.cls || u.cls === p.cls.id) && (!u.with || inGroup(u.with)))
    const cards = []
    while (cards.length < L.cards && pool.length) cards.push(pool.splice((Math.random() * pool.length) | 0, 1)[0])
    p.cards = cards.length ? cards : null
    if (!p.cards) p.picks = 0 // já tem todas
  }
  function ceremony(p) {
    const mesh = new THREE.Mesh(BEAM_GEO, BEAM_MAT.clone())
    mesh.renderOrder = 4
    scene.add(mesh)
    beams.push({ mesh, p, t: 0 })
    fx.ring(p.x, p.gy || 0, p.z, 0xffe08a, 0.3, 2.4, 0.8)
    sfx('levelup')
  }

  return {
    // jogador novo (ou partida nova): nível 1, sem melhorias
    init(p) { Object.assign(p, { level: 1, xp: 0, picks: 0, cards: null, mods: new Set(), move: null }) },
    // ganhar XP; sobe quantos níveis der (cada nível = uma escolha)
    add(p, n) {
      if (!p || !p.mods || !n) return
      p.xp += n
      while (p.xp >= need(p.level)) {
        p.xp -= need(p.level); p.level++; p.picks++
        p.invulnT = Math.max(p.invulnT || 0, L.invulnerable)
        say(`⬆ ${p.name} subiu para o nível ${p.level}! Escolha uma melhoria`, 2.5)
        ceremony(p)
      }
      if (p.picks > 0 && !p.cards) deal(p)
    },
    // escolher a carta i (0, 1 ou 2). false = não há essa carta
    choose(p, i) {
      const u = p.cards && p.cards[i]
      if (!u) return false
      p.mods.add(u.id)
      if (u.id === 'skin') { const more = Math.round(p.max * (U.skin - 1)); p.max += more; p.hp += more }
      if (u.id === 'pockets' && p.ammo) for (const w of ['carbine', 'shotgun']) p.ammo[w].reserve = Math.round(p.ammo[w].reserve * U.pockets.ammo)
      if (u.id === 'lungs') p.move = { ...move, staminaRun: move.staminaRun / U.lungs, staminaSwim: move.staminaSwim / U.lungs }
      say(`${p.name}: ${u.icon} ${u.name}`, 2)
      sfx('ui', { f: 660 })
      p.picks--; p.cards = null
      if (p.picks > 0) deal(p)
      return true
    },
    progress: (p) => (p.xp || 0) / need(p.level || 1), // fração até o próximo nível (barra no placar)
    update(dt) {
      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i]
        b.t += dt
        const k = b.t / BEAM_TIME
        if (k >= 1) { scene.remove(b.mesh); b.mesh.material.dispose(); beams.splice(i, 1); continue }
        b.mesh.position.set(b.p.x, (b.p.y || 0) - (b.p.jy || 0), b.p.z)
        b.mesh.scale.set(1 + k * 0.6, 0.4 + Math.min(1, k * 4) * 0.6, 1 + k * 0.6)
        b.mesh.material.opacity = 0.6 * (1 - k)
      }
    },
    clear() { for (const b of beams) { scene.remove(b.mesh); b.mesh.material.dispose() } beams.length = 0 },
  }
}
