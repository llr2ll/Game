import { BALANCE } from './balance'

// Armas do Atirador: nome e ordem aqui; os números (dano, cadência, pente…) ficam em balance.js
const NAMES = { pistol: 'Pistola', carbine: 'Carabina', shotgun: 'Espingarda' }
export const WEAPONS = Object.fromEntries(Object.entries(BALANCE.weapons).map(([k, w]) => [k, { name: NAMES[k], ...w }]))
export const WEAPON_ORDER = ['carbine', 'shotgun', 'pistol']
