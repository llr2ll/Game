import * as THREE from 'three'

export function CreateWalls(scene, colliders = []) {

    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x888888 })
    const wallGeometry = new THREE.BoxGeometry(5, 2, 1)

    const wallPositions = [
        { x: 0, y: 1, z: -5 },
        { x: 6, y: 1, z: -5 },
        { x: -6, y: 1, z: -5 },
        { x: 0, y: 1, z: -10 }
    ]

    for (let i = 0; i < wallPositions.length; i++) {

        const pos = wallPositions[i]

        const wall = new THREE.Mesh(wallGeometry, wallMaterial)

        wall.position.set(pos.x, pos.y, pos.z)

        scene.add(wall)

        const wallBox = new THREE.Box3().setFromObject(wall)

        // 👉 mesma lógica, só sem "push solto"
        colliders[colliders.length] = {
            mesh: wall,
            box: wallBox,
            type: 'wall'
        }
    }

    return colliders
}