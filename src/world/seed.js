import { CreateWalls } from './buildings/walls.js'

let initialized = false

export function Seed(scene, colliders) {
    if (initialized) return
    initialized = true

    CreateWalls(scene, colliders)
}