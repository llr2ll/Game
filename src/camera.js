import * as THREE from 'three'

const target = new THREE.Vector3()
let lastTime = performance.now()
let frames = 0

export function SmoothFollow(camera, player) {
    target.set(player.position.x, player.position.y + 5, player.position.z + 7)
    camera.position.lerp(target, 0.08)
    camera.lookAt(player.position)
}

export function Fps() {
    const fpsElement = document.getElementById('fps-element')

    frames++

    const now = performance.now()

    if (now - lastTime >= 1000) {
        fpsElement.textContent = `FPS: ${frames}`

        frames = 0
        lastTime = now
    }
}