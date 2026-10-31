# CLAUDE.md — memória do projeto

Leia este arquivo inteiro antes de mexer em qualquer coisa. **Atualize-o em todo PR** (mapa de pastas, fatos, histórico).

## O jogo
Survivor de zumbis cooperativo, até 4 jogadores, no navegador. O PC/TV roda tudo; celulares viram controle (estilo Jackbox).
JavaScript (ES Modules) + Three.js 0.184 + Vite. Tudo procedural: nenhum arquivo de modelo 3D nem de som.
O `README.md` descreve cada sistema em detalhe. Para o dono, a explicação leiga está em `docs/COMO-FUNCIONA.md`.

## Quem é o dono e como falar com ele
- Não lê código. Todo o código foi escrito por IA. Ele testa jogando.
- Português do Brasil, frases curtas, sem jargão. Termo técnico → explique em uma frase.
- Testa no GitHub Codespaces: `npm run server` (relay, porta 8080) + `npm run dev` (Vite, porta 5173), celulares como controle.
- **Antes de qualquer etapa que altere arquivos**: diga em até 5 linhas o que vai mudar e espere o "ok".
- Toda mudança chega como pull request em `llr2ll/Game`. **Nunca** faça push direto na `main`.
- Na dúvida entre abordagens: pergunte com opções e marque sua recomendação.

## Como rodar
```bash
npm install
npm run server   # terminal 1: relay WebSocket (porta 8080; muda com PORT=...)
npm run dev      # terminal 2: jogo (porta 5173)
npm run build    # gera dist/ (para hospedar)
```
Endereço do relay no navegador: `VITE_WS_URL` se existir; senão `ws(s)://<mesmo host>:8080` (`src/engine/net/host.js`, `src/engine/input/phone.js`).

## Como testar
- `npm run check` — ~25 s, sem navegador. Rodar SEMPRE antes de abrir PR. Quatro verificações:
  1. **Camadas:** imports só descem (`games/<jogo>` → `shared` → `engine`); um jogo não importa outro; import para arquivo inexistente falha.
  2. **Mundo:** gera 515 chunks + nomes sem desenhar (via Vite) e compara o hash com `scripts/world-fingerprint.txt`.
     Se o mundo mudar sem querer, falha. Mudança de propósito (precisa de OK do dono): `npm run check -- --update-world`.
  3. **Caches:** gera um trecho de novo com os limites dos caches encolhidos (x0, x0,004, x0,02), esquecendo antes de cada chunk;
     tem de dar igual. Pega cache que guarda estado ou caches ligados esquecidos separados (testado: acusa o erro).
  4. **Jogo (replay):** `scripts/sim.mjs` joga 100 s com 4 jogadores (uma classe cada) com sorteio e relógio fixos e compara o hash com
     `scripts/sim-fingerprint.txt` (o relógio do dia anda das 16h48 até as 4h48; quadro 600: o 4º jogador revista e desmonta um móvel; quadro 761: põe o rádio; quadro 1000: o 3º jogador cai e o 2º levanta; quadro 1300: o 1º cai sem ajuda e fica fora; quem sobe de nível escolhe uma carta; quadro 1700, à noite: barrica e reforça uma porta; à noite o cerco manda zumbis para a base). **PR de organização tem de dar igual.** PR que muda a jogabilidade de propósito: `npm run check -- --update-sim`
     e dizer isso na descrição. Detalhes que importam: roda em processo novo; só sorteios feitos por código de `src/` entram na sequência fixa
     (o Vite e o Three.js também sorteiam, e isso mudaria com a ordem dos arquivos). `SIM_TRACE=arquivo node scripts/sim.mjs` grava o rastro
     quadro a quadro para achar onde dois replays se separam.
- `npm run smoke` — teste automático (~3 min). Compila o jogo, sobe relay **8099** e página **5199** (não briga com o dev/server do dono),
  abre no Chromium sem tela, entra 1 teclado (Atirador; aperta D e A no menu) + 1 celular simulado (troca para Bardo com ▶ ▶), confere as classes, joga 60 s (anda, atira, habilidades, carro, noite),
  aperta Esc e confere a volta ao menu. **Falha se aparecer qualquer `console.error` ou erro de página.** Capturas e log em `smoke/` (versionados: o PR mostra as capturas).
  Script: `scripts/smoke.mjs`. Sem GPU o jogo roda a 1–2 FPS → 60 s reais ≈ 6 s de jogo. Pega erro de carregar/iniciar/botões, não bugs de longo prazo.
