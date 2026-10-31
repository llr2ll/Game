import QRCode from 'qrcode'
import { clock } from '../rules/survival'
import { PLAYER_COLORS } from '../../../engine/render/splitscreen'

const $ = (s) => document.querySelector(s)

export function CreateHud(game, climate) {
  let t = 0
  return {
    setRoom(code) {
      const url = `${location.origin}/controller.html?room=${code}`
      $('#code').textContent = code
      $('#url').textContent = url
      QRCode.toCanvas($('#qr'), url, { width: 130, margin: 1 })
    },
    update(dt) {
      $('#msg').textContent = game.st.msgT > 0 ? game.st.msg : (game.players.size ? '' : 'Entre pelo celular para jogar')
      if ((t -= dt) > 0) return
      t = 0.1
      $('#wave').textContent = `⏱ ${clock(game.st.time)} · 🧟 ${game.zombies()}`
      $('#score').textContent = `Pontos ${game.st.score}`
      $('#inv').textContent = game.invText() // estoque do grupo (saque) + 📻 se a base está marcada
      if (climate) $('#clock').textContent = climate.label()
      $('#plist').innerHTML = [...game.players.values()].map((p) => {
        const inf = game.info(p)
        const cds = inf.buttons.filter((b) => b.cd > 0).map((b) => `<span class="cd">${b.l} ${Math.ceil(b.cd * p.cls.cd[inf.buttons.indexOf(b)])}s</span>`).join('')
        const car = p.vehicle ? ` · 🚗 ${p.vehicle.d.name}${p.seat.mode === 'drive' ? ' (dirigindo)' : ''}` : ''
        const mana = p.cls.id === 'mage' ? `<div class="bar mana"><i style="width:${p.mana}%"></i></div>` : ''
        const task = p.task ? ` · ${p.task.icon} ${Math.round((p.task.t / p.task.need) * 100)}%` : ''
        const state = p.dead ? (game.st.over ? '' : ` · 💀 volta em ${Math.ceil(p.reviveT)}s`) : p.held ? ' · <span class="grab">🧟 AGARRADO! (V)</span>' : ''
        return `<div class="pl ${p.dead ? 'dead' : ''}" style="border-left:4px solid ${PLAYER_COLORS[p.idx % 4]}"><b>${p.cls.icon} ${p.name}</b> · ${inf.text} · ${p.kills} abates${car}${p.buffT > 0 ? ' · ✨' : ''}${task}${state}<div class="bar"><i style="width:${(p.hp / p.max) * 100}%"></i></div>${mana}${cds ? `<div class="cds">${cds}</div>` : ''}</div>`
      }).join('')
    },
  }
}
