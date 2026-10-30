import * as THREE from 'three'
import { UpdateChunks, ProcessChunkQueue } from './world/chunks/manager'
import { SmoothFollow, Fps } from './camera/follow'
import { Light } from './camera/light'
import { ConnectHost } from './net/host'
import { CreateGame } from './game'
import { CreateHud } from './ui/hud'
import { BindKeyboard } from './input/keyboard'

export async function LoadGame() {
  const gameWindow = document.getElementById('render-target')
  const camera = new THREE.PerspectiveCamera(55, gameWindow.offsetWidth / gameWindow.offsetHeight, 0.1, 150)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  const scene = new THREE.Scene()
  const colliders = []

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight)
  gameWindow.appendChild(renderer.domElement)
  Light(scene)

  let hud
  const net = ConnectHost({
    onRoom: (code) => hud.setRoom(code),
    onJoin: (id, name) => game.addPlayer(id, name),
    onLeave: (id) => game.removePlayer(id),
    onInput: (id, m) => game.setInput(id, m),
    onAct: (id, a) => game.act(id, a),
  })
  const game = CreateGame(scene, colliders, net)
  hud = CreateHud(game)
  BindKeyboard(game)

  // carrega o entorno inicial de uma vez
  UpdateChunks(scene, colliders, [{ x: 0, z: 0 }])
  ProcessChunkQueue(scene, colliders, 999)

  addEventListener('resize', () => {
    const w = gameWindow.offsetWidth, h = gameWindow.offsetHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })

  const clock = new THREE.Clock()
  function draw() {
    const dt = Math.min(clock.getDelta(), 0.05)
    game.update(dt)
    const pts = game.players.size ? [...game.players.values()] : [{ x: 0, z: 0 }]
    UpdateChunks(scene, colliders, pts)
    ProcessChunkQueue(scene, colliders, 2)
    SmoothFollow(camera, pts, dt)
    hud.update(dt)
    renderer.render(scene, camera)
    Fps()
  }
  return renderer.setAnimationLoop(draw)
}