- `docs/TESTE-MANUAL.md` — checklist de 5 min que o dono roda depois de cada PR (inclui anotar FPS). Peça para ele rodar.
- FPS real só vale na máquina do dono. Nunca tire conclusão de desempenho pelo smoke.

## Mapa de pastas (hoje)
Regra: **imports só descem** — `src/games/<jogo>` → `src/shared` → `src/engine` (verificado por `npm run check`).
`engine` não sabe que existem zumbis nem classes. `shared` = peças prontas que os 3 jogos podem usar. `games/survivor` = regras deste jogo.
```
index.html, main.css      página do jogo (tela) + HUD → carrega src/games/survivor/main.js
controller.html           página do celular (controle) → carrega src/engine/input/phone.js
server/server.js          relay WebSocket: cria sala (4 letras) e só repassa mensagens tela ↔ celulares
scripts/                  smoke.mjs (teste no navegador sem tela), check.mjs (camadas, mundo, caches, replay), sim.mjs (replay), *-fingerprint.txt
smoke/                    capturas + log do último npm run smoke
docs/                     COMO-FUNCIONA (leigo), TESTE-MANUAL (checklist), GAME-DESIGN (direção criativa)
src/engine/               genérico
  core/                   events.js (avisos entre partes), loop.js (laço de desenho com THREE.Timer, dt ≤ 0,05),
                          memo.js (cache com limite para o mundo infinito)
  render/                 splitscreen.js (junta <13 m, separa >19 m; shake = tremor só nas telas perto), light.js, style.js (paleta, materiais, vento),
                          entity-shadows.js (sombras falsas), follow.js (contador de FPS)
  input/                  contract.js (contrato de input), keyboard.js (teclado+mouse), phone.js (código do celular)
  net/host.js             conexão da tela com o relay
  audio/engine.js         Web Audio: barramentos, primitivas, som posicional
  world/                  noise.js (hash/ruído), collision.js (grade de colisão), chunks.js (carrega/descarrega chunks),
                          pathing.js (desvio, A*, rota dentro de casas) — chunks.js é instância (CreateChunks)
  ui/lobby.js             menu de 4 vagas (celular ou teclado); cada vaga escolhe uma opção com ◀ ▶ (choices vêm do jogo)
src/shared/               peças prontas
  characters/             player.js (esqueleto/animação), looks.js (visual), kits.js (armas + IK), player-movement.js
  creatures/zombie-model.js  humanoide articulado (12 variações), base dos zumbis
  worldgen/               mundo: layout.js (estradas), town.js, city-lots.js, buildings.js, buildings-registry.js (portas, andares),
                          generator.js (monta um chunk), map.js (descritor do chunk), climate.js, signs*.js, names.js, water*.js,
                          sidewalk.js (altura do chão), terrain.js, roadwear.js, props.js, poles.js, streetlights.js, assets*.js …
  vehicles/               models.js (sedã, picape, jipe), vehicles.js (física, entrar/sair, atropelar)
  fx/                     effects.js, gore.js, water-fx.js (ondas e respingos)
  audio/                  sfx.js (efeitos soltos), soundscape.js (som contínuo)
src/games/survivor/       este jogo
  main.js                 liga tudo: renderer, clima, lobby, rede, teclado, loop; Wire() conecta motor ↔ mundo ↔ sons
  config/balance.js       TODOS os números ajustáveis (classes, armas, habilidades, zumbis, regras, dia), comentados em português
  config/weapons.js       nomes e ordem das armas (números vêm do balance.js)
  config/upgrades.js      nomes e textos das melhorias (J7; números no balance.js · upgrades)
  rules/survival.js       REGRAS: jogadores (classe escolhida + anel da cor da vaga), dano, morte, vitória/derrota + resultado
  abilities/classes.js    as 4 classes e suas habilidades
  loot.js                 saque (J3): revistar/desmontar móveis, estoque do grupo, marcadores
  barricades.js           entradas: portas (J4) e janelas do térreo (J5a) — barricar/consertar/reforçar por dentro; zumbi bate até quebrar,
                          quebra o vidro e pula a janela; barrinha de vida
  base.js                 rádio (J5a): a casa onde ele está é a base (o cerco vai atrás dela)
  levels.js               XP e níveis (J7a): ganhar XP, subir de nível (luz, som, invulnerável), sortear/escolher cartas; has(p, id)
  fall.js                 queda (J6): 40 s no chão, levantar (aliado 3 s / remédio / solo sozinho), fora até o amanhecer
  siege.js                cerco (J5b): conta as noites, avisos do rádio, picos da horda, vitória no amanhecer do 3º dia
  tasks.js                "parado fazendo algo" (revistar, desmontar, barricar): cancelamento, barulho por segundo, anel de progresso
  bots.js                 ?bots=1..3: jogadores do computador SÓ PARA TESTE (contrato do celular; tecla B espalha/junta)
  enemies/zombies.js      IA da horda: visão, audição, agarrão, renascer
  ui/hud.js               placar da partida
```

