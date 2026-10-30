# Game — action survivor online (low poly)

A **tela** (PC/TV) roda o jogo. Os **celulares** viram controle: entram numa sala com código de 4 letras.

## Rodar (mesma rede Wi‑Fi)
```bash
npm install
npm run server      # terminal 1: relay (porta 8080)
npm run dev         # terminal 2: jogo (porta 5173)
```
Abra no PC `http://IP-DO-SEU-PC:5173` (não `localhost`, senão o QR code aponta pro lugar errado).
No celular: escaneie o QR code ou abra `/controller.html` e digite o código.
Teste sem celular: WASD + mouse (clique esquerdo ataca, direito só mira), E entra/sai do veículo, Q/F/G habilidades, **V empurra**, 1/2/3 armas, R recarrega.

## Controles do celular
Stick esquerdo = mover (ou dirigir) · stick direito = mirar (ataca enquanto inclinado) · botões da classe (nome e recarga vêm do jogo) · 🚗 aparece perto de um veículo (Entrar/Sair) · Correr · Pular · **Empurrar** (pisca quando um zumbi agarra).

## Zumbis (estilo Project Zomboid)
Sem ondas: a partida é sobrevivência sem fim (o relógio conta o tempo vivo). Tudo em `src/enemies/`:
- `zombies.js` – IA e população. Zumbis vagam devagar e em bando, **enxergam** num cone à frente (16 m de dia, 9 m à noite, paredes bloqueiam) e **ouvem** barulho: tiro (30 m), explosão, carro ligado, música do bardo, corrida. Quem ouve vai até o lugar; quem vê persegue e chama os vizinhos. Perdeu de vista por 6 s → vai até onde viu por último.
- **Agarrão**: no alcance o zumbi dá o bote; pegou → o jogador fica preso (35% da velocidade, 12% com dois ou mais), não corre nem pula, e leva mordidas a cada ~1,3 s. Pular ou a investida do samurai escapam do bote. De carro, o zumbi bate na lataria.
- **Repelir**: *Empurrar* (V / botão) solta do agarrão e afasta até 3 zumbis na frente — eles tropeçam ou caem (sempre caem se empurrados pelas costas; cansado, o empurrão é fraco). Zumbi caído no pé toma **pisão**. Também dá para escapar puxando o stick para longe de quem agarrou. Golpes fortes (3º corte da katana, espingarda de perto, explosão, atropelamento) derrubam; caído leva +30% de dano e demora para levantar.
- **Renascer perto**: a horda é mantida em volta dos jogadores (mais à noite, nos povoados e com o tempo; corredores ficam mais comuns). Zumbi a mais de 52 m de todos (ou em chunk descarregado) renasce num anel de 24–36 m em volta de um jogador, fora da vista. Corpos ficam no chão e afundam.
- `zombie-model.js` – zumbi articulado (12 variações de roupa/pele com sangue e rasgos), mancando, curvado, braços estendidos, bote, mordida, tropeço, queda de costas/de bruços, levantar, comer quem caiu.
- `pathing.js` – desvio de obstáculos, A* quando trava, portas e escadas das casas.
- Quem cai volta em 25 s ao lado de um aliado vivo (a canção do bardo revive na hora). Suprimentos de munição a cada 75 s. Fim de jogo quando todos caem.

## Classes (a vaga define a classe)
| Vaga | Classe | Ataque (stick direito) | Botões |
|---|---|---|---|
| 1 | 🔫 Atirador | carabina / espingarda / pistola | Trocar arma · Recarregar · Granada |
| 2 | ⚔️ Samurai (130 PV) | combo de katana em 3 golpes (o 3º é pesado) | Investida (atravessa cortando, invulnerável) · Redemoinho |
| 3 | 🔮 Mago (85 PV, mana) | dardo mágico que persegue o alvo | Meteoro (área marcada no chão) · Nova de gelo (deixa lentos) |
| 4 | 🪕 Bardo | onda sonora em cone que empurra | Canção de cura (cura e revive quem caiu perto) · Balada da coragem (+dano e +velocidade) |

Tudo em `src/characters/classes.js` (vida, recargas, dano) e `src/fx/effects.js` (anéis, arcos, clarões, fumaça, notas).

