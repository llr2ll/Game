import { LoadChunk, ProcessChunkQueue } from './world/tile/render'
import { CreatePlayer } from './characters/player'
import { SmoothFollow, Fps } from './camera'
import { Seed } from './world/seed.js'
import * as THREE from 'three'

export async function createScene() {
    const gameWindow = document.getElementById('render-target')
    const camera = new THREE.PerspectiveCamera(75, gameWindow.offsetWidth / gameWindow.offsetHeight, 0.1, 1000)
    const renderer = new THREE.WebGLRenderer()
    const scene = new THREE.Scene()
    const colliders = []

    const player = await CreatePlayer(scene, colliders)

    renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight)
    scene.background = new THREE.Color(0x777777)
    gameWindow.appendChild(renderer.domElement)

    function onResize() {
        const width = gameWindow.offsetWidth
        const height = gameWindow.offsetHeight

        camera.aspect = width / height
        camera.updateProjectionMatrix()

        renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight)
    }

    window.addEventListener('resize', onResize)

    function draw() {
        LoadChunk(scene, player.mesh)
        ProcessChunkQueue()
        SmoothFollow(camera, player.mesh)
        renderer.render(scene, camera)
        Seed(scene, colliders)
        player.move()
        Fps()
    }

    return { start: renderer.setAnimationLoop(draw) }
}