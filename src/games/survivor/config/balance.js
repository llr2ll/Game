// =====================================================================================
//  BALANÇO DO SURVIVOR — todos os números para ajustar a jogabilidade ficam aqui.
//  Mude um número e salve: com `npm run dev` rodando, o jogo recarrega sozinho.
//  Unidades: distância em metros (m), tempo em segundos (s), velocidade em m/s, dano em pontos de vida.
//  Para comparar: um zumbi normal tem 7 a 9,5 de vida; um jogador tem de 85 a 130.
//  "Empurrão" (knock) = quanto o golpe joga o zumbi para trás. "Barulho" = raio (m) em que os zumbis ouvem e vêm ver.
//  Não está aqui de propósito: câmera e tela dividida, carros (shared/vehicles/models.js), aparência e animação, o mundo.
//  Depois de mudar um número, o `npm run check` vai avisar que o replay mudou: é esperado (npm run check -- --update-sim).
// =====================================================================================
export const BALANCE = {
  // ---------------------------------------------------------------- relógio
  day: {
    seconds: 600, // duração de um dia inteiro (dia + noite) em segundos reais. 600 = 10 min; maior = noites e dias mais longos
    nightFrom: 0.78, // fração do dia em que a noite dos zumbis começa (0,78 ≈ 18h43): enxergam menos e vêm mais
    nightTo: 0.24, // fração do dia em que essa noite termina (0,24 ≈ 5h46)
  },

  // ---------------------------------------------------------------- jogadores (todas as classes)
  player: {
    walk: 4.4, // velocidade andando
    run: 7.6, // velocidade correndo (gasta fôlego)
    aim: 3.1, // velocidade andando enquanto mira/ataca (não dá para correr mirando)
    swim: 3.1, // velocidade nadando
    staminaRun: 28, // fôlego gasto por segundo correndo (fôlego vai de 0 a 100)
    staminaSwim: 9, // fôlego gasto por segundo nadando (zerou = afoga)
    staminaRegen: 18, // fôlego recuperado por segundo sem correr
    tiredUntil: 30, // depois de zerar o fôlego, só volta a correr quando recuperar até aqui
    heldSlow: [0.35, 0.12], // velocidade quando agarrado por 1 zumbi / por 2 ou mais (fração da normal)
    jump: 9, // força do pulo (9 ≈ 1,7 m de altura: passa por cerca e tronco)
    jumpWater: 7.5, // força do pulo saindo da água (para subir no píer ou na margem)
    drown: 8, // dano por segundo afogando (sem fôlego na água funda)
    shoveCooldown: 0.55, // tempo entre empurrões
    shoveStamina: 9, // fôlego gasto por empurrão (cansado, o empurrão fica fraco)
    shoveNoise: 5, // barulho do empurrão
  },

  // ---------------------------------------------------------------- classes: vida, velocidade e recarga dos botões
  // cd = recarga de cada botão em segundos (na ordem dos botões do celular; 0 = sem recarga)
  classes: {
    gunner: { hp: 100, speed: 1, cd: [0, 0, 7] }, // Atirador: Trocar arma · Recarregar · Granada
    samurai: { hp: 130, speed: 1.08, cd: [3.5, 7] }, // Samurai: Investida · Redemoinho (speed = multiplicador da velocidade)
    mage: { hp: 85, speed: 0.97, cd: [6, 9] }, // Mago: Meteoro · Nova de gelo
    bard: { hp: 100, speed: 1.02, cd: [12, 15] }, // Bardo: Canção de cura · Balada da coragem
  },

  // ---------------------------------------------------------------- armas do Atirador
  // dmg = dano por bala · rate = segundos entre tiros (menor = mais rápido) · mag = balas no pente · reserve = munição inicial
  // reload = segundos para recarregar · spread = desvio da mira (maior = menos preciso) · range = alcance
  weapons: {
    pistol: { dmg: 2.2, rate: 0.3, mag: 12, reserve: Infinity, reload: 1.0, spread: 0.02, range: 24 }, // munição infinita
    carbine: { dmg: 1.3, rate: 0.11, mag: 30, reserve: 90, reload: 1.9, spread: 0.05, range: 32 },
    shotgun: { dmg: 1.3, rate: 0.72, mag: 6, reserve: 30, reload: 2.1, spread: 0.2, range: 15, pellets: 7, knock: 2.5 }, // pellets = chumbos por tiro
  },
  gunner: {
    shotNoise: 30, // barulho do tiro de carabina e espingarda
    pistolNoise: 22, // barulho do tiro de pistola
    grenade: { distance: 9, flight: 0.8, radius: 3.6, damage: 9, knock: 11 }, // distância do arremesso · segundos no ar · raio · dano · empurrão
  },
  explosionNoise: 38, // barulho de qualquer explosão (granada e meteoro)

  samurai: {
    combo: {
      damage: [2.8, 2.8, 4.8], // dano do 1º, 2º e 3º golpe
      knock: [4, 4, 10], // empurrão de cada golpe (o 3º derruba)
      time: [0.38, 0.38, 0.52], // duração de cada golpe (menor = ataca mais rápido)
      range: 2.7, // alcance da katana
      angle: [1.15, 1.15, 0.6], // abertura do corte (radianos para cada lado; 1,15 ≈ 66°)
      window: 0.8, // segundos para emendar o próximo golpe do combo
      noise: 7, // barulho de cada golpe
    },
    dash: { speed: 30, time: 0.22, invulnerable: 0.35, damage: 5, knock: 6, reach: 1.3 }, // investida: velocidade · duração · invulnerável · dano · empurrão · largura do corte
    spin: { radius: 3.2, damage: 2.8, knock: 8 }, // redemoinho (acerta 2 vezes)
  },

  mage: {
    mana: 100, // mana máxima
    manaRegen: 15, // mana recuperada por segundo
    manaRegenAttacking: 0.4, // fração da recuperação enquanto ataca
    bolt: { mana: 7, cooldown: 0.3, damage: 2.7, knock: 4, speed: 19, life: 1.5, seek: 14, turn: 3, noise: 9 }, // dardo: custo · intervalo · dano · empurrão · velocidade · duração · alcance da mira automática · curva · barulho
    meteor: { mana: 25, distance: 8.5, fall: 1.05, radius: 3.9, damage: 11, knock: 12 }, // custo · distância do alvo · segundos caindo · raio · dano · empurrão (o círculo no chão é só desenho)
    nova: { mana: 20, radius: 5.5, damage: 2, knock: 5, slowTime: 4 }, // nova de gelo: custo · raio · dano · empurrão · segundos de lentidão
  },

  bard: {
    wave: { cooldown: 0.55, range: 6.5, angle: 0.55, damage: 2.1, knock: 8, noise: 12 }, // onda sonora: intervalo · alcance · abertura · dano · empurrão · barulho
    song: { radius: 9, heal: 40, reviveRadius: 5.5, reviveHp: 0.35, noise: 18 }, // canção de cura: raio · cura · raio para reviver · vida ao reviver (fração) · barulho
    courage: { radius: 9, time: 8, damage: 1.35, speed: 1.25, noise: 18 }, // balada: raio · segundos · multiplicador de dano · multiplicador de velocidade · barulho
  },

  // ---------------------------------------------------------------- zumbis
  zombies: {
    max: 55, // máximo ao mesmo tempo (mais = mais pesado para o PC)
    population: { base: 18, perPlayer: 7, growEvery: 45, growBy: 2, night: 1.3, town: 1.25 }, // quantos querem estar por perto: 18 + 7 por jogador a mais + 2 a cada 45 s; x1,3 à noite; x1,25 em vila/cidade
    spawn: { min: 24, max: 36, far: 52 }, // renascem num anel de 24–36 m em volta de alguém; quem passa de 52 m de todos renasce
    sight: { day: 16, night: 9, fov: 1.2, feel: 3.2, lose: 6 }, // visão de dia · de noite · abertura do cone (rad para cada lado) · sente por perto sem ver · segundos até desistir
    hearing: { car: 18, run: 8, walk: 3 }, // barulho que o jogador faz: carro andando · correndo · andando
    speed: { wander: 0.6, investigate: 1.2 }, // velocidade vagando · indo ver um barulho (perseguindo: ver normal/runner)
    normal: { hp: [7, 9.5], speed: [1.6, 2.15], score: 10 }, // zumbi normal: vida (mín–máx) · velocidade perseguindo · pontos
    runner: { hp: [4.5, 5.5], speed: [3.0, 3.5], score: 15, chance: 0.08, rampSeconds: 1200, chanceMax: 0.3 }, // corredor; chance de nascer corredor sobe 100% a cada 1200 s (≈ +5%/min) até 30%
    attack: { reach: 0.95, hold: 0.68, lunge: 0.42, scratch: 3, bite: [6, 9], biteEvery: [1.1, 1.6], firstBite: [0.7, 1.0], car: 5 }, // alcance do bote · distância segurando · duração do bote · arranhão · mordida (mín–máx) · intervalo · 1ª mordida · dano batendo no carro
    bash: { every: [0.9, 1.3], damage: 2 }, // zumbi encostado numa barricada: uma pancada a cada 0,9–1,3 s · dano por pancada
    downDamage: 1.3, // zumbi caído leva mais dano (x1,3)
    iceSlow: 0.4, // velocidade do zumbi gelado (fração)
    corpseTime: 14, // segundos até o corpo sumir
    maxCorpses: 20, // corpos no chão ao mesmo tempo
  },

  // ---------------------------------------------------------------- regras da partida
  rules: {
    revive: { time: 25, hp: 0.5, invulnerable: 2 }, // quem cai volta em 25 s · com metade da vida · 2 s invulnerável
    ammoCap: { carbine: 180, shotgun: 48 }, // munição máxima na reserva do Atirador (munição só vem do saque)
    resultTime: 12, // segundos mostrando o resultado (vitória/derrota) antes de voltar ao menu
    vehicle: { carDamage: 0.9, playerDamage: 0.35 }, // dentro do carro: o carro leva 90% do dano e o jogador só 35%
  },

  // ---------------------------------------------------------------- saque nas casas
  // Móveis com gaveta (cômoda, baú, guarda-roupa, estante, fogão, balcão, caixotes…) podem ser revistados uma vez e depois desmontados.
  // Mesa, cama e sofá só podem ser desmontados. O que foi revistado/desmontado não volta.
  loot: {
    glow: 4, // móveis com algo a fazer brilham quando alguém chega a até 4 m (no mesmo andar)
    reach: 1.2, // distância para conseguir usar o móvel
    search: { time: 1.5, noise: 5 }, // revistar: segundos parado · barulho (no começo e a cada segundo)
    dismantle: { time: 3, noise: 12, planks: [1, 2] }, // desmontar: segundos parado · barulho de martelo (a cada segundo) · tábuas (mín–máx)
    chance: 0.5, // chance de um móvel revistado ter alguma coisa
    rooms: { // o que sai, conforme o cômodo (pesos: maior = mais comum; 0 = nunca)
      terreo: { tabuas: 35, remedio: 25, municao: 25, gasolina: 10, raro: 5 }, // cozinha e sala
      quarto: { tabuas: 15, remedio: 35, municao: 35, gasolina: 0, raro: 15 }, // andar de cima
      sotao: { tabuas: 40, remedio: 5, municao: 10, gasolina: 20, raro: 25 }, // sótão das casas de 3 andares
      loja: { tabuas: 30, remedio: 30, municao: 30, gasolina: 5, raro: 5 }, // lojas
    },
    planks: [1, 2], // tábuas por achado (mín–máx)
    ammo: { carbine: 20, shotgun: 6 }, // munição achada vai direto para cada Atirador do grupo (até rules.ammoCap); sem Atirador, fica guardada
  },

  // ---------------------------------------------------------------- barricadas (porta das casas, por dentro)
  // Só seguram zumbis: gente e tiro passam pela fresta. Tábuas saem do estoque do grupo.
  barricade: {
    hp: 40, // vida da barricada (reforçada: o dobro). Um zumbi sozinho quebra em ~25 s
    build: { planks: 2, time: 2.5 }, // pregar: tábuas · segundos parado
    repair: { planks: 1, time: 1.5, hp: 20 }, // consertar: tábuas · segundos · vida devolvida
    reinforce: { planks: 2, time: 2.5 }, // reforçar (com a vida cheia): tábuas · segundos; a vida máxima dobra
    noise: 12, // barulho do martelo (a cada segundo)
    reach: 1.8, // distância da porta para usar (de dentro da casa)
  },

  // ---------------------------------------------------------------- janelas do térreo (entradas de zumbi)
  // Zumbi atrás de alguém dentro de uma casa usa a janela se ela estiver mais perto que a porta: bate na barricada (se houver),
  // quebra o vidro e pula para dentro. Janela aceita barricada como a porta (mesmos custos e vida de barricade).
  window: {
    glass: 4, // vida do vidro (com a pancada de zombies.bash, ~2 pancadas)
    climb: 1.5, // segundos que o zumbi leva para pular para dentro (dá tempo de acertar)
    reach: 1.4, // distância da janela, por dentro, para barricar
    prefer: 1, // o zumbi só troca a porta pela janela se ela estiver pelo menos 1 m mais perto
  },
  radio: { reach: 1.2 }, // distância para pegar o rádio de volta (o rádio marca a casa-base)

  // ---------------------------------------------------------------- cerco (a partida)
  // Começa ao meio-dia. À noite, o diretor manda a horda contra a base (casa do rádio) em picos. Sem rádio, a horda vai atrás de vocês.
  // Vitória no amanhecer depois de `nights` noites; derrota se todos caírem ao mesmo tempo. Horas em fração do dia (0,5 = meio-dia).
  siege: {
    nights: 2, // noites para aguentar até o resgate (o exército chega no amanhecer seguinte)
    start: 0.5, // hora em que a partida começa (0,5 = meio-dia)
    warn: 0.083, // o rádio avisa esse tanto antes de escurecer (0,083 ≈ 2 horas do jogo ≈ 50 s reais)
    pulses: [{ from: 0.875, to: 0.958 }, { from: 0.083, to: 0.167 }], // picos da noite: 21h–23h e 2h–4h
    pulseSize: 12, // zumbis a mais durante um pico da 1ª noite
    perNight: [1, 1.6], // multiplicador do pico em cada noite (a 2ª é mais forte)
    share: 0.75, // fração dos zumbis que nasce em volta da base durante o pico (o resto, em volta de vocês)
    ring: [40, 50], // distância da base onde a horda do cerco nasce (fora da vista)
  },

  // ---------------------------------------------------------------- sensação ("juice"): só aparência, a não ser a pausa
  juice: {
    // tremor de tela: quanto a câmera balança (metros) em cada caso; scale 0 desliga todos. Só treme a tela de quem está perto (radius)
    shake: { scale: 1, explosion: 0.45, crash: 0.4, runover: 0.18, shotgun: 0.1, heavyHit: 0.12, stomp: 0.1, time: 0.3, radius: 25 },
    // pausa no impacto: o jogo quase para por alguns segundos (0,04 = 40 ms) nos golpes fortes; 0 desliga. Vale para todos ao mesmo tempo
    hitStop: { heavyHit: 0.04, stomp: 0.04, runover: 0.04 },
    hitFlash: 0.08, // segundos que o zumbi fica branco ao levar golpe
    noiseRing: { min: 7, every: 0.6, time: 0.7, alpha: 0.28, color: 0xfff1c8 }, // anel de barulho: só a partir de 7 m (99 desliga) · no máx. 1 por lugar a cada 0,6 s · duração · opacidade · cor
    muzzleGlow: { radius: 3.2, time: 0.07, alpha: 0.5, color: 0xffd58a }, // clarão do tiro no chão, só à noite: raio · duração · força · cor
  },
}
