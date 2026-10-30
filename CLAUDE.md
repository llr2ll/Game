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
- `npm run check` — rápido (~3 s), sem navegador. Rodar SEMPRE antes de abrir PR. Duas verificações:
  1. **Camadas:** imports só descem (`games/<jogo>` → `shared` → `engine`); um jogo não importa outro; import para arquivo inexistente falha.
  2. **Mundo:** gera 515 chunks + nomes sem desenhar (via Vite) e compara o hash com `scripts/world-fingerprint.txt`.
     Se o mundo mudar sem querer, falha. Mudança de propósito (precisa de OK do dono): `npm run check -- --update-world`.
- `npm run smoke` — teste automático (~3 min). Compila o jogo, sobe relay **8099** e página **5199** (não briga com o dev/server do dono),
  abre no Chromium sem tela, entra 1 teclado (Atirador) + 1 celular simulado (Samurai), joga 60 s (anda, atira, habilidades, carro, noite),
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
scripts/                  smoke.mjs (teste no navegador sem tela), check.mjs (camadas + mundo), world-fingerprint.txt
smoke/                    capturas + log do último npm run smoke
docs/                     COMO-FUNCIONA (leigo), TESTE-MANUAL (checklist), GAME-DESIGN (direção criativa)
src/engine/               genérico
  core/                   events.js (avisos entre partes), loop.js (laço de desenho com THREE.Timer, dt ≤ 0,05)
  render/                 splitscreen.js (junta <13 m, separa >19 m), light.js, style.js (paleta, materiais, vento),
                          entity-shadows.js (sombras falsas), follow.js (contador de FPS)
  input/                  contract.js (contrato de input), keyboard.js (teclado+mouse), phone.js (código do celular)
  net/host.js             conexão da tela com o relay
  audio/engine.js         Web Audio: barramentos, primitivas, som posicional
  world/                  noise.js (hash/ruído), collision.js (grade de colisão), chunks.js (carrega/descarrega chunks),
                          pathing.js (desvio, A*, rota dentro de casas)
  ui/lobby.js             menu de 4 vagas (celular ou teclado); textos e sons vêm do jogo
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
  rules/survival.js       REGRAS: jogadores, dano, morte/revive (25 s), suprimentos (75 s), fim de jogo, estado p/ celulares
  abilities/classes.js    as 4 classes e suas habilidades
  config/weapons.js       dados das armas do Atirador
  enemies/zombies.js      IA da horda: visão, audição, agarrão, renascer
  ui/hud.js               placar da partida
