// Jogador local (mouse + teclado): só existe se uma vaga "Mouse e teclado" foi escolhida no menu.
// WASD move · mouse mira · clique esquerdo ataca · clique direito só mira · Shift corre · Espaço pula · E entra/sai do veículo
// Q / F / G = botões da classe · V empurra (solta do agarrão, pisa em zumbi caído) · E usa
// extra = teclas do jogo, somadas às padrão (ex.: { r: 'reload', 1: 'carbine' })
export const DEFAULT_KEYS = { q: 'b1', f: 'b2', g: 'b3', v: 'shove', e: 'use' }
export function BindKeyboard(game, extra = {}) {
  const ACT = { ...DEFAULT_KEYS, ...extra }
  const keys = {}
  let mx = 0, my = 0, left = false, right = false
  const active = () => game.players.has('local')
  const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')

  function push() {
    if (!active()) return
    const x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), z = (keys.s ? 1 : 0) - (keys.w ? 1 : 0)
    const ax = mx - innerWidth / 2, az = my - innerHeight / 2
    const l = Math.hypot(ax, az) || 1, on = left || right
    game.setInput('local', { run: !!keys.shift, mx: x, mz: z, ax: on ? ax / l : 0, az: on ? az / l : 0, fire: left ? 1 : 0 })
  }
  addEventListener('keydown', (e) => {
    if (typing(e)) return
    const k = e.key.toLowerCase()
    if (k === 'h') return document.getElementById('room').classList.toggle('hidden')
    if (!active()) return
    if (e.code === 'Space') { e.preventDefault(); game.act('local', 'jump') }
    if (k === 'shift') keys.shift = true
    if ('wasd'.includes(k) && k.length === 1) keys[k] = true
    if (ACT[k] && !e.repeat) game.act('local', ACT[k])
    push()
  })
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; push() })
  addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; push() })
  addEventListener('mousedown', (e) => { if (!active()) return; if (e.button === 2) right = true; else left = true; push() })
  addEventListener('mouseup', (e) => { if (e.button === 2) right = false; else left = false; push() })
  addEventListener('contextmenu', (e) => { if (active()) e.preventDefault() })
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; left = right = false; push() })
}