**Como as camadas conversam sem import subindo** (ligado em `games/survivor/main.js`):
- Avisos (`engine/core/events.js`): o mundo emite `door-open`, `door-close`, `thunder`, `splash`, `vehicle-spot`; o jogo decide o som/carro.
- Funções passadas ao motor: `CreateChunks({ scene, colliders, size, generate, onLoad, onUnload, afterUnload })`, `SetDeepTest` (água funda),
  `SetIndoorRoute` (zumbi pela porta/escada), `SetIndoorTest` (parede abafa som). Lobby recebe `choices`, `sound`, `subtitle`. Teclado, as teclas extras.
  As regras recebem `hooks` do `main.js`: `night`, `loaded`, `shake`, `clock`/`setClock` (hora do dia do clima, 0..1; `climate.time` aceita escrita).
- `shared` pode importar `shared` (ex.: `creatures/zombie-model` usa `SoleDepth` de `characters/player`; `fx/gore` usa `worldgen`).

**Estado e memória (F2)** — o que é instância e o que continua único:
- Instâncias criadas no `main.js`: `chunks = CreateChunks(…)` (com `reset()`), postes carregados dentro de `CreateStreetLights` (`add/remove/reset`),
  vagas de carro dentro de `CreateVehicles` (`register`; vaga nunca usada a mais de 120 m é esquecida; as 3 da largada nunca).
  A horda recebe `loaded(x, z)` pelo `ctx` (antes importava `ChunkLoaded`).
- Continuam únicos por módulo, com reset: grade de colisão (`ResetColliders`), registro de casas (`ResetBuildings`), atlas de placas (`ResetSignAtlas`),
  canal de avisos e ganchos `Set…`. Motivo: virar instância exigiria passar um parâmetro novo por ~7 módulos (movimento, carros, horda, habilidades,
  gore, som, regras) sem ganho hoje — só um jogo roda por vez. Fazer só se um dia precisar de dois mundos ao mesmo tempo.
- Recomeçar em outro lugar do mapa (ex.: Paróquia em outra vila), nesta ordem: `game.clear()` → `chunks.reset()` → `ResetColliders()`,
  `ResetBuildings()`, `ResetSignAtlas()`, `streetLights.reset()`. Hoje ninguém chama: o mundo continua entre partidas.
- Caches do mundo: 15 caches de funções puras usam `LimitedCache(limite)` (`engine/core/memo.js`), limite ≈ 10× o que a área carregada usa.
  `TrimCaches()` roda quando chunks são descarregados e esquece os mais antigos. Caches ligados esquecem juntos (`onEvict`; ex.: vila → lotes em `town.js`).
  Caches por tipo/variante (geometria de casas, móveis, materiais, cores) têm tamanho fixo e continuam `Map` comum.
  Cache novo do mundo, guardado por posição? Use `LimitedCache` e não guarde estado nele (o `npm run check` testa).

**Números do jogo (F3):** todo número de jogabilidade fica em `src/games/survivor/config/balance.js` (o dono ajusta o jogo só ali).
Peças de `shared` recebem os números como parâmetro, com padrão igual ao de antes: `UpdatePlayerMovement(p, dt, colliders, tune)`
(`DEFAULT_MOVE`), `CreateClimate(scene, light, { daySeconds })`. Número novo de jogabilidade? Vai para o `balance.js` com comentário.
Fora do balance de propósito: câmera/split screen, carros (`shared/vehicles/models.js`), animação, mundo e detalhes finos da IA
(tempo caído, tropeço, quantos o empurrão afasta) — candidatos se o dono pedir.