## Personagens e animação (estilo Project Zomboid)
- `src/characters/looks.js` – visual de cada classe, uma malha fundida por osso (quadril, tronco, cabeça, coxa, canela, pé, braço, antebraço).
- `src/characters/player.js` – esqueleto articulado com animação procedural: a passada avança pela distância andada (o pé não escorrega), o quadril vira para onde o corpo anda enquanto o tronco segue a mira (anda de lado e de costas mirando), corrida inclinada com braços "bombeando", inclinação na arrancada/freada e nas curvas, passinhos ao girar parado, respiração e olhar em volta parado, pulo, aterrissagem, nado, queda ao morrer, sentado/dirigindo.
- `src/characters/kits.js` – o objeto de cada classe (armas, katana, cajado, alaúde) e suas poses por quadros-chave; as mãos chegam às empunhaduras por IK de dois ossos.
- `src/characters/player-moviment.js` – movimento com peso: o corpo gira com velocidade limitada, mirando anda devagar e não corre, virar de costas correndo freia.

## Veículos (sedã, picape, jipe)
Os carros da estrada são dirigíveis por qualquer um dos 4 jogadores (três já esperam na largada). Cima/W acelera, baixo/S freia e depois dá ré, esquerda/direita (A/D) viram o carro para o lado dele. Sedã: rápido no asfalto, 4 lugares fechados. Picape: resistente, 2 na cabine + 2 em pé na caçamba (atiram de lá). Jipe: aberto, melhor fora da estrada. Passageiros das classes de longo alcance atacam do carro; atropelar machuca e derruba zumbis (carro ligado faz barulho e atrai a horda); batidas e ataques estragam o veículo (fumaça → carcaça queimada). Ajustes em `src/vehicles/models.js` (desempenho, bancos) e `src/vehicles/vehicles.js` (física, entrar/sair).

## Som (procedural, sem arquivos)
Todo som é sintetizado na hora com Web Audio (osciladores, ruído, filtros e cordas dedilhadas Karplus-Strong) — nada para baixar. Sons têm posição: volume, pan e abafado pela distância até o jogador mais perto; parede no meio (dentro/fora de casa) abafa. O áudio liga no primeiro clique/tecla; **M** liga/desliga.
- `src/audio/engine.js` – contexto, barramentos (efeitos, ambiente, interface), compressor, limite de vozes e as primitivas (tom, ruído, estalo, metal, voz com formantes, corda).
- `src/fx/gore.js` – sangue e desmembramento: gotas voam e mancham chão e paredes (as manchas ficam no mapa), poça cresce sob o corpo; tiros arrancam braços (o zumbi continua vindo), o golpe que mata pode arrancar cabeça/braços e, se for forte (espingarda de perto, explosão, atropelamento), as pernas; o pedaço voa, quica, deixa rastro e o toco espirra.
- `src/audio/sfx.js` – efeitos soltos: tiros de cada arma, cápsulas, recarga, troca, granada, explosões; katana, investida, redemoinho; dardo, meteoro, nova de gelo; alaúde, canção de cura, balada; passos por superfície, pulo, nado, dor, morte, empurrão, pisão; gemido/rosnado/bote/mordida/queda dos zumbis; portas das casas e do carro, partida, batida, atropelamento; respingos, trovão, pássaros, grilos, coruja, patos; menu e fim de jogo.
- `src/audio/soundscape.js` – o que soa sem parar: vento com rajadas, chuva, água perto de rios/lagos, zumbido dos postes à noite, motor de cada carro (marchas e carga) e pneu cantando; passos (grama, asfalto, madeira, água, chão molhado), fôlego, coração com pouca vida e zumbis gemendo/arrastando os pés.

## Online de verdade (fora do Wi‑Fi)
1. Hospede `server/server.js` (Render, Fly.io, Railway…). Ele usa a variável `PORT`.
2. Hospede o front (`npm run build` → pasta `dist`) em Vercel/Netlify/Cloudflare Pages.
3. Defina `VITE_WS_URL=wss://seu-servidor.exemplo.com` antes do build.

