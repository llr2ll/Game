// Controle no celular: stick esquerdo move (ou dirige), stick direito mira (e ataca enquanto estiver inclinado).
// Botões da classe chegam do jogo (nome + recarga) e o botão 🚗 aparece perto de um veículo.
// Empurrar: afasta/derruba zumbis e solta do agarrão (pisa em quem está caído); pisca quando um zumbi agarra.
const $ = (s) => document.querySelector(s)
const params = new URLSearchParams(location.search)
$('#code').value = (params.get('room') || '').toUpperCase()
$('#name').value = localStorage.getItem('name') || ''

const url = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8080`
const input = { mx: 0, mz: 0, ax: 0, az: 0, run: 0 }
let ws, lastHp = 100, lastHeld = false, kicked = false

function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)) }

$('#go').onclick = () => {
  const code = $('#code').value.trim().toUpperCase(), name = $('#name').value.trim() || 'Jogador'
  if (code.length !== 4) return ($('#err').textContent = 'Digite o código de 4 letras')
  localStorage.setItem('name', name)
  $('#err').textContent = ''
  ws = new WebSocket(url)
  ws.onopen = () => send({ t: 'join', code, name })
  ws.onerror = () => ($('#err').textContent = 'Não consegui conectar ao servidor')
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.t === 'joined') {
      $('#join').style.display = 'none'
      $('#pad').style.display = 'block'
      document.documentElement.requestFullscreen?.().catch(() => {})
      screen.orientation?.lock?.('landscape').catch(() => {})
    } else if (m.t === 'error') $('#err').textContent = m.msg
    else if (m.t === 'state') onState(m)
    else if (m.t === 'hit') navigator.vibrate?.(120)
    else if (m.t === 'lobby') showState(`Você é o Jogador ${m.slot}\nAguardando o host iniciar… (${m.total} na sala)`)
    else if (m.t === 'kick') { kicked = true; showState(m.msg || 'Removido da sala'); ws.close() }
    else if (m.t === 'closed') showState('Jogo encerrado')
  }
  ws.onclose = () => { if (!kicked && $('#pad').style.display === 'block') showState('Desconectado — recarregue a página') }
}

function showState(t) { const s = $('#state'); s.textContent = t; s.style.display = t ? 'block' : 'none' }

function onState(m) {
  $('#hp i').style.width = `${(m.hp / m.max) * 100}%`
  $('#hp i').style.background = m.hp < 30 ? '#e25555' : '#6fd36f'
  $('#cls').textContent = m.cls || ''
  $('#weapon').textContent = m.w
  ;(m.btn || []).concat([null, null, null]).slice(0, 3).forEach((b, i) => {
    const el = $(`#b${i + 1}`)
    el.classList.toggle('hide', !b)
    if (!b) return
    if (el.textContent !== b[0]) el.textContent = b[0]
    el.style.setProperty('--cd', b[1])
  })
  const use = $('#use')
  use.className = m.car === 2 ? 'in' : m.car === 1 ? 'near' : ''
  use.textContent = m.car === 2 ? '🚗 Sair' : '🚗 Entrar'
  $('#time').textContent = `⏱ ${String(Math.floor(m.time / 60)).padStart(2, '0')}:${String(m.time % 60).padStart(2, '0')}`
  $('#shove').classList.toggle('alert', !!m.held)
  $('#st i').style.width = `${m.st}%`
  if (m.st <= 0 && input.run) { input.run = 0; $('#run').classList.remove('on') }
  showState(m.dead ? (m.rv ? `Você caiu — volta em ${m.rv}s` : 'Você caiu') : m.held ? 'AGARRADO!\nEmpurre ou puxe para longe' : '')
  if (m.held && !lastHeld) navigator.vibrate?.([80, 40, 80])
  lastHeld = !!m.held
  if (m.hp < lastHp) navigator.vibrate?.(60)
  lastHp = m.hp
}

function Stick(zone, cb) {
  const base = zone.querySelector('.base'), knob = zone.querySelector('.knob'), R = 55
  let id = null, ox = 0, oy = 0
  const move = (e) => {
    let dx = e.clientX - ox, dy = e.clientY - oy
    const l = Math.hypot(dx, dy)
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R }
    knob.style.transform = `translate(${dx}px,${dy}px)`
    cb(dx / R, dy / R)
  }
  zone.addEventListener('pointerdown', (e) => {
    if (id !== null) return
    id = e.pointerId
    zone.setPointerCapture(id)
    ox = e.clientX; oy = e.clientY
    base.style.cssText = `display:block;left:${ox}px;top:${oy}px`
    move(e)
  })
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e) })
  const end = (e) => {
    if (e.pointerId !== id) return
    id = null
    base.style.display = 'none'
    knob.style.transform = ''
    cb(0, 0)
  }
  zone.addEventListener('pointerup', end)
  zone.addEventListener('pointercancel', end)
}
Stick($('#zl'), (x, y) => { input.mx = x; input.mz = y })
Stick($('#zr'), (x, y) => { input.ax = x; input.az = y })

for (const [id, a] of [['#b1', 'b1'], ['#b2', 'b2'], ['#b3', 'b3'], ['#use', 'use']]) {
  $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); send({ t: 'act', a }); navigator.vibrate?.(15) })
}

// Correr liga/desliga (os dois polegares ficam nos sticks); Pular é um toque
$('#run').addEventListener('pointerdown', (e) => { e.stopPropagation(); input.run = input.run ? 0 : 1; $('#run').classList.toggle('on', !!input.run) })
$('#jump').addEventListener('pointerdown', (e) => { e.stopPropagation(); send({ t: 'act', a: 'jump' }); navigator.vibrate?.(15) })
$('#shove').addEventListener('pointerdown', (e) => { e.stopPropagation(); send({ t: 'act', a: 'shove' }); navigator.vibrate?.(25) })

setInterval(() => send({ t: 'in', run: input.run, mx: +input.mx.toFixed(2), mz: +input.mz.toFixed(2), ax: +input.ax.toFixed(2), az: +input.az.toFixed(2) }), 33)