## Contrato de input (proteger)
Teclado e celular usam exatamente o mesmo formato. Não mude sem pedir.
- `game.setInput(id, { mx, mz, ax, az, run, fire })` — mover (-1..1), mirar (-1..1; mirar inclinado = ataca), correr 0/1, `fire` só no mouse.
- `game.act(id, ação)` — `b1` `b2` `b3` (botões da classe) · `shove` · `use` (carro) · `jump` · `reload` · `swap` · `carbine` `shotgun` `pistol` · `up1` `up2` `up3` (carta).
  Teclado: com cartas na tela, 1/2/3 escolhem a carta (tradução no `main.js`); sem cartas, trocam a arma.
- Celular → relay: `{t:'join', code, name}`, `{t:'in', mx, mz, ax, az, run}` a cada 33 ms, `{t:'act', a}`.
- Tela → celular: `{t:'state', hp, max, cls, w, btn, car, dead, st, time, score, held, rv, u, inv, up}` a cada 0,15 s; `hit`, `lobby`, `kick`, `closed`.
  `up` = cartas para escolher (`[[título, texto], …]`, ou 0); tocar numa manda `{t:'act', a:'up1'|'up2'|'up3'}`. `cls` traz o nível ("🔫 Atirador · Nv 2").
  `u` = texto do botão Usar (🤝 Levantar/🩹 Levantar já/💪 Levantar sozinho · 🪵 Barricar/🔨 Consertar/🪵 Reforçar · 🔍 Revistar/🪚 Desmontar);
  `inv` = estoque do grupo; `rv` = segundos que o caído ainda espera ajuda (-1 = fora até o amanhecer).
  `use`: aliado caído → barricada (se há tábuas) → móvel → rádio (pôr/pegar) → aviso "precisa de tábuas" → carro. Caído: só `use` (solo).
- No menu: celular manda `{t:'act', a:'prev'|'next'}` para trocar a classe (o `main.js` manda para `lobby.pick` só na fase de menu);
  a tela manda `{t:'lobby', slot, total, pick}` (pick = texto da classe escolhida). `game.addPlayer(id, nome, vaga, classe)`.
- Jogador do teclado tem id `'local'`. Bots de teste têm id `bot1`…`bot3` e usam o mesmo contrato (`games/survivor/bots.js`).

## Decisões tomadas (não reabra sem perguntar ao dono)
- Multiplayer local e online. Online, por enquanto = modelo Jackbox: amigos remotos assistem pela transmissão (Discord ou Steam Remote Play Together)
  e jogam pelo celular ou controle. **Não** implementar netcode com uma tela por jogador agora.
- Vista isométrica/de cima, câmera atual. JavaScript + Three.js. Sem TypeScript, sem engine própria, sem ECS, sem React.
- Base compartilhada + 3 jogos independentes: este survivor, um souls-like e um RPG. Compartilhar infraestrutura, modelos e mecânicas prontas;
  regras de cada jogo ficam separadas.
- Jogo pago na Steam, com demo. Sem microtransações.
- 70% do esforço em deixar este jogo divertido, 30% em organização. A arquitetura nunca pode virar um projeto maior que o jogo.

## Direção do jogo (decidida em 30/10/2026; detalhes em `docs/GAME-DESIGN.md`)
- Conceito: **B — A paróquia sitiada.** O grupo escolhe uma casa como base, saqueia de dia e defende barricadas à noite.
  Vence quem aguenta 3 noites (Cerco 1/demo: 2 noites). Chefe: a Santa Compaña, à meia-noite da última noite.
- Queda: um aliado levanta em 3 s ao lado, ou um remédio levanta na hora. Sem ajuda em 40 s, só volta no próximo amanhecer.
- Solo: sem companheiros controlados pelo computador; ajustes próprios (remédio inicial, levanta sozinho 1x por noite, +saque).
  `?bots=` é só ferramenta de teste.
- Ordem dos PRs: F1 → F2 → F3 (fundação) e depois J1…J14 (seção 10 do GAME-DESIGN).

## Regras de trabalho
- PRs pequenos. Nunca misture reorganização com mudança de jogabilidade no mesmo PR.
- Preserve sempre: FPS, sistema de chunks, split screen, controle pelo celular, determinismo do mundo, estilo visual e o contrato de input.
- Nenhuma dependência nova sem perguntar (exceção já aprovada: `playwright` como devDependency para o smoke).
- Comentários no código em português, curtos.
- Leve para `engine/` ou `shared/` só o que este jogo já usa E que os outros dois claramente vão precisar. Nada de abstração "para o futuro".