## Menu inicial (lobby)
Ao abrir o jogo aparece o menu com 4 vagas. Em cada vaga escolha **📱 Celular** (o jogador entra pelo QR code/código) ou **⌨️ Mouse e teclado** (só uma vaga). Quem entra pelo celular já ocupa uma vaga sozinho. **Enter** inicia; **Esc** durante a partida (ou o fim de jogo) volta ao menu.

## Split screen
Jogadores perto (< 13 unidades) dividem uma tela só; ao se afastar (> 19) ela se divide. Layout pelo número de telas: 2 = linha vertical · 3 = duas em cima + uma embaixo · 4 = 2x2. Quem cai assiste pela tela do grupo vivo mais próximo. Ajustes em `src/camera/splitscreen.js` (`MERGE`, `SPLIT`, `GAP`).

## Visual (estilo diorama)
Cores por vértice + malhas fundidas (poucos draw calls), balanço do vento na GPU, sombras de contato falsas (sem shadow map), tone mapping Neutral e desfoque "miniatura" via CSS (tecla **T** liga/desliga). Paleta e luz em `src/world/style.js`, `src/world/assets.js` e `src/camera/light.js`.

## Mundo: estradas, vilas, cidades e casas
- `src/world/layout.js` – rede de estradas (grade de 64 m, vários cruzamentos), tipo de cada nó (vila / cidade / vazio).
- `src/world/town.js` – onde cada casa/decoração nasce (vilas ao longo das estradas, quarteirões nas cidades, casas isoladas à beira da estrada).
- `src/world/town.js` também garante o espaço entre casas: 3,2 m livres entre paredes nas vilas (dá para passar entre elas), jardim de 2,4 m na frente, e um prédio por fileira nos quarteirões da cidade.
- `src/world/buildings.js` – casas no estilo Link's Awakening: telhado grosso de telhas em fileiras recortadas (como as copas), arco de pedra na porta, janelas com floreira, chaminé redonda. Casas de 2 e 3 andares têm os andares de verdade, ligados por escada no fundo (guarda-corpo no vão). Móveis no tamanho do personagem (cama maior que ele, mesa na cintura), posicionados sem bloquear porta, escada e corredor.
- `src/world/city-lots.js` – nada de terreno vazio nas cidades: cada lote que sobra (esquinas de fora, faixas da borda sem loja, sobras ao lado dos prédios e o anel entre o fim das ruas e a borda da cidade) vira estacionamento (vagas pintadas, batentes, placa P e carros dirigíveis estacionados), jardim (grama, cerca viva, árvores, flores, bancos, placa com o nome), praça com chafariz, terraço de café, banca de jornal, ponto de ônibus (abrigo + placa) ou um prédio de periferia virado para a avenida (`city_corner`). Calçadas ganham lixeiras e hidrantes. Os lotes são planejados em `town.js` (`CityLots`); peças em `src/world/assets-city.js`. Toda peça passa por um teste de ocupação, então nada nasce em cima de nada.
- `src/world/buildings-registry.js` – cada tela mostra o recorte do andar de quem está nela (telhado e andares de cima somem); casa que esconde um jogador também vira recorte. Portas abrem sozinhas quando jogador ou zumbi chega perto (fechadas bloqueiam passagem e tiro). `FloorAt` dá a altura do piso/escada; `ChaseTarget` leva os zumbis pela porta e pelas escadas até o andar do jogador.

## Estradas: finais, desgaste, poças e sinalização
- `src/world/endings.js` – finais de estrada (obra com escavadeira, rotatória-praça com bancos, mato, mini-praça); cidades vizinhas ligam suas ruas (ver `RoadRects` em `layout.js`).
- `src/world/roadwear.js` – rachaduras, remendos, marcas de pneu, óleo, bueiros e poças refletivas (decalques planos fundidos por chunk).
- `src/world/reflections.js` – céu procedural filtrado uma vez (PMREM); só as poças usam esse reflexo.
- `src/world/signs.js` / `signage.js` / `sign-atlas.js` / `names.js` – placas de rua, PARE, semáforos, faixas de pedestre, entrada de povoado, painéis de direção e marcos de km (textos desenhados num único atlas).
