import { LoadChunk, ProcessChunkQueue } from './world/chunks/manager'
import { SmoothFollow, Fps } from './camera/follow'
import { CreatePlayer } from './characters/player'
import { Light } from './camera/light'
import * as THREE from 'three'

export async function LoadGame() {
    const gameWindow = document.getElementById('render-target')
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight)
    const renderer = new THREE.WebGLRenderer();
    const scene = new THREE.Scene();
    const colliders = [];

    renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight)
    const player = await CreatePlayer(scene, colliders)
    window.addEventListener('resize', OnResize)
    gameWindow.appendChild(renderer.domElement)
    Light(scene)
    
    function OnResize() {
        const width = gameWindow.offsetWidth
        const height = gameWindow.offsetHeight

        camera.aspect = width / height
        camera.updateProjectionMatrix()

        renderer.setSize(gameWindow.offsetWidth, gameWindow.offsetHeight)
    }

    function draw() {
        LoadChunk(scene, player.mesh, colliders)
        ProcessChunkQueue()
        player.move();
        SmoothFollow(camera, player.mesh);
        renderer.render(scene, camera);
        Fps()
    }

    return renderer.setAnimationLoop(draw)
}