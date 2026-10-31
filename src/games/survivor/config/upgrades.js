import { BALANCE } from './balance'

// Melhorias (J7): nome e texto aqui; os números ficam em balance.js · upgrades. Sem `cls` = geral (qualquer classe pode sortear);
// `cls` = só essa classe; `with` = combinação, só sorteia se essa outra classe estiver no grupo.
// O efeito de cada uma está onde a coisa acontece (procure por has(p, 'id')): movimento/vida em levels.js, empurrão e pisão
// em enemies/zombies.js, revistar e desmontar em loot.js, barricadas em barricades.js, levantar em fall.js,
// habilidades das classes em abilities/classes.js.
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
  // 🔫 Atirador
  { id: 'silencer', cls: 'gunner', icon: '🔇', name: 'Silenciador caseiro', text: `A pistola chama zumbis a ${Math.round(BALANCE.gunner.pistolNoise * U.silencer)} m em vez de ${BALANCE.gunner.pistolNoise} m` },
  { id: 'pockets', cls: 'gunner', icon: '🎒', name: 'Bolsos fundos', text: `+${pct(U.pockets.ammo)} de munição na reserva; recarga mais rápida` },
  { id: 'pierce', cls: 'gunner', icon: '🎯', name: 'Bala que atravessa', text: `A carabina atravessa 1 zumbi (${Math.round(U.pierce * 100)}% do dano no segundo)` },
  { id: 'fisher', cls: 'gunner', icon: '🎣', name: 'Granada de pescador', text: `Granada recarrega em ${U.fisher.cd} s; raio +${pct(U.fisher.radius)}` },
  // ⚔️ Samurai
  { id: 'clean', cls: 'samurai', icon: '🗡️', name: 'Corte limpo', text: `O 3º golpe mata zumbis com menos de ${Math.round(U.clean * 100)}% de vida` },
  { id: 'double', cls: 'samurai', icon: '💨', name: 'Investida dupla', text: 'A investida tem 2 cargas' },
  { id: 'cat', cls: 'samurai', icon: '🐈', name: 'Passo de gato', text: 'A katana e a corrida fazem metade do barulho' },
  { id: 'steel', cls: 'samurai', icon: '🌀', name: 'Redemoinho de aço', text: 'O redemoinho dura o dobro e puxa os zumbis para o centro' },
  // 🔮 Mago
  { id: 'chain', cls: 'mage', icon: '⚡', name: 'Dardo em cadeia', text: `O dardo salta para mais ${U.chain.jumps} zumbis` },
  { id: 'rain', cls: 'mage', icon: '☄️', name: 'Chuva de pedras', text: `O meteoro cai em ${U.rain.pieces} pedaços menores numa área maior` },
  { id: 'deep', cls: 'mage', icon: '❄️', name: 'Gelo profundo', text: `A nova de gelo congela por ${U.deep} s em vez de deixar lento` },
  { id: 'burn', cls: 'mage', icon: '🔥', name: 'Queimada', text: `Matar com o meteoro devolve ${U.burn} de mana` },
  // 🪕 Bardo
  { id: 'muineira', cls: 'bard', icon: '💃', name: 'Muiñeira', text: `A balada também acelera ataques e recargas em ${pct(U.muineira)}` },
  { id: 'choir', cls: 'bard', icon: '🎶', name: 'Coro', text: `A canção de cura cura ${pct(U.choir.heal)} a mais e dá ${U.choir.shield} s de proteção` },
  { id: 'loud', cls: 'bard', icon: '📢', name: 'Onda forte', text: `A onda sonora derruba quem está a menos de ${U.loud} m` },
  { id: 'lure', cls: 'bard', icon: '🪤', name: 'Isca', text: `Mirando, a canção de cura toca a ${U.lure} m: atrai os zumbis para lá` },
  // combinações: `with` = a outra classe tem de estar no grupo
  { id: 'shatter', cls: 'samurai', with: 'mage', icon: '🧊⚔️', name: 'Estilhaçar', text: 'Zumbi lento ou congelado pelo gelo do Mago morre com um golpe de katana' },
  { id: 'rhythm', cls: 'gunner', with: 'bard', icon: '🥁', name: 'Ritmo de guerra', text: 'Sob a balada do Bardo, você recarrega na hora e ganha 1 granada extra' },
  { id: 'wheel', cls: 'mage', with: 'bard', icon: '🔥🎵', name: 'Fogo na roda', text: `Zumbi empurrado pela onda do Bardo leva ${U.wheel.damage}x de dano do meteoro` },
  { id: 'cutdown', cls: 'samurai', with: 'gunner', icon: '🔫⚔️', name: 'Derrubar e cortar', text: 'A investida mata na hora todo zumbi caído que ela atravessar' },
]