## Formato de cada PR
Título claro + descrição com:
- O que mudou (para leigo, até 5 linhas)
- Por que
- Como testar (passos numerados no Codespaces, dizendo o que ele deve ver)
- Capturas do `npm run smoke` (links para `smoke/*.jpg` no commit do PR)
- Risco e como desfazer

## Proibido nesta fase (até o dono liberar)
Só mudar regras de jogo nos PRs J1…J14 aprovados pelo dono (um por vez). Não criar classes, armas, inimigos, itens ou missões fora desse plano.
Não implementar online com uma tela por jogador. Não mexer na câmera (exceção liberada no J2: tremor de tela, `split.shake`). Não migrar para TypeScript. Não criar sistema Entity/Component. Não publicar nada.

## Fatos que não são óbvios no código
- **Não existe seed.** O mundo é uma função fixa das coordenadas (`hash` em `src/world/noise.js`): toda partida acontece no mesmo mapa.
  Zumbis, clima e efeitos usam `Math.random` (não são determinísticos). "Mesmo mundo" = mesmas casas/estradas/nomes nas mesmas coordenadas.
- **Memória (medida na F2, 10 min de sedã em linha reta, ~14 km, sem desenhar):** antes, +7,5 MB por minuto sem parar (171 → 256 MB);
  os maiores caches eram postes (25 mil itens), chão, descritor de chunk e vilas. Depois da F2: estável em ~197 MB (histórico abaixo).
  Roteiro de medição: não versionado (Playwright + `performance.memory` com `--enable-precise-memory-info --js-flags=--expose-gc`).
- **Atlas de placas** (`shared/worldgen/sign-atlas.js`, 2048×2048, o dono pediu para não aumentar): células fixas por tamanho
  (pequenas 15 + 1 em branco, km 24, nomes 16, painéis 16). `SignUV(chave)` segura o texto; o chunk devolve com `ReleaseSignUV` ao sair
  (via `userData.dispose`, em `signage.js`). Célula só recebe outro texto quando ninguém mais usa o antigo. Sem lugar → `uv.blank`
  (placa sem texto, não segura nada). Medido: 1 grupo usa no máximo 6/8/13/12; tela em 4 numa cidade passa de 16 nomes/painéis
  → algumas placas em branco (antes: texto errado). `SignAtlasStats()` para testes.
- Defeito visual conhecido (não corrigido): nos painéis de direção, nome longo encosta no número de km ("Covavelle5 km").
- `npm audit` acusa falhas em dependências do Vite (nanoid, postcss, source-map-js). Já existiam; não corrigidas (perguntar ao dono antes).
- Depois do merge do PR "limpeza", `git pull` apaga a pasta `node_modules` (ela saiu do Git) → rodar `npm install` de novo.
- **Escala das placas:** 1 km de placa = 32 m de jogo (marcos de km a cada 32 m; cada trecho de 64 m entre cruzamentos = "2 km").
  Os marcos usam |k|, então o km é igual para os dois sentidos da estrada. Cruzamentos: 13% cidade, 29% vila, 58% vazio (`layout.js`).
- Postos de gasolina só existem na N-550 (estrada x = 0; `StationOf` em `layout.js`). A largada é ao lado do posto do km 0.
- Velocidades: andar 4,4 m/s, correr 7,6, mirando 3,1 (`player-movement.js`); sedã 23 m/s, picape 20, jipe 19 (`vehicles/models.js`).
- Raio do barulho que atrai zumbis: tiro 30 m (pistola 22), granada 38, música do Bardo 18, onda 12, dardo 9, katana 7,
  carro andando 18, correr 8, andar 3. A noite muda visão (16 → 9 m) e quantidade (×1,3). Chuva e neblina não afetam os zumbis.
- **Saque (J3):** `buildings.js` registra cada móvel no protótipo da casa (`pr.spots`: centro, frente, andar, tipo, cômodo); o gerador converte
  para o mundo (`b.spots`, id = posição + andar, estável ao recarregar) e `SpotsNear(x, z, andar, r)` (registro de casas) devolve os próximos.
  O que foi revistado/desmontado fica em `loot.js` (Map por id) até `game.clear()`. Desmontar não some com o móvel (ele faz parte da malha da casa).
- **Barricadas (J4):** colisor com `only: 'zombie'` (motor: `resolve` ignora para outros tipos) e `door: true` (A* trata como porta)
  e `h: 1` (tiro e visão passam). `DoorsNear`/`HasBuilding` no registro de casas; `door.lock` = zumbi não abre a porta. Estado por porta
  (id = posição) em `barricades.js`; o desenho e o colisor saem/voltam com a casa. Zumbi em perseguição encostado bate (`ctx.bash`).
