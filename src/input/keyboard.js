// Jogador local no PC para testar sem celular: WASD + mouse (mira) + clique (atira)
export function BindKeyboard(game) {
  const keys = {}
  let joined = false, mx = 0, my = 0, down = false
  const ensure = () => { if (!joined) { joined = true; game.addPlayer('local', 'PC') } }

  function push() {
    const x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), z = (keys.s ? 1 : 0) - (keys.w ? 1 : 0)
    const ax = mx - innerWidth / 2, az = my - innerHeight / 2
    const l = Math.hypot(ax, az) || 1
    game.setInput('local', { run: !!keys.shift, mx: x, mz: z, ax: down ? ax / l : 0, az: down ? az / l : 0 })
  }
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase()
    if (k === 'h') return document.getElementById('room').classList.toggle('hidden')
    if (e.code === 'Space') { e.preventDefault(); ensure(); game.act('local', 'jump') }
    if (k === 'shift') { ensure(); keys.shift = true }
    if ('wasd'.includes(k) && k.length === 1) { ensure(); keys[k] = true }
    if (k === '1') game.act('local', 'pistol')
    if (k === '2') game.act('local', 'carbine')
    if (k === 'r') game.act('local', 'reload')
    push()
  })
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; push() })
  addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; if (joined) push() })
  addEventListener('mousedown', () => { ensure(); down = true; push() })
  addEventListener('mouseup', () => { down = false; push() })
}
