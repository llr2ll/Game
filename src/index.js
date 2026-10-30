import * as THREE from 'three'
import { UpdateChunks, ProcessChunkQueue } from './world/chunks/manager'
import { PrewarmBuildings, PrewarmStep } from './world/buildings'
import { UpdateBuildings, UpdateDoors } from './world/buildings-registry'
import { Fps } from './camera/follow'
import { CreateSplitScreen } from './camera/splitscreen'
import { Light } from './camera/light'
import { CreateEntityShadows } from './world/entity-shadows'
import { CreateClimate } from './world/climate'
import { CreateStreetLights } from './world/streetlights'
import { wind } from './world/style'
import { ConnectHost } from './net/host'
import { CreateGame } from './game'
import { CreateHud } from './ui/hud'
import { CreateLobby } from './ui/lobby'
import { BindKeyboard } from './input/keyboard'
import { CreateSoundscape } from './audio/soundscape'
import { sfx } from './audio/sfx'

export async function LoadGame() {
  const gameWindow = document.getElementById('render-target')
  const camera = new THREE.PerspectiveCamera(55, gameWindow.offsetWidth / gameWindow.offsetHeight, 0.4, 150)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  const scene = new THREE.Scene()
  const colliders = []

  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
  renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight)
  gameWindow.appendChild(renderer.domElement)
  const climate = CreateClimate(scene, Light(scene, renderer)) // dia/noite, chuva, neblina, vento
  const entityShadows = CreateEntityShadows(scene)
  const streetLights = CreateStreetLights(scene) // postes acendem à noite, semáforos trocam de cor

  const split = CreateSplitScreen(renderer, scene)
  const sound = CreateSoundscape() // vento, chuva, água, motores, passos, zumbis… (efeitos soltos: audio/sfx.js)
  let hud, game, net
  let phase = 'lobby' // 'lobby' | 'playing'

  // celulares conectados recebem "você é o Jogador N, aguardando o host" enquanto o menu está aberto
  function notifyPhones() {
    if (phase !== 'lobby' || !net) return
    const list = lobby.entries()
    for (const e of list) if (e.type === 'phone') net.send(e.id, { t: 'lobby', slot: e.slot + 1, total: list.length })
  }
  function toLobby() {
    sound.clear()
    game.clear()
    split.reset()
    phase = 'lobby'
    lobby.show()
    notifyPhones()
  }

  const lobby = CreateLobby({
    onStart: (entries) => {
      phase = 'playing'
      sfx('start')
      split.reset()
      lobby.hide()
      for (const e of entries) game.addPlayer(e.id, e.name, e.slot)
    },
    onKick: (id) => net.send(id, { t: 'kick', msg: 'Você foi removido da sala' }),
    onChange: notifyPhones,
  })

  net = ConnectHost({
    onRoom: (code) => { hud.setRoom(code); lobby.setRoom(code); lobby.setOnline(true) },
    onOffline: () => {
      lobby.setOnline(false)
      for (const e of lobby.entries()) if (e.type === 'phone') game.removePlayer(e.id)
      lobby.resetPhones()
    },
    onJoin: (id, name) => {
      const slot = lobby.addPhone(id, name)
      if (slot < 0) return net.send(id, { t: 'kick', msg: 'Sala cheia' })
      if (phase === 'playing') game.addPlayer(id, name, slot) // entrada tardia: já nasce na partida
    },
    onLeave: (id) => { lobby.removeId(id); game.removePlayer(id) },
    onInput: (id, m) => game.setInput(id, m),
    onAct: (id, a) => game.act(id, a),
  })
  game = CreateGame(scene, colliders, net, { onEnd: toLobby, night: () => climate.time < 0.24 || climate.time > 0.78 })
  hud = CreateHud(game, climate)
  BindKeyboard(game)
  setInterval(notifyPhones, 1000)
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && phase === 'playing') toLobby() })

  PrewarmBuildings() // enfileira as geometrias das casas; PrewarmStep gera uma por quadro (evita engasgo ao carregar chunks)
  // carrega o entorno inicial de uma vez
  UpdateChunks(scene, colliders, [{ x: 0, z: 0 }])
  ProcessChunkQueue(scene, colliders, 999)

  addEventListener('resize', () => {
    const w = gameWindow.offsetWidth, h = gameWindow.offsetHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })

  let orbit = 0
  const clock = new THREE.Clock()
  function draw() {
    const dt = Math.min(clock.getDelta(), 0.05)
    game.update(dt)
    wind.value += dt // vento: só um uniform; o balanço acontece na GPU
    const list = [...game.players.values()]
    const pts = list.length ? list : [{ x: 0, z: 0 }]
    climate.update(dt, list.length ? list.filter((p) => !p.dead) : [{ x: 8, z: -6 }])
    entityShadows.update(list, game.enemies, game.vehicles.list)
    streetLights.update(dt, climate.time, climate.weather.over, pts)
    UpdateDoors(dt, list, game.enemies) // portas abrem quando alguém chega perto
    sound.update(dt, game, climate, streetLights, phase === 'lobby')
    PrewarmStep()
    if (phase === 'lobby') {
      UpdateChunks(scene, colliders, pts)
      ProcessChunkQueue(scene, colliders, 2)
      // no menu, a câmera gira devagar em volta do posto, de fundo
      orbit += dt * 0.1
      camera.position.set(8 + Math.sin(orbit) * 22, 11, -6 + Math.cos(orbit) * 22)
      camera.lookAt(8, 1.5, -6)
      hud.update(dt)
      UpdateBuildings([])
      climate.view(camera)
      split.full(camera)
    } else {
      // uma tela por grupo de jogadores; com a tela dividida cada jogador carrega menos chunks (mantém o FPS)
      const views = split.update(list, dt)
      UpdateChunks(scene, colliders, pts, views.length > 1 ? 2 : 3)
      ProcessChunkQueue(scene, colliders, 1)
      hud.update(dt)
      split.render(views, (v) => { UpdateBuildings(v.group.members); climate.view(v.cam) }) // cada tela mostra o andar de quem está nela (telhado some)
    }
    Fps()
  }
  return renderer.setAnimationLoop(draw)
}