- **Janelas (J5a):** `buildings.js` registra as janelas do térreo no protótipo (`pr.windows`: centro na parede, normal para fora, largura);
  o gerador põe no mundo (`b.windows`, id = posição) e `WindowsNear`/`BuildingAt` respondem. A parede continua inteira: o zumbi não passa
  pela colisão, ele pula (teleporta para dentro depois de `window.climb` s). A horda pergunta `ctx.entry(e, x, z, dt)` antes de andar
  (perseguindo/investigando): alvo numa casa e janela utilizável mais perto que a porta → vai pela janela. Janela com móvel/escada na frente
  (ponto de dentro bloqueado) não é usada. Vidro quebrado continua quebrado (buraco escuro desenhado por fora).
- **Cerco (J5b):** a partida começa ao meio-dia (`siege.start`; as regras chamam `hooks.setClock` no 1º quadro). `siege.js` conta as noites pelo
  relógio (`day.nightFrom`/`nightTo`) e devolve `'win'` no amanhecer depois de `siege.nights`. À noite, com rádio posto, `director()` dá à horda
  `{ x, z, extra, share, ring }`: zumbis a mais nos picos (`pulses`), parte nascendo no anel 40–50 m da base; esses ficam com `e.siege` e vão
  investigar a base (não somem ao amanhecer nem por estarem longe dos jogadores, enquanto durar a noite). Sem rádio: horda normal.
  Partida de 2 noites ≈ 17 min (`day.seconds` 600). Munição só do saque (`rules.ammoCap`); os suprimentos a cada 75 s saíram.
  Derrota = todos caídos ao mesmo tempo. Resultado em `st.result` (painel `#result` no `hud.js`) por `rules.resultTime` s.
- **Queda (J6):** `p.dead` = no chão (caído ou fora); `p.out` = fora até o amanhecer; `p.downT` = tempo de espera. `fall.js` levanta no lugar;
  no amanhecer (`siege.update()` devolve `'dawn'`) quem está no chão volta ao lado de alguém de pé (`revive` em `survival.js`).
  O levantar é uma tarefa (`tasks.js`, `a: 'lift'`; `down: true` vale caído, `valid()` cancela se o outro já levantou). Derrota = ninguém de pé
  e ninguém pode levantar sozinho (`fall.canRise()`, só no solo). Solo = 1 jogador (`players.size`); bots contam como jogador.
  `game.hurt(p, dano)` fica exposto para testes (replay).
- **Níveis (J7a):** o nível é `p.level` — **`p.lv` é o andar** (0 = térreo), não confundir. XP em `p.xp`, melhorias em `p.mods` (Set), cartas em `p.cards`,
  escolhas pendentes em `p.picks`, fôlego do Pulmão em `p.move`. Cada efeito fica onde a coisa acontece (`has(p, 'id')` de `levels.js`).
  São 28 cartas: 8 gerais, 16 de classe (`cls`) e 4 combinações (`cls` + `with`: só sorteia se a outra classe estiver no grupo).
  Efeitos das de classe em `abilities/classes.js` (`haste` = Muiñeira; `e.waveAt` = Fogo na roda; `p.dash2` = Investida dupla)
  e em `enemies/zombies.js` (`e.freezeT` = Gelo profundo, parado e sem atacar; corrida mais quieta = Passo de gato).
  Prova feita (J7a e J7b): com os níveis desligados (`need` enorme), o replay deu igual ao do PR anterior.
- `window.__game` existe só no `npm run dev` (testes automáticos e depuração); a versão compilada não tem.
- Interiores (`buildings.js`): térreo (cozinha/sala: fogão, balcão, mesa, sofá, cômoda, baú, estante), andar de cima (quarto: cama,
  guarda-roupa, baú, escrivaninha) e sótão das casas de 3 andares (caixotes, barris, sacos, baú). Lojas: prateleiras, balcão, vitrine.
  Os móveis são fundidos numa malha só por casa: para saque, o gerador terá de devolver a posição de cada móvel.

