import * as THREE from 'three'
import { UpdateChunks, ProcessChunkQueue, SetupChunks } from '../../engine/world/chunks'
import { SetDeepTest } from '../../engine/world/collision'
import { SetIndoorRoute } from '../../engine/world/pathing'
import { SetIndoorTest } from '../../engine/audio/engine'
import { events } from '../../engine/core/events'
import { StartLoop } from '../../engine/core/loop'
import { PrewarmBuildings, PrewarmStep } from '../../shared/worldgen/buildings'
import { UpdateBuildings, UpdateDoors, AddBuildings, RemoveBuildings, PointInBuilding, ChaseTarget } from '../../shared/worldgen/buildings-registry'
import { GenerateChunk } from '../../shared/worldgen/generator'
import { CHUNK_SIZE } from '../../shared/worldgen/map'
import { TooDeep } from '../../shared/worldgen/sidewalk'
import { RegisterVehicleSpawn } from '../../shared/vehicles/vehicles'
import { Fps } from '../../engine/render/follow'
import { CreateSplitScreen } from '../../engine/render/splitscreen'
import { Light } from '../../engine/render/light'
import { CreateEntityShadows } from '../../engine/render/entity-shadows'
import { CreateClimate } from '../../shared/worldgen/climate'
import { CreateStreetLights, AddLamps, RemoveLamps } from '../../shared/worldgen/streetlights'
import { wind } from '../../engine/render/style'
import { ConnectHost } from '../../engine/net/host'
import { CreateGame } from './rules/survival'
import { CLASS_ORDER, CLASSES } from './abilities/classes'
import { CreateHud } from './ui/hud'
import { CreateLobby } from '../../engine/ui/lobby'
import { BindKeyboard } from '../../engine/input/keyboard'
import { CreateSoundscape } from '../../shared/audio/soundscape'
import { sfx, gate } from '../../shared/audio/sfx'

const SLOT_LABELS = CLASS_ORDER.map((k) => `${CLASSES[k].icon} ${CLASSES[k].name}`) // a vaga define a classe
const KEYS = { r: 'reload', 1: 'carbine', 2: 'shotgun', 3: 'pistol' } // teclas do Atirador (as outras são padrão do motor)

// O motor e o mundo não conhecem este jogo: aqui o jogo liga as peças (casas, postes, água, carros, sons do mundo).
function Wire() {
  SetupChunks({
    size: CHUNK_SIZE, generate: GenerateChunk,
    onLoad: (c) => { AddBuildings(c.userData.buildings); AddLamps(c.userData.lamps) },
    onUnload: (c) => { RemoveBuildings(c.userData.buildings); RemoveLamps(c.userData.lamps) },
  })
  SetDeepTest(TooDeep) // água funda bloqueia a passagem
  SetIndoorRoute(ChaseTarget) // zumbis entram pela porta e sobem a escada
  SetIndoorTest(PointInBuilding) // parede no meio abafa o som
  events.on('vehicle-spot', RegisterVehicleSpawn) // vaga na estrada → carro dirigível
  events.on('door-open', (d) => sfx('dooropen', d))
  events.on('door-close', (d) => sfx('doorclose', d))
  events.on('thunder', (d) => sfx('thunder', d))
  events.on('splash', (d) => gate('splash', 0.08) && sfx('splash', d))
}

export async function LoadGame() {
  Wire()
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
    labels: SLOT_LABELS, sound: sfx, subtitle: 'Sobreviva aos zumbis · até 4 jogadores',
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
  BindKeyboard(game, KEYS)
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
  function draw(dt) {
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
  return StartLoop(renderer, draw)
}
