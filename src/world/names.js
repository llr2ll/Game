import { hash } from './noise'
import { NodeType, NodeArms, ARMS, GRID, NodeX, NodeZ } from './layout'

// Nomes (cidades, ruas, estradas) determinísticos: mesmo mundo => mesmos nomes em qualquer chunk.
const PRE = ['Vila', 'Castro', 'Pena', 'Ponte', 'Cova', 'Mon', 'Lama', 'Val', 'Outeiro', 'Pedra', 'Carballo', 'Fonte', 'Rio', 'Monte']
const SUF = ['nova', 'seca', 'alba', 'velle', 'gorda', 'longa', 'cedo', 'verde', 'mar', 'chá', 'lonxe', 'real', 'escura']
const SAINT = ['San Xoán de ', 'Santa Mariña de ', 'Santiago de ', 'San Martiño de ']
const PLACE = ['Cerdeira', 'Lamas', 'Rois', 'Vilar', 'Ribas', 'Moreira', 'Pazos', 'Areas', 'Figueiras']
const ART = ['A ', 'O ']
const THING = ['Pobra', 'Carballiño', 'Estrada', 'Pontenova', 'Rúa', 'Cañiza', 'Barca']
const pick = (a, h) => a[Math.floor(h * a.length) % a.length]

const nameCache = new Map()
export function NodeName(i, j) {
  const k = `${i},${j}`
  if (nameCache.has(k)) return nameCache.get(k)
  const h = hash(i, j, 501), h2 = hash(i, j, 502), h3 = hash(i, j, 503)
  let n
  if (h < 0.5) n = pick(PRE, h2) + pick(SUF, h3)
  else if (h < 0.75) n = pick(SAINT, h2) + pick(PLACE, h3)
  else n = pick(ART, h2) + pick(THING, h3)
  nameCache.set(k, n)
  return n
}
export const RoadCode = (axis, idx) => axis === 'v' ? (idx === 0 ? 'N-550' : `N-${520 + ((idx * 37) % 80 + 80) % 80}`) : `AG-${10 + ((idx * 53) % 70 + 70) % 70}`

const ST = ['Rúa Nova', 'Rúa do Castro', 'Rúa da Ponte', 'Rúa Real', 'Rúa do Carme', 'Praza Maior', 'Rúa do Franco', 'Rúa da Fonte', 'Rúa do Pazo', 'Rúa da Estación', 'Rúa Ancha', 'Rúa do Medio', 'Rúa Nai', 'Camiño Vello']
// nome da rua local (cidade i,j; eixo; lado -1/1) ou da avenida principal (side 0)
export function StreetName(i, j, axis, side) {
  if (side === 0) return axis === 'v' ? 'Avenida da Constitución' : 'Avenida de Galicia'
  return pick(ST, hash(i * 3 + side, j * 2 + (axis === 'v' ? 1 : 0), 504))
}

// seguindo o braço k do nó (i,j) por trechos existentes, qual o primeiro povoado e a quantos km (2 km por trecho)?
export function Destination(i, j, k) {
  let ci = i, cj = j
  for (let step = 1; step <= 7; step++) {
    const [dx, dz] = ARMS[k]
    if (!NodeArms(ci, cj)[k]) return null
    ci += dx; cj += dz
    if (NodeType(ci, cj)) return { name: NodeName(ci, cj), km: step * 2, i: ci, j: cj }
    // continua em frente só se a estrada segue
  }
  return null
}
