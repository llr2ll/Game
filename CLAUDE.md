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
Endereço do relay no navegador: `VITE_WS_URL` se existir; senão `ws(s)://<mesmo host>:8080` (`src/net/host.js`, `src/controller/controller.js`).

## Como testar
- `npm run smoke` — teste automático (~3 min). Compila o jogo, sobe relay **8099** e página **5199** (não briga com o dev/server do dono),
  abre no Chromium sem tela, entra 1 teclado (Atirador) + 1 celular simulado (Samurai), joga 60 s (anda, atira, habilidades, carro, noite),
  aperta Esc e confere a volta ao menu. **Falha se aparecer qualquer `console.error` ou erro de página.** Capturas e log em `smoke/` (versionados: o PR mostra as capturas).
  Script: `scripts/smoke.mjs`. Sem GPU o jogo roda a 1–2 FPS → 60 s reais ≈ 6 s de jogo. Pega erro de carregar/iniciar/botões, não bugs de longo prazo.
- `docs/TESTE-MANUAL.md` — checklist de 5 min que o dono roda depois de cada PR (inclui anotar FPS). Peça para ele rodar.
- FPS real só vale na máquina do dono. Nunca tire conclusão de desempenho pelo smoke.

## Mapa de pastas (hoje)
```
index.html, main.css      página do jogo (tela) + HUD
controller.html           página do celular (controle)
server/server.js          relay WebSocket: cria sala (4 letras) e só repassa mensagens tela ↔ celulares
scripts/smoke.mjs         teste automático no navegador sem tela
smoke/                    capturas + log do último npm run smoke
docs/                     COMO-FUNCIONA (leigo), TESTE-MANUAL (checklist), GAME-DESIGN (proposta de direção criativa)
src/
  index.js                liga tudo: renderer, clima, lobby, rede, teclado, loop de desenho
  game.js                 REGRAS: jogadores, dano, morte/revive (25 s), suprimentos (75 s), fim de jogo, estado p/ celulares
  input/keyboard.js       teclado+mouse → mesmo contrato do celular (jogador 'local')
  net/host.js             conexão da tela com o relay
  controller/controller.js  código do celular (sticks, botões, vibração)
  ui/lobby.js, hud.js     menu de 4 vagas (a vaga define a classe) e HUD
  camera/                 splitscreen.js (junta <13 m, separa >19 m), follow.js (FPS), light.js
  characters/             classes.js (classes + habilidades), player.js (esqueleto/animação), looks.js (visual),
                          kits.js (armas + IK), player-movement.js (movimento com peso)
  weapons/weapons.js      dados das armas do Atirador
  enemies/                zombies.js (IA: visão, audição, agarrão, renascer), zombie-model.js, pathing.js (desvio/A*/portas/escadas)
  vehicles/               models.js (sedã, picape, jipe: desempenho, bancos), vehicles.js (física, entrar/sair, atropelar)
  fx/                     effects.js (anéis, arcos, fumaça), gore.js (sangue, desmembramento, com pools)
  audio/                  engine.js (Web Audio, primitivas), sfx.js (efeitos soltos), soundscape.js (som contínuo)
  world/                  mundo infinito por chunks:
    chunks/manager.js, generator.js   carrega/descarrega chunks em volta dos jogadores
    layout.js, town.js, city-lots.js  rede de estradas, vilas, cidades, lotes
    buildings.js, buildings-registry.js  casas com andares/escadas/portas/móveis; recorte de telhado; portas
    climate.js            dia de 10 min, chuva, tempestade, neblina, vento (N = +1 h, K = muda o tempo)
    collision.js, sidewalk.js  colisão e altura do chão
    signs.js, signage.js, sign-atlas.js, names.js  placas, marcos de km, nomes galegos
    water*.js, roadwear.js, props.js, poles.js, streetlights.js, assets*.js, style.js, terrain.js, noise.js …
```

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
- Dependências que atravessam camadas (resolver na fundação): `world/buildings-registry.js`, `world/climate.js` e `world/water-fx.js` importam `audio/sfx`;
  `world/chunks/generator.js` importa `vehicles/vehicles` (`RegisterVehicleSpawn`); `enemies/zombie-model.js` importa `SoleDepth` de `characters/player`;
  `ui/hud.js` importa `clock` de `game.js`; `ui/lobby.js` importa `audio/sfx`.
- Estado global em módulos: chunks (`chunks/manager.js`), grade de colisão (`collision.js`), registro de prédios (`buildings-registry.js`),
  postes (`streetlights.js`), atlas de placas (`sign-atlas.js`).
- ~20 caches `Map` do mundo nunca são limpos (`seed/map.js`, `town.js`, `city-lots.js`, `buildings.js`, `props.js`, `poles.js`, `signs.js`, `names.js`,
  `layout.js`, `endings.js`, `water.js`, `water-life.js`, `sidewalk.js`, `roadwear.js`…). Medir a memória antes de mexer.
- `THREE.Clock` está obsoleto (`src/index.js`) e gera o único aviso do console → trocar por `THREE.Timer` na fundação.
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
0. Verificação ✓ · 1. PR "limpeza" ✓ · 2. `docs/GAME-DESIGN.md` ✓ (aguardando as decisões da seção 12) · 3. PR "fundação" (só depois das respostas).
Quando o dono decidir, registre as respostas aqui e no topo de `docs/GAME-DESIGN.md`.
Estrutura-alvo da Etapa 3 (criar só pastas com conteúdo real; imports só descem `games` → `shared` → `engine`, verificado por `npm run check`):
```
src/engine/   {core, render, input, net, audio, world, ui}     genérico, não sabe que existem zumbis
src/shared/   {characters, creatures, worldgen, vehicles, fx, audio}  peças opcionais para os 3 jogos
src/games/survivor/  {config/balance.js, rules, enemies, abilities, main.js}
```
Proposta pendente de resposta do dono: dividir a Etapa 3 em 3 PRs (mover pastas + check · instâncias/caches · balance.js + `?bots=3`).

## Histórico de PRs
- **limpeza** — `node_modules/` fora do Git; `.gitignore` aceita .glb/.gltf; `player-moviment.js` → `player-movement.js`; README sem `reflections.js`;
  `npm run smoke`; este CLAUDE.md; `docs/COMO-FUNCIONA.md`; `docs/TESTE-MANUAL.md`. Nenhuma mudança no jogo.
- **game-design** — `docs/GAME-DESIGN.md`: diagnóstico, 3 conceitos (recomendado: Rota de fuga), partida de 25 min, saque, 24 melhorias,
  inimigos, progressão, juice, plano do vertical slice e comercial. Só documento.
