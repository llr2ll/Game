import * as THREE from 'three'

const materialA = new THREE.MeshBasicMaterial({ color: 0x888888 })
const materialB = new THREE.MeshBasicMaterial({ color: 0x666666 })
const geometry = new THREE.PlaneGeometry(1, 1)
const chunks = new Map()
const VIEW_DISTANCE = 2
const CHUNK_SIZE = 2
const queue = []

function chunkId(x, z) { return `${x},${z}` }

function CreateChunk(scene, cx, cz) {
    const group = new THREE.Group()

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const tile = new THREE.Mesh(geometry, (x + z) % 2 ? materialA : materialB)
            tile.position.set( cx * CHUNK_SIZE + x, 0, cz * CHUNK_SIZE + z)
            tile.rotation.x = -Math.PI / 2
            group.add(tile)
        }
    }

    scene.add(group)
    chunks.set(chunkId(cx, cz), group)
}

function UnloadChunk(scene, cx, cz) {
    const id = chunkId(cx, cz)
    const chunk = chunks.get(id)

    if (!chunk) return

    scene.remove(chunk)
    chunks.delete(id)
}

export function LoadChunk(scene, player) {
    const centerX = Math.floor(player.position.x / CHUNK_SIZE)
    const centerZ = Math.floor(player.position.z / CHUNK_SIZE)
    const active = new Set()

    for ( let x = -VIEW_DISTANCE; x <= VIEW_DISTANCE; x++ ) {

        for ( let z = -VIEW_DISTANCE; z <= VIEW_DISTANCE; z++ ) {

            const cx = centerX + x
            const cz = centerZ + z
            const id = chunkId(cx, cz)

            active.add(id)

            if (!chunks.has(id)) {
                const exists = queue.some(c => c[1] === cx && c[2] === cz)

                if (!exists) { queue.push([scene, cx, cz]) }
            }
        }
    }

    for (const id of chunks.keys()) {
        if (!active.has(id)) {
            const commaIndex = id.indexOf(',')
            
            const x = Number(id.slice(0, commaIndex))
            const z = Number(id.slice(commaIndex + 1))

            UnloadChunk(scene, x, z)
        }
    }
}

export function ProcessChunkQueue() {
    for ( let i = 0; i < 1; i++ ) {
        if ( queue.length === 0 ) return
        const [scene, x, z] = queue.shift()
        CreateChunk(scene, x, z)
    }
}