## Plano da sessão de fundação (30/10/2026)
0. Verificação ✓ · 1. PR "limpeza" ✓ · 2. `docs/GAME-DESIGN.md` ✓ (decisões registradas) · 3. Fundação em 3 PRs: F1 (PR #4) · F2 (PR #5) · F3 (PR aberto).
4. Vertical slice (seção 10 do GAME-DESIGN), um PR por vez: J1 · J2 · J3 · J4 · J5a · J5b · J6 · J7a · J7b (PRs abertos, aguardando merge em ordem) · próximo: J8 (seção 10 do GAME-DESIGN).
Estrutura-alvo da Etapa 3 (criar só pastas com conteúdo real; imports só descem `games` → `shared` → `engine`, verificado por `npm run check`):
```
src/engine/   {core, render, input, net, audio, world, ui}     genérico, não sabe que existem zumbis
src/shared/   {characters, creatures, worldgen, vehicles, fx, audio}  peças opcionais para os 3 jogos
src/games/survivor/  {config/balance.js, rules, enemies, abilities, main.js}
```
Decidido: a Etapa 3 vai em 3 PRs — F1 mover pastas + `npm run check` (+ cortar as dependências que sobem, `THREE.Timer`) ·
F2 estado global → instâncias com `reset()` + caches limpos por distância (medir antes) · F3 `balance.js` + `?bots=3`.

## Histórico de PRs
- **limpeza** — `node_modules/` fora do Git; `.gitignore` aceita .glb/.gltf; `player-moviment.js` → `player-movement.js`; README sem `reflections.js`;
  `npm run smoke`; este CLAUDE.md; `docs/COMO-FUNCIONA.md`; `docs/TESTE-MANUAL.md`. Nenhuma mudança no jogo.
- **j7b-classes (J7b)** — 16 melhorias de classe (4 cada) e 4 combinações no sorteio das cartas. Atirador: Silenciador, Bolsos fundos, Bala que atravessa,
  Granada de pescador. Samurai: Corte limpo, Investida dupla, Passo de gato, Redemoinho de aço. Mago: Dardo em cadeia, Chuva de pedras, Gelo profundo,
  Queimada. Bardo: Muiñeira, Coro, Onda forte, Isca. Combinações (= o J13 do plano, antecipado com OK do dono): Estilhaçar, Ritmo de guerra, Fogo na roda, Derrubar e cortar. Números em
  `balance.js · upgrades`. Placar mostra a recarga certa em segundos (`info().buttons[].s`). Replay atualizado de propósito (mais cartas no sorteio).
- **j7a-niveis (J7a)** — XP por abate (1; corredor 2), revistar (3), consertar (2) e noite sobrevivida (20, todos); níveis em 20/30/40/55/70/90/110 XP.
  Subir de nível: coluna de luz dourada, som, 3 s invulnerável, 3 cartas sorteadas (celular: toque; teclado: 1/2/3 na TV). As 8 melhorias gerais.
  Placar: "Nv 2" + barra roxa de XP; tela de resultado mostra o nível de cada um. Bots escolhem carta qualquer. Replay atualizado de propósito.
- **j6-queda (J6)** — quem cai fica 40 s no chão (anel pulsando, tempo no placar e no celular); aliado ao lado levanta com Usar (3 s parado,
  o tempo do caído para); Usar de novo durante o levantar gasta 1 🩹 e levanta na hora; sem ajuda → fora até o amanhecer (volta ao lado de alguém).
  Acabou a volta automática em 25 s. Canção do Bardo levanta só quem não está fora. Solo: 1 🩹 no começo, levanta sozinho 1x até cada amanhecer,
  saque +20%, barricadas perdem vida 25% mais devagar. Bots de teste levantam quem cai perto. Replay atualizado de propósito (cena de queda).
- **j5b-cerco (J5b)** — a partida vira o cerco: começa ao meio-dia, rádio avisa ("o exército chega no amanhecer do 3º dia" e 2 h antes de escurecer);
  à noite o diretor manda a horda contra a base em 2 picos (21h e 2h; 12 zumbis a mais, ×1,6 na 2ª noite, 75% nascem a 40–50 m da base).
  Vitória no amanhecer do 3º dia; derrota quando todos caem; tela de resultado. Suprimentos automáticos de munição removidos (munição só do saque).
  Placar: "☀ Dia 1" / "🌙 Noite 1/2 · 🧟 pico!". Replay atualizado de propósito (relógio anda no replay; 11 zumbis do cerco na base).
- **j5a-base-janelas (J5a)** — janelas do térreo viram entradas: zumbi atrás de alguém lá dentro vai pela janela se for mais perto que a porta,
  bate na barricada, quebra o vidro (4 de vida) e pula em 1,5 s; janela aceita barricada como a porta. Rádio: Usar num lugar livre dentro de uma
  casa marca a base (📻 no placar; anel verde pulsando); Usar perto dele pega de volta. Replay atualizado (zumbis agora usam janelas).
- **j4-barricadas (J4)** — por dentro, perto da porta: Barricar (2 🪵, 2,5 s), Consertar (1 🪵, +20), Reforçar (2 🪵, vida 40 → 80);
  martelo 12 m. Só segura zumbi (gente e tiro passam). Zumbi encostado bate (2 de dano a cada ~1,1 s); tábuas caem em estágios; barrinha de vida
  deitada sobre a porta; aviso "barricada sob ataque"; quebra com estrondo e tremor. `tasks.js` separou o "parado fazendo algo" do saque
  (replay igual depois da separação — verificado). Janelas e rádio/base: J5 (decisão do dono).
- **j3-saque (J3)** — móveis viram pontos de busca: Usar revista (1,5 s parado, barulho 5 m, 50% de achar) e depois desmonta (3 s, martelo 12 m,
  1–2 tábuas); mesa/cama/sofá só desmontam. 5 itens no estoque do grupo (munição vai direto para os Atiradores); marcadores amarelo/laranja a 4 m;
  anel de progresso; estoque no placar e no celular; botão Usar do celular mostra a ação. Números em `balance.js · loot`. Itens ainda sem uso (J4+).
- **j2-juice (J2)** — sensação: anel de barulho (habilidades a partir de 7 m), zumbi pisca branco ao levar golpe (`rig.flash`),
  tremor de tela por distância (explosão, batida, atropelamento, espingarda, 3º golpe, pisão), pausa de 40 ms (3º golpe, pisão, atropelamento),
  clarão do tiro no chão à noite. Tudo em `balance.js · juice`. Um aviso só: `impact(x, z, tipo)` (habilidades, horda e carros → regras).
  Replay atualizado de propósito: só a pausa muda o jogo (com `hitStop` 0 o replay dá igual ao anterior — verificado).
- **j1-escolher-classe (J1)** — classe escolhida no menu (◀ ▶; A/D no teclado; ◀ ▶ na espera do celular), classes repetidas permitidas;
  anel da cor da vaga no chão sob cada jogador + faixa da cor no placar. Quem não troca joga igual (replay igual). Smoke troca classes no menu.
- **correcao-placas** — atlas de placas com células fixas e contagem de quem usa cada texto. Antes: 1.813 placas montadas com texto
  errado em 8 km de estrada (2.590 com tela em 4). Depois: 0 (simulação com o atlas real; tela em 4: 109 em branco). Só visual: mundo e replay iguais.
- **fundacao-balanco (F3)** — `config/balance.js` com todos os números (classes, armas, habilidades, zumbis, regras, dia);
  movimento e clima recebem os números por parâmetro; `?bots=1..3` (tecla B espalha/junta, testa split screen sozinho);
  `npm run check` ganhou o replay (`scripts/sim.mjs`): código original e novo dão o mesmo hash. Mesmo mundo, mesmo jogo.
- **fundacao-instancias (F2)** — `CreateChunks` (instância, `reset()`), postes dentro de `CreateStreetLights`, vagas de carro dentro de
  `CreateVehicles`; `ResetColliders`/`ResetBuildings`/`ResetSignAtlas`; 15 caches com `LimitedCache` + `TrimCaches` no descarregamento;
  `npm run check` ganhou o teste de esquecer caches. Memória em 10 min de sedã (~14 km): antes 171 → 256 MB subindo 7,5 MB/min;
  depois estável em ~195–197 MB a partir do 3º minuto. Mesmo mundo, mesmo jogo.
- **fundacao-pastas (F1)** — código em `src/engine`, `src/shared`, `src/games/survivor`; `npm run check` (camadas + impressão digital do mundo);
  ligações que subiam viraram avisos (`events`) ou funções passadas pelo jogo (`Wire()`); `THREE.Clock` → `THREE.Timer`
  (`engine/core/loop.js`); contrato de input em `engine/input/contract.js`. Mesmo mundo (hash igual ao de antes), mesmo jogo.
- **game-design** — `docs/GAME-DESIGN.md`: diagnóstico, 3 conceitos (escolhido: B, A paróquia sitiada), partida de ~27 min,
  saque, 24 melhorias, inimigos, progressão, juice, plano do vertical slice e comercial. Só documento.
