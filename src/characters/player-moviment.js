import { CheckCollision } from "./player-collision"
import * as THREE from 'three'

export function playerMoviment(mesh, colliders){
    const velocity = new THREE.Vector3()
    let verticalSpeed = 0
    let isJumping = false
    let jumpHoldTime = 0
    let grounded = true
    const keys = {}

    window.addEventListener('visibilitychange', () => { if (document.hidden) for (const key in keys) { keys[key] = false } })
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false)
    window.addEventListener('keydown', e=> keys[e.key.toLowerCase()] = true)

    function move(){
        const nextX = mesh.position.x + velocity.x
        const nextZ = mesh.position.z + velocity.z

        let x = 0
        let z = 0

        if(keys.w) z -= 1
        if(keys.s) z += 1
        if(keys.a) x -= 1
        if(keys.d) x += 1

        const speed = keys.shift ? 0.10 : 0.06

        if( x !== 0 || z !== 0 ){

            const length = Math.hypot(x, z)

            x /= length
            z /= length

            velocity.x += x * 0.01
            velocity.z += z * 0.01

            const current = Math.hypot(velocity.x, velocity.z)

            if(current > speed) velocity.multiplyScalar(speed / current)

            const targetRotation = Math.atan2(velocity.x, velocity.z)
            mesh.rotation.y += (targetRotation - mesh.rotation.y) * 0.15
        }
        else velocity.multiplyScalar(0.9)

        if (keys[' '] && grounded && !isJumping){
            verticalSpeed = 0.16
            grounded = false
            isJumping = true
            jumpHoldTime = 0
        }

        if (isJumping && keys[' '] && verticalSpeed > 0){
            jumpHoldTime += 0.016

            if (jumpHoldTime < 0.5) verticalSpeed += 0.0035
        }

        verticalSpeed -= 0.009
        mesh.position.y += verticalSpeed

        if (mesh.position.y < 0.5) {
            mesh.position.y = 0.5
            verticalSpeed = 0
            grounded = true
            isJumping = false
            jumpHoldTime = 0
        }

        if (!CheckCollision({ x: nextX, z: mesh.position.z }, colliders, mesh)) mesh.position.x = nextX
        if (!CheckCollision({ x: mesh.position.x, z: nextZ }, colliders, mesh)) mesh.position.z = nextZ
    }

    return move
}