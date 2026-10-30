// A tela do jogo (host) abre uma sala no servidor; celulares entram com o código.
export function ConnectHost(h) {
  const url = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:8080`
  let ws
  const api = { send: (id, data) => ws && ws.readyState === 1 && ws.send(JSON.stringify({ id, ...data })) }

  function open() {
    ws = new WebSocket(url)
    ws.onopen = () => ws.send(JSON.stringify({ t: 'host' }))
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.t === 'room') h.onRoom(m.code)
      else if (m.t === 'join') h.onJoin(m.id, m.name)
      else if (m.t === 'leave') h.onLeave(m.id)
      else if (m.t === 'in') h.onInput(m.id, m)
      else if (m.t === 'act') h.onAct(m.id, m.a)
    }
    ws.onclose = () => { h.onOffline && h.onOffline(); setTimeout(open, 2000) }
  }
  open()
  return api
}
