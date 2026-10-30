// Relay online: a TELA (PC/TV) cria uma sala, os CELULARES entram com o código.
// Mensagens: host->{t:'host'} | player->{t:'join',code,name} | player->{t:'in'|'act'} | host->{id,...} (vai pro celular)
import { WebSocketServer } from 'ws'

const PORT = process.env.PORT || 8080
const MAX_PLAYERS = 4
const wss = new WebSocketServer({ port: PORT })
const rooms = new Map()
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

const send = (ws, o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o))
function newCode() {
  let c
  do c = Array.from({ length: 4 }, () => LETTERS[(Math.random() * LETTERS.length) | 0]).join('')
  while (rooms.has(c))
  return c
}

wss.on('connection', (ws) => {
  ws.alive = true
  ws.on('pong', () => (ws.alive = true))

  ws.on('message', (raw) => {
    let m
    try { m = JSON.parse(raw) } catch { return }

    if (m.t === 'host') {
      const code = newCode()
      rooms.set(code, { host: ws, players: new Map(), next: 1 })
      ws.room = code; ws.role = 'host'
      send(ws, { t: 'room', code })
    } else if (m.t === 'join' && !ws.role) {
      const r = rooms.get(String(m.code || '').toUpperCase())
      if (!r) return send(ws, { t: 'error', msg: 'Sala não encontrada' })
      if (r.players.size >= MAX_PLAYERS) return send(ws, { t: 'error', msg: 'Sala cheia' })
      const id = 'p' + r.next++
      r.players.set(id, ws)
      ws.room = String(m.code).toUpperCase(); ws.role = 'player'; ws.id = id
      send(ws, { t: 'joined', id })
      send(r.host, { t: 'join', id, name: String(m.name || id).slice(0, 12) })
    } else if (ws.role === 'player') {
      const r = rooms.get(ws.room)
      if (r) send(r.host, { ...m, id: ws.id })
    } else if (ws.role === 'host') {
      const r = rooms.get(ws.room)
      const p = r && r.players.get(m.id)
      if (p) send(p, m)
    }
  })

  ws.on('close', () => {
    const r = rooms.get(ws.room)
    if (!r) return
    if (ws.role === 'host') {
      r.players.forEach((p) => send(p, { t: 'closed' }))
      rooms.delete(ws.room)
    } else if (ws.role === 'player') {
      r.players.delete(ws.id)
      send(r.host, { t: 'leave', id: ws.id })
    }
  })
})

// evita que hospedagens derrubem conexões ociosas
setInterval(() => wss.clients.forEach((c) => { if (!c.alive) return c.terminate(); c.alive = false; c.ping() }), 25000)
console.log(`Servidor do jogo na porta ${PORT}`)
