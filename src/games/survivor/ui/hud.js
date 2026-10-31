import QRCode from 'qrcode'
import { clock } from '../rules/survival'
import { PLAYER_COLORS } from '../../../engine/render/splitscreen'

const $ = (s) => document.querySelector(s)

// painel do fim da partida (vitória/derrota): criado aqui, sem mexer no index.html
function resultPanel() {
  let el = $('#result')
  if (!el) {
    el = document.createElement('div')
    el.id = 'result'
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:15;display:none;min-width:320px;padding:22px 28px;border-radius:14px;background:#000c;color:#fff;font:600 17px system-ui,sans-serif;text-align:center;line-height:1.7'
    document.body.appendChild(el)
  }
  return el
}
// cartas de melhoria do jogador do teclado (quem joga no celular vê as cartas no celular)
function cardsPanel() {
  const el = document.createElement('div')
  el.id = 'cards'
  el.style.cssText = 'position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:14;display:none;padding:10px 14px;border-radius:12px;background:#000b;color:#fff;font:600 14px system-ui,sans-serif;text-align:center'
  document.body.appendChild(el)
  return el
}

export function CreateHud(game, climate) {
  let t = 0
  const panel = resultPanel(), cards = cardsPanel()
  let shown = ''
  return {
    setRoom(code) {
      const url = `${location.origin}/controller.html?room=${code}`
      $('#code').textContent = code
      $('#url').textContent = url
      QRCode.toCanvas($('#qr'), url, { width: 130, margin: 1 })
    },
    update(dt) {
      const r = game.st.over && game.st.result
      panel.style.display = r ? 'block' : 'none'
      if (r) {
        panel.innerHTML = `<div style="font-size:34px;font-weight:800;margin-bottom:6px">${r.win ? '🚁 VITÓRIA' : '💀 DERROTA'}</div>`
          + `<div>${r.win ? 'O exército chegou: vocês aguentaram' : 'Aguentaram'} <b>${r.nights} de ${r.of}</b> noite${r.of > 1 ? 's' : ''}</div>`
          + `<div>⏱ ${r.time} · 🧟 ${r.kills} abates · ${r.score} pontos</div>`
          + `<div>🪵 ${r.bars} barricada${r.bars === 1 ? '' : 's'} de pé · 🪟 ${r.broken} janela${r.broken === 1 ? '' : 's'} quebrada${r.broken === 1 ? '' : 's'}${r.base ? ' · 📻 base marcada' : ''}</div>`
          + `<div>${r.levels.join(' · ')}</div>`
          + `<div>Estoque: ${r.loot}</div><div style="opacity:.6;font-size:13px;margin-top:6px">Voltando ao menu…</div>`
      }
      $('#msg').textContent = game.st.msgT > 0 ? game.st.msg : (game.players.size ? '' : 'Entre pelo celular para jogar')
      if ((t -= dt) > 0) return
      t = 0.1
      // teclado com cartas para escolher: 1, 2 ou 3
      const me = game.players.get('local'), list = me && !game.st.over && me.cards
      const html = list ? `<div style="font-size:16px;margin-bottom:8px">⬆ Nível ${me.level}! Escolha com <b>1</b>, <b>2</b> ou <b>3</b></div><div style="display:flex;gap:10px">${list.map((u, i) => `<div style="width:190px;padding:8px;border-radius:9px;background:#ffffff14;border:2px solid #ffd24a88"><div style="font-size:15px"><b>${i + 1}</b> · ${u.icon} ${u.name}</div><div style="font-weight:400;font-size:12.5px;opacity:.85;margin-top:4px">${u.text}</div></div>`).join('')}</div>` : ''
      if (html !== shown) { shown = html; cards.innerHTML = html; cards.style.display = html ? 'block' : 'none' }
      $('#wave').textContent = `${game.siege.text() || `⏱ ${clock(game.st.time)}`} · 🧟 ${game.zombies()}` // dia/noite do cerco
      $('#score').textContent = `Pontos ${game.st.score}`
      $('#inv').textContent = game.invText() // estoque do grupo (saque) + 📻 se a base está marcada
      if (climate) $('#clock').textContent = climate.label()
      $('#plist').innerHTML = [...game.players.values()].map((p) => {
        const inf = game.info(p)
        const cds = inf.buttons.filter((b) => b.cd > 0).map((b) => `<span class="cd">${b.l} ${Math.ceil(b.s)}s</span>`).join('')
        const car = p.vehicle ? ` · 🚗 ${p.vehicle.d.name}${p.seat.mode === 'drive' ? ' (dirigindo)' : ''}` : ''
        const mana = p.cls.id === 'mage' ? `<div class="bar mana"><i style="width:${p.mana}%"></i></div>` : ''
        const task = p.task ? ` · ${p.task.icon} ${Math.round((p.task.t / p.task.need) * 100)}%` : ''
        const lv = ` · Nv ${p.level}${p.cards && p.id !== 'local' ? ' <span style="color:#ffd24a">⬆ escolhendo no celular</span>' : ''}`
        const state = p.dead ? (game.st.over ? '' : p.out ? ' · 💀 fora até o amanhecer' : ` · 🆘 caído ${Math.ceil(p.downT)}s`) : p.held ? ' · <span class="grab">🧟 AGARRADO! (V)</span>' : ''
        return `<div class="pl ${p.dead ? 'dead' : ''}" style="border-left:4px solid ${PLAYER_COLORS[p.idx % 4]}"><b>${p.cls.icon} ${p.name}</b>${lv} · ${inf.text} · ${p.kills} abates${car}${p.buffT > 0 ? ' · ✨' : ''}${task}${state}<div class="bar"><i style="width:${(p.hp / p.max) * 100}%"></i></div>${mana}<div class="bar xp"><i style="width:${game.levels.progress(p) * 100}%"></i></div>${cds ? `<div class="cds">${cds}</div>` : ''}</div>`
      }).join('')
    },
  }
}
