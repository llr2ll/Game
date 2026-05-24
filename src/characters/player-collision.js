import * as THREE from 'three'

const raycaster = new THREE.Raycaster()
const box = new THREE.Box3()

export function CheckCollision(nextPos, colliders, mesh) {

    const direction = new THREE.Vector3(nextPos.x - mesh.position.x, 0, nextPos.z - mesh.position.z)
    const distance = direction.length()
    const radius = 0.5

    if (distance === 0) return false

    direction.normalize()

    const origins = [

        new THREE.Vector3(
            mesh.position.x,
            mesh.position.y + 0.5,
            mesh.position.z
        ),

        new THREE.Vector3(
            mesh.position.x + direction.z * radius,
            mesh.position.y + 0.5,
            mesh.position.z - direction.x * radius
        ),

        new THREE.Vector3(
            mesh.position.x - direction.z * radius,
            mesh.position.y + 0.5,
            mesh.position.z + direction.x * radius
        )

    ]

    raycaster.far = distance + 0.2

    const objects = colliders.filter(c => c.type === 'wall').map(c => c.mesh)

    for (let r = 0; r < origins.length; r++) {

        raycaster.set(origins[r], direction)

        const hits = raycaster.intersectObjects(objects, false)

        for (let i = 0; i < hits.length; i++) {

            const wall = hits[i].object

            box.setFromObject(wall)

            const playerBottom = mesh.position.y
            const playerTop = mesh.position.y + 1.8
            const wallBottom = box.min.y
            const wallTop = box.max.y

            const overlapY =
                playerTop > wallBottom &&
                playerBottom < wallTop

            if (overlapY) return true
        }
    }

    return false
}