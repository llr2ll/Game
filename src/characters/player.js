import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { playerMechanics } from './player-mechanics'
import * as THREE from 'three'

export async function CreatePlayer(scene, colliders) {
    // const loader = new GLTFLoader()
    // const gltf = await loader.loadAsync('/player.glb')
    // const mesh = gltf.scene

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }))
    mesh.position.set(0, 0, 0)
    mesh.scale.set(1, 1, 1)     
    scene.add(mesh)

    return { mesh, move: playerMechanics(mesh, colliders) }
}