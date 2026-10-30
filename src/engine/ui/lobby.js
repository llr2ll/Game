import QRCode from 'qrcode'

const $ = (s) => document.querySelector(s)
const COLORS = ['#c85b72', '#4a86c8', '#e0b23c', '#57a773'] // mesmas cores de cada jogador
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])


// O menu cria o próprio HTML/CSS se a página ainda não tiver (assim o index.html e o main.css não são obrigatórios).
const MARKUP = (sub) => `<div id="lobby">
      <div class="lb-main">
        <h1>GAME</h1>
        <p class="sub">${sub}</p>
        <div id="slots"></div>
        <button id="start" disabled>Adicione um jogador para iniciar</button>
        <small>Escolha o controle de cada jogador · Enter inicia · Esc volta ao menu durante a partida</small>
      </div>
      <div class="lb-side">
        <canvas id="qr2" width="180" height="180"></canvas>
        <div id="code2">----</div>
        <div id="url2"></div>
        <div id="net">Conectando ao servidor…</div>
        <small>No celular: escaneie o QR code. Quem entrar já ocupa uma vaga.</small>
      </div>
    </div>`
const STYLE = `/* ---------- lobby ---------- */
#lobby { position: fixed; inset: 0; z-index: 20; display: flex; gap: 32px; align-items: center; justify-content: center; padding: 24px; color: #fff;
  background: linear-gradient(#1b1512e6, #3a2418cc); backdrop-filter: blur(3px) }
#lobby.hidden { display: none }
body.in-lobby #hud { display: none }
.lb-main { width: min(620px, 94vw); display: flex; flex-direction: column; gap: 14px }
.lb-main h1 { margin: 0; font-size: 54px; letter-spacing: 8px; color: #ffcf9a; text-shadow: 0 3px 0 #7a3b2a }
.lb-main .sub { margin: -8px 0 4px; opacity: .75 }
#slots { display: grid; grid-template-columns: 1fr 1fr; gap: 12px }
.slot { position: relative; background: #0008; border-left: 6px solid var(--c); border-radius: 10px; padding: 12px 14px; min-height: 108px; display: flex; flex-direction: column; gap: 8px }
.slot .sn { font-weight: 700; font-size: 13px; opacity: .8; letter-spacing: 1px }
.slot .opts { display: flex; flex-direction: column; gap: 6px }
.slot button, #start { font: inherit; font-weight: 700; color: #fff; border: 0; border-radius: 8px; padding: 9px 12px; background: #fff2; cursor: pointer }
.slot button:hover:not(:disabled), #start:hover:not(:disabled) { background: #fff4 }
.slot button:disabled { opacity: .35; cursor: not-allowed }
.slot .x { position: absolute; top: 6px; right: 6px; padding: 2px 8px; background: #0006 }
.slot input { font: inherit; font-weight: 700; font-size: 18px; background: #0006; color: #fff; border: 1px solid #fff3; border-radius: 6px; padding: 6px 8px; width: calc(100% - 34px) }
.slot .st { font-size: 14px; opacity: .85 } .slot .st.wait { color: #ffcf9a }
#start { font-size: 20px; padding: 14px; background: #c85b72 } #start:disabled { background: #fff2; opacity: .6; cursor: not-allowed }
.lb-main small { opacity: .6 }
.lb-side { background: #0008; border-radius: 14px; padding: 18px; text-align: center; width: 220px; display: flex; flex-direction: column; gap: 8px; align-items: center }
.lb-side canvas { border-radius: 8px; background: #fff }
#code2 { font: 700 38px monospace; letter-spacing: 8px } #url2 { font-size: 10px; opacity: .6; word-break: break-all }
#net { font-size: 13px; color: #ffcf9a } #net.on { color: #8fe08f }
@media (max-width: 820px) { #lobby { flex-direction: column; overflow: auto; justify-content: flex-start } .lb-side { width: auto } }`

function ensureDom(sub) {
  if (!$('#lobby')) document.body.insertAdjacentHTML('afterbegin', MARKUP(sub))
  const el = $('#lobby')
  if (getComputedStyle(el).position !== 'fixed') {
    const st = document.createElement('style')
    st.textContent = STYLE
    document.head.appendChild(st)
  }
}

