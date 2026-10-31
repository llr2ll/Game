import { BALANCE } from './balance'

// Melhorias (J7): nome e texto aqui; os números ficam em balance.js · upgrades. Sem `cls` = geral (qualquer classe pode sortear).
// O efeito de cada uma está onde a coisa acontece (procure por has(p, 'id')): movimento/vida em levels.js, empurrão e pisão
// em enemies/zombies.js, revistar e desmontar em loot.js, barricadas em barricades.js, levantar em fall.js.
const U = BALANCE.upgrades
const pct = (k) => `${Math.round((k - 1) * 100)}%`
export const UPGRADES = [
  { id: 'lungs', icon: '🫁', name: 'Pulmão de atleta', text: `+${pct(U.lungs)} de fôlego` },
  { id: 'skin', icon: '🛡️', name: 'Pele dura', text: `+${pct(U.skin)} de vida máxima` },
  { id: 'shove', icon: '✋', name: 'Empurrão forte', text: `O empurrão sempre derruba e afasta até ${U.shove} zumbis` },
  { id: 'boot', icon: '🥾', name: 'Bota pesada', text: 'O pisão mata zumbi caído na hora' },
  { id: 'looter', icon: '🔍', name: 'Saqueador', text: `Revistar é ${U.looter.speed}x mais rápido${U.looter.noise ? '' : ' e não faz barulho'}` },
  { id: 'carpenter', icon: '🔨', name: 'Carpinteiro', text: `Suas barricadas têm +${pct(U.carpenter.hp)} de vida; consertar e desmontar ${U.carpenter.speed}x mais rápido` },
  { id: 'medic', icon: '🩹', name: 'Primeiros socorros', text: `Levantar um aliado caído é ${U.medic}x mais rápido` },
  { id: 'cold', icon: '🧊', name: 'Sangue frio', text: 'Agarrado: o empurrão não gasta fôlego e derruba quem agarrou' },
]
