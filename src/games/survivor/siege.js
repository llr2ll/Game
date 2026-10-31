import { BALANCE } from './config/balance'

// Cerco (J5b): a partida começa ao meio-dia; o rádio avisa antes de escurecer; à noite o "diretor" manda a horda
// contra a base (casa do rádio) em picos. Vitória no amanhecer depois de `nights` noites. Números em balance.js · siege.
const S = BALANCE.siege, D = BALANCE.day
const isNight = (t) => t < D.nightTo || t > D.nightFrom
const inside = (t, a, b) => (a < b ? t >= a && t < b : t >= a || t < b) // janela de horário (pode passar da meia-noite)
const ord = (n) => `${n}ª`

// ctx: { clock() (hora do dia, 0..1; sem relógio = sem cerco), base (base.js), say(texto, s), sfx(nome, opções) }
export function CreateSiege({ clock, base, say, sfx }) {
  const st = { night: 0, wasNight: false, warned: false, done: false, pulse: null }
  return {
    st,
    // a cada quadro: conta as noites, avisa, acha o pico. Devolve 'dawn' em cada amanhecer e 'win' no amanhecer depois da última noite
    update() {
      if (!clock || st.done) return null
      const t = clock(), n = isNight(t)
      let ev = null
      if (n && !st.wasNight) {
        st.night++
        say(`🌙 ${ord(st.night)} noite de ${S.nights}${base.at() ? ': a horda vem atrás da base!' : ' — sem rádio posto, a horda vem atrás de vocês'}`, 4)
        sfx('gameover', { vol: 0.5 })
      }
      if (!n && st.wasNight) {
        st.wasNight = false
        if (st.night >= S.nights) { st.done = true; return 'win' }
        say(`☀ Amanheceu. Falta${S.nights - st.night > 1 ? 'm' : ''} ${S.nights - st.night} noite${S.nights - st.night > 1 ? 's' : ''}`, 3.5)
        ev = 'dawn'
      }
      if (!n && !st.warned && t > D.nightFrom - S.warn && t < D.nightFrom) {
        st.warned = true
        say(base.at() ? '📻 Rádio: escurece em 2 horas. Barriquem a base!' : '📻 Rádio: escurece em 2 horas. Ponham o rádio numa casa e barriquem!', 4)
      }
      if (n) st.warned = false
      st.wasNight = n
      st.pulse = n ? S.pulses.find((p) => inside(t, p.from, p.to)) || null : null
      return ev
    },
    // para a horda (à noite, com base): { x, z (base), extra (zumbis a mais), share (fração que nasce na base), ring } · senão null
    director() {
      if (!clock || !st.wasNight) return null
      const b = base.at()
      if (!b) return null
      const k = S.perNight[Math.min(st.night, S.perNight.length) - 1] || 1
      return { x: b.x, z: b.z, extra: st.pulse ? Math.round(S.pulseSize * k) : 0, share: st.pulse ? S.share : 0, ring: S.ring }
    },
    // placar: "☀ Dia 1" / "🌙 Noite 1/2" (+ "pico" quando a horda aperta)
    text() {
      if (!clock) return ''
      return st.wasNight ? `🌙 Noite ${st.night}/${S.nights}${st.pulse ? ' · 🧟 pico!' : ''}` : `☀ Dia ${st.night + 1}`
    },
    clear() { Object.assign(st, { night: 0, wasNight: false, warned: false, done: false, pulse: null }) },
  }
}