// Menu inicial: 4 vagas; cada vaga é "Celular" (entra pelo QR/código) ou "Mouse e teclado" (jogador local).
// O jogo passa: labels = texto de cada vaga (ex.: a classe) · sound(nome, opções) = som da interface · subtitle = frase do menu
export function CreateLobby({ onStart, onKick, onChange, labels = ['', '', '', ''], sound = () => {}, subtitle = '' }) {
  ensureDom(subtitle)
  const slots = [null, null, null, null] // { type: 'phone' | 'kb', id, name }
  let code = ''
  const el = $('#lobby'), box = $('#slots')
  const hasKb = () => slots.some((s) => s && s.type === 'kb')
  const entries = () => slots.map((s, i) => (s && s.id ? { slot: i, id: s.id, name: s.name, type: s.type } : null)).filter(Boolean)

  function render() {
    box.innerHTML = slots.map((s, i) => {
      const head = `<div class="slot" style="--c:${COLORS[i]}"><div class="sn">JOGADOR ${i + 1} · <span style="color:${COLORS[i]}">${labels[i]}</span></div>`
      if (!s) {
        return `${head}<div class="opts"><button data-a="phone" data-i="${i}">📱 Celular</button><button data-a="kb" data-i="${i}" ${hasKb() ? 'disabled title="Só um jogador pode usar mouse e teclado"' : ''}>⌨️ Mouse e teclado</button></div></div>`
      }
      const x = `<button class="x" data-a="del" data-i="${i}" title="Remover">✕</button>`
      if (s.type === 'kb') return `${head}${x}<input data-name="${i}" value="${esc(s.name)}" maxlength="12" /><div class="st">⌨️ Mouse e teclado · pronto</div></div>`
      if (!s.id) return `${head}${x}<div class="st wait">📱 Aguardando celular…</div><div class="st">Código <b>${esc(code || '----')}</b></div></div>`
      return `${head}${x}<div style="font-weight:700;font-size:18px">${esc(s.name)}</div><div class="st">📱 Celular conectado · pronto</div></div>`
    }).join('')
    const n = entries().length
    $('#start').disabled = !n
    $('#start').textContent = n ? `Iniciar partida (${n} jogador${n > 1 ? 'es' : ''})` : 'Adicione um jogador para iniciar'
  }

  box.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-a]')
    if (!b) return
    const i = +b.dataset.i, a = b.dataset.a
    sound('ui', { f: a === 'del' ? 520 : 880 })
    if (a === 'phone' && !slots[i]) slots[i] = { type: 'phone', id: null, name: '' }
    else if (a === 'kb' && !slots[i] && !hasKb()) slots[i] = { type: 'kb', id: 'local', name: `Jogador ${i + 1}` }
    else if (a === 'del') {
      const s = slots[i]
      slots[i] = null
      if (s && s.type === 'phone' && s.id) onKick(s.id)
    }
    render(); onChange()
  })
  box.addEventListener('input', (e) => {
    const i = e.target.dataset.name
    if (i !== undefined && slots[+i]) slots[+i].name = e.target.value.trim().slice(0, 12) || `Jogador ${+i + 1}`
  })
  const start = () => { const list = entries(); if (list.length && !el.classList.contains('hidden')) onStart(list) }
  $('#start').addEventListener('click', start)
  addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') start() })

  render()
  return {
    entries,
    show() { el.classList.remove('hidden'); document.body.classList.add('in-lobby'); render() },
    hide() { el.classList.add('hidden'); document.body.classList.remove('in-lobby') },
    setOnline(on) { $('#net').textContent = on ? 'Servidor conectado' : 'Servidor offline — tentando reconectar…'; $('#net').classList.toggle('on', on) },
    setRoom(c) {
      code = c
      const url = `${location.origin}/controller.html?room=${c}`
      $('#code2').textContent = c
      $('#url2').textContent = url
      try { QRCode.toCanvas($('#qr2'), url, { width: 180, margin: 1 }) } catch { /* sem canvas */ }
      render()
    },
    // celular entrou: ocupa uma vaga de celular que esteja esperando, ou a primeira vaga livre. Devolve o índice ou -1.
    addPhone(id, name) {
      let i = slots.findIndex((s) => s && s.type === 'phone' && !s.id)
      if (i < 0) i = slots.findIndex((s) => !s)
      if (i < 0) return -1
      slots[i] = { type: 'phone', id, name: (name || '').slice(0, 12) || `Jogador ${i + 1}` }
      sound('join')
      render(); onChange()
      return i
    },
    removeId(id) {
      const i = slots.findIndex((s) => s && s.id === id)
      if (i >= 0) { slots[i] = null; render(); onChange() }
    },
    resetPhones() { slots.forEach((s, i) => { if (s && s.type === 'phone') slots[i] = null }); render() },
  }
}
