import QRCode from 'qrcode'
import { WEAPONS } from '../weapons/weapons'

const $ = (s) => document.querySelector(s)

export function CreateHud(game) {
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
      $('#wave').textContent = `Onda ${game.st.wave}`
      $('#score').textContent = `Pontos ${game.st.score}`
      $('#plist').innerHTML = [...game.players.values()].map((p) => {
        const s = p.ammo[p.weapon]
        return `<div class="pl ${p.dead ? 'dead' : ''}"><b>${p.name}</b> · ${WEAPONS[p.weapon].name} ${p.reload > 0 ? '(recarregando)' : `${s.mag}/${s.reserve === Infinity ? '∞' : s.reserve}`} · ${p.kills} abates<div class="bar"><i style="width:${(p.hp / p.max) * 100}%"></i></div></div>`
      }).join('')
    },
  }
}