```

**Como as camadas conversam sem import subindo** (tudo ligado em `Wire()` de `games/survivor/main.js`):
- Avisos (`engine/core/events.js`): o mundo emite `door-open`, `door-close`, `thunder`, `splash`, `vehicle-spot`; o jogo decide o som/carro.
- Funções passadas ao motor: `SetupChunks({ size, generate, onLoad, onUnload })`, `SetDeepTest` (água funda), `SetIndoorRoute`
  (zumbi pela porta/escada), `SetIndoorTest` (parede abafa som). Lobby recebe `labels`, `sound`, `subtitle`. Teclado recebe as teclas extras.
- Ainda são variáveis de módulo (estado global). A fundação F2 troca por instâncias criadas no `main.js`, com `reset()`.
- `shared` pode importar `shared` (ex.: `creatures/zombie-model` usa `SoleDepth` de `characters/player`; `fx/gore` usa `worldgen`).

## Contrato de input (proteger)
Teclado e celular usam exatamente o mesmo formato. Não mude sem pedir.
- `game.setInput(id, { mx, mz, ax, az, run, fire })` — mover (-1..1), mirar (-1..1; mirar inclinado = ataca), correr 0/1, `fire` só no mouse.
- `game.act(id, ação)` — `b1` `b2` `b3` (botões da classe) · `shove` · `use` (carro) · `jump` · `reload` · `swap` · `carbine` `shotgun` `pistol`.
- Celular → relay: `{t:'join', code, name}`, `{t:'in', mx, mz, ax, az, run}` a cada 33 ms, `{t:'act', a}`.
- Tela → celular: `{t:'state', hp, max, cls, w, btn, car, dead, st, time, score, held, rv}` a cada 0,15 s; `hit`, `lobby`, `kick`, `closed`.
- Jogador do teclado tem id `'local'`.

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
Não mudar regras de jogo. Não criar classes, armas, inimigos, itens ou missões. Não separar classe da vaga ainda.
Não implementar online com uma tela por jogador. Não mexer na câmera. Não migrar para TypeScript. Não criar sistema Entity/Component. Não publicar nada.

## Fatos que não são óbvios no código
- **Não existe seed.** O mundo é uma função fixa das coordenadas (`hash` em `src/world/noise.js`): toda partida acontece no mesmo mapa.
  Zumbis, clima e efeitos usam `Math.random` (não são determinísticos). "Mesmo mundo" = mesmas casas/estradas/nomes nas mesmas coordenadas.
- Estado global em módulos (F2 resolve): chunks (`engine/world/chunks.js`), grade de colisão (`engine/world/collision.js`),
  registro de prédios (`shared/worldgen/buildings-registry.js`), postes (`shared/worldgen/streetlights.js`), atlas de placas (`shared/worldgen/sign-atlas.js`),
  vagas de carro (`shared/vehicles/vehicles.js`), canal de avisos (`engine/core/events.js`) e os ganchos `Set…` do motor.
- ~20 caches `Map` do mundo nunca são limpos (`worldgen/map.js`, `town.js`, `city-lots.js`, `buildings.js`, `props.js`, `poles.js`, `signs.js`, `names.js`,
  `layout.js`, `endings.js`, `water.js`, `water-life.js`, `sidewalk.js`, `roadwear.js`…). Medir a memória antes de mexer (F2).
- `npm audit` acusa falhas em dependências do Vite (nanoid, postcss, source-map-js). Já existiam; não corrigidas (perguntar ao dono antes).
- Depois do merge do PR "limpeza", `git pull` apaga a pasta `node_modules` (ela saiu do Git) → rodar `npm install` de novo.
- **Escala das placas:** 1 km de placa = 32 m de jogo (marcos de km a cada 32 m; cada trecho de 64 m entre cruzamentos = "2 km").
  Os marcos usam |k|, então o km é igual para os dois sentidos da estrada. Cruzamentos: 13% cidade, 29% vila, 58% vazio (`layout.js`).
- Postos de gasolina só existem na N-550 (estrada x = 0; `StationOf` em `layout.js`). A largada é ao lado do posto do km 0.
- Velocidades: andar 4,4 m/s, correr 7,6, mirando 3,1 (`player-movement.js`); sedã 23 m/s, picape 20, jipe 19 (`vehicles/models.js`).
- Raio do barulho que atrai zumbis: tiro 30 m (pistola 22), granada 38, música do Bardo 18, onda 12, dardo 9, katana 7,
  carro andando 18, correr 8, andar 3. A noite muda visão (16 → 9 m) e quantidade (×1,3). Chuva e neblina não afetam os zumbis.
- Interiores (`buildings.js`): térreo (cozinha/sala: fogão, balcão, mesa, sofá, cômoda, baú, estante), andar de cima (quarto: cama,
  guarda-roupa, baú, escrivaninha) e sótão das casas de 3 andares (caixotes, barris, sacos, baú). Lojas: prateleiras, balcão, vitrine.
  Os móveis são fundidos numa malha só por casa: para saque, o gerador terá de devolver a posição de cada móvel.

## Plano da sessão de fundação (30/10/2026)
0. Verificação ✓ · 1. PR "limpeza" ✓ · 2. `docs/GAME-DESIGN.md` ✓ (decisões registradas) · 3. Fundação em 3 PRs: F1 (PR aberto) · F2 · F3.
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
- **fundacao-pastas (F1)** — código em `src/engine`, `src/shared`, `src/games/survivor`; `npm run check` (camadas + impressão digital do mundo);
  ligações que subiam viraram avisos (`events`) ou funções passadas pelo jogo (`Wire()`); `THREE.Clock` → `THREE.Timer`
  (`engine/core/loop.js`); contrato de input em `engine/input/contract.js`. Mesmo mundo (hash igual ao de antes), mesmo jogo.
- **game-design** — `docs/GAME-DESIGN.md`: diagnóstico, 3 conceitos (escolhido: B, A paróquia sitiada), partida de ~27 min,
  saque, 24 melhorias, inimigos, progressão, juice, plano do vertical slice e comercial. Só documento.
