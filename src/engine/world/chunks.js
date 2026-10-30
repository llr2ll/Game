import { AddColliders, RemoveColliders } from './collision'

const chunks = new Map()
const queue = new Map()
const VIEW_DISTANCE = 3

// O jogo diz como gerar um chunk e o que fazer ao carregar/descarregar (o motor não conhece casas nem postes):
//  size = lado do chunk (m) · generate(cx, cz) → THREE.Group com userData { colliders, dispose, … }
//  onLoad(chunk) / onUnload(chunk) = registrar/tirar o resto (casas, postes…)
let CHUNK_SIZE = 16, GenerateChunk = null, onLoad = () => {}, onUnload = () => {}
export function SetupChunks(o) { CHUNK_SIZE = o.size; GenerateChunk = o.generate; onLoad = o.onLoad || onLoad; onUnload = o.onUnload || onUnload }

const id = (x, z) => `${x},${z}`
// o chunk deste ponto já está carregado (tem colisores e casas)? zumbis só nascem/ficam onde está
export const ChunkLoaded = (x, z) => chunks.has(id(Math.floor((x + 0.5) / CHUNK_SIZE), Math.floor((z + 0.5) / CHUNK_SIZE)))

// positions: lista de {x, z} (todos os jogadores) — carrega o entorno de cada um
// radius = quantos chunks ao redor de cada jogador (menor com a tela dividida: cada tela mostra menos mundo)
let lastKey = ''
export function UpdateChunks(scene, colliders, positions, radius = VIEW_DISTANCE) {
  // só recalcula quando alguém muda de chunk (evita alocar centenas de strings por frame)
  let key = radius + ':'
  for (const p of positions) key += Math.floor((p.x + 0.5) / CHUNK_SIZE) + ',' + Math.floor((p.z + 0.5) / CHUNK_SIZE) + ';'
  if (key === lastKey) return
  lastKey = key
  const active = new Set()
  for (const p of positions) {
    const cx0 = Math.floor((p.x + 0.5) / CHUNK_SIZE), cz0 = Math.floor((p.z + 0.5) / CHUNK_SIZE)
    for (let x = -radius; x <= radius; x++)
      for (let z = -radius; z <= radius; z++) {
        if (x * x + z * z > radius * radius + radius) continue // área redonda: sem os cantos distantes
        const cx = cx0 + x, cz = cz0 + z, k = id(cx, cz)
        active.add(k)
        if (!chunks.has(k) && !queue.has(k)) queue.set(k, { cx, cz })
      }
  }
  for (const k of [...queue.keys()]) if (!active.has(k)) queue.delete(k)
  const dead = []
  for (const [k, chunk] of chunks) if (!active.has(k)) dead.push([k, chunk])
  if (dead.length) Unload(scene, colliders, dead)
}

function Unload(scene, colliders, dead) {
  const gone = new Set()
  for (const [k, chunk] of dead) {
    RemoveColliders(chunk.userData.colliders)
    onUnload(chunk)
    for (const c of chunk.userData.colliders) gone.add(c)
    for (const d of chunk.userData.dispose) d.dispose()
    scene.remove(chunk)
    chunks.delete(k)
  }
  // compacta o array uma vez só (antes era indexOf+splice por colisor: O(n²))
  let w = 0
  for (let i = 0; i < colliders.length; i++) if (!gone.has(colliders[i])) colliders[w++] = colliders[i]
  colliders.length = w
}

export function ProcessChunkQueue(scene, colliders, max = 2) {
  for (let n = 0; n < max && queue.size; n++) {
    const [k, { cx, cz }] = queue.entries().next().value
    queue.delete(k)
    const chunk = GenerateChunk(cx, cz)
    scene.add(chunk)
    colliders.push(...chunk.userData.colliders)
    AddColliders(chunk.userData.colliders)
    onLoad(chunk)
    chunks.set(k, chunk)
  }
}
