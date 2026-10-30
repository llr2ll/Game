# Game design — proposta (30/10/2026)

**Status:** proposta. Nada aqui está implementado. As decisões em aberto estão no fim (seção 12).
Os números são pontos de partida: depois da fundação, todos vão morar em `balance.js` para ajuste.

---

## 1. Diagnóstico

Fontes: leitura do código e partidas automáticas no navegador sem placa de vídeo (1–2 FPS).
A sensação de ritmo precisa ser confirmada por você jogando de verdade.

**Confirmo os seus pontos:**
- Não há objetivo nem fim além de morrer. Os pontos só aparecem no placar e não servem para nada.
- As casas têm móveis, andares e escadas, mas nada para achar. Entrar numa casa só traz risco.
- Não há escolhas, níveis nem save.
- Só 2 tipos de zumbi (normal e corredor) e nenhum chefe.
- Não há história.

**Corrijo ou acrescento:**
1. **Classe e vaga.** No teclado dá para escolher qualquer vaga, então qualquer classe. No celular, quem entra sozinho cai na vaga 1 (Atirador).
   O problema real: o menu não deixa *escolher* a classe, e dois jogadores nunca podem ter a mesma.
2. **Dia e noite já mudam algo, mas ninguém sente.** À noite os zumbis enxergam 9 m em vez de 16 m e vêm 30% mais.
   Só que não existe decisão diferente para tomar à noite (abrigar-se, seguir, iluminar). Chuva e neblina não mudam nada no jogo.
3. **Só o Atirador precisa de recurso.** Os suprimentos a cada 75 s dão munição só para ele. Samurai, Mago e Bardo não dependem de nada.
   Sem recurso escasso, não existe motivo para explorar.
4. **O carro anula qualquer distância.** O sedã chega a 23 m/s. Nas placas, 1 km vale 32 m de jogo.
   Resultado: "30 km" passam em ~40 s de carro. Dentro dele, o dano cai 65%. Sem gasolina, uma jornada não tem tensão.
5. **Não há lugar seguro nem perigoso.** A horda renasce a 24–36 m de quem estiver jogando, em qualquer lugar.
   Ir para a vila ou para o mato dá quase no mesmo (a vila tem só 25% a mais). Então a escolha de caminho não pesa.
6. **Morrer quase não custa.** Quem cai volta sozinho em 25 s. Sem custo, a tensão dos agarrões some.
7. **O mundo é sempre o mesmo mapa.** Não existe semente (sorteio do mapa). Num jogo de rotas, isso vira decoreba.
   Solução barata: cada partida começa num km diferente da N-550. O mundo é infinito, então cada trecho é novo.
8. **Ponto forte escondido:** o mundo já fala de geografia. Há placas com nomes de vilas e distâncias, marcos de km,
   códigos de estrada (N-550, AG-xx) e postos de gasolina só na N-550. Poucos jogos de zumbi têm isso pronto.
   É a base perfeita para um jogo de viagem.
9. **Ponto forte:** o combate não é sobre dano, é sobre barulho, posição e agarrão (estilo Project Zomboid).
   O tiro chama zumbis a 30 m, a música do Bardo a 18 m, o carro a 18 m, o golpe de katana a só 7 m.
   O barulho já funciona como um "preço" de cada ação. Os conceitos abaixo usam isso.

---

## 2. Três conceitos

### Conceito A — Rota de fuga ⭐ (recomendado)

**Premissa.** Galiza, outubro. A infecção tomou o interior. O rádio avisa: o último helicóptero sai de *A Pontenova*,
no km 84 da N-550 norte, até as 9 h do terceiro dia. O grupo está num posto no km 12, com um carro quase sem gasolina.

**Objetivo de uma partida.** Chegar ao ponto de evacuação antes do prazo, disparar o sinalizador e aguentar 3 min até o helicóptero.
Vence quem embarca. Chegar tarde = perder a evacuação.

**Como se joga.** Os marcos de km são a barra de progresso: 12, 13, 14… As placas dizem "↑ A Pontenova 72 km", "← San Xoán de Lamas 4 km".
O carro anda 10 km por lata de gasolina. O grupo decide: entrar na vila para buscar gasolina, remédio e munição, ou seguir a pé?
À noite: abrigar-se numa casa e barricar a porta, ou seguir no escuro?

**Por que as 4 classes existem aqui**

| Classe | História | Papel na mecânica |
|---|---|---|
| 🔫 Atirador | Caçador da comarca, conhece cada estrada de terra | Mata de longe, mas cada tiro chama zumbis a 30 m. É a única classe que gasta munição achada nas casas |
| ⚔️ Samurai | Professora de kendo do ginásio de Ourense; a katana era peça de exposição | Mata quase em silêncio (7 m de barulho, contra 30 m do tiro). Limpa casas sem chamar a horda. A investida escapa de agarrões |
| 🔮 Mago | A meiga da aldeia, neta da curandeira. "Non creo nas meigas, mais habelas, hainas" | Controla a multidão em portas e escadas (meteoro, gelo). Não depende de saque: a mana volta sozinha |
| 🪕 Bardo | O gaiteiro da festa da paróquia | Cura e levanta quem caiu. A música atrai zumbis a 18 m: serve de isca para afastar a horda enquanto os outros saqueiam |

**Sistemas que já existem e entram no jogo:** rede de estradas, placas, marcos de km e nomes galegos (navegação);
postos de gasolina na N-550; casas com portas, andares, escadas e móveis (saque e abrigo); carros com bancos, dano e barulho (viagem);
dia de 10 min (prazo e noites); visão e audição dos zumbis (preço de cada ação); split screen (o grupo pode se separar para saquear).

**O que precisa ser criado:** destino, km percorridos e prazo; mensagens de rádio; pontos de busca nos móveis e 5 itens;
gasolina no carro; barreiras na estrada; barricar porta; regras de queda; níveis e melhorias; 3 zumbis especiais e o chefe;
o final com sinalizador e helicóptero; tela de resultado; save.

**Maior risco:** errar a dose do carro. Com muita gasolina, a viagem acaba em 2 min. Com pouca, andar vira tédio nos trechos vazios
(58% dos cruzamentos não têm vila). O equilíbrio vem de 3 coisas ajustáveis: km da rota, km por lata e barreiras na estrada.

---

### Conceito B — A paróquia sitiada

**Premissa.** O grupo se refugia no pazo (casarão) de uma vila. O exército promete resgate depois da 3ª noite.
De dia, saem para saquear as vilas vizinhas. À noite, a horda ataca o pazo.

**Objetivo de uma partida.** Sobreviver a 3 noites (25 min). Cada noite é mais forte. Na 3ª, o chefe.

| Classe | História | Papel na mecânica |
|---|---|---|
| 🔫 Atirador | Guarda da paróquia | Defende da janela do andar de cima |
| ⚔️ Samurai | Hóspede do pazo | Segura a porta da frente no corpo a corpo |
| 🔮 Mago | A meiga | Fecha uma entrada inteira com gelo ou meteoro |
| 🪕 Bardo | O gaiteiro | Cura durante o cerco; de dia, atrai a horda para longe da base |

**Usa:** casas, portas e escadas (a defesa acontece nelas), dia e noite (ritmo saque/defesa), carros (buscar coisas longe),
audição (barulho na base chama ataque).
**Precisa criar:** escolher a base, barricadas com vida, ataques noturnos em ondas, saque, níveis, especiais, chefe.
**Maior risco:** o mundo infinito, que é o seu maior trunfo, fica quase sem uso (o grupo vive num raio de 200 m).
E cercos grandes pedem muitos zumbis ao mesmo tempo, mas o limite hoje é 55, por causa do FPS.

---

### Conceito C — Os sinos da Compaña

**Premissa.** A praga é uma maldição. A Santa Compaña, a procissão das almas, caminha pelas estradas à noite.
Para quebrar a maldição, o grupo precisa tocar os sinos de 4 igrejas da comarca antes da 3ª noite.

**Objetivo de uma partida.** Achar e tocar 4 sinos, em qualquer ordem. Tocar um sino leva 20 s e chama todos os zumbis num raio de 40 m (cerco).
Com os 4 tocados, enfrentar o Guia da Compaña.

| Classe | História | Papel na mecânica |
|---|---|---|
| 🔫 Atirador | Sacristão que guardava a espingarda da caça | Protege quem toca o sino |
| ⚔️ Samurai | Peregrina do Caminho de Santiago | Abre caminho no cerco, em silêncio |
| 🔮 Mago | A meiga que conhece o esconjuro | Só ela enxerga a Compaña de longe |
| 🪕 Bardo | O gaiteiro | A música atrapalha a procissão |

**Usa:** vilas e placas (achar as igrejas pelo nome), noite (a Compaña), audição (o sino), carros.
**Precisa criar:** igreja com sino (prédio novo), mapa ou rádio com as pistas, cerco no sino, chefe, saque, níveis.
**Maior risco:** objetivos espalhados confundem 4 pessoas no sofá sem um mapa claro. O tom fica mais fantasioso.

---

### Por que recomendo o A
- Usa o que só este jogo tem: estradas, placas, marcos de km, vilas com nome e carros.
- Resolve 5 dos 7 problemas da seção 1 de uma vez: objetivo, fim, motivo para entrar em casa, noite com decisão e custo para o carro.
- O progresso se lê sem interface: o marco de km na beira da estrada.
- Uma rota curta vira a demo naturalmente.
- Pega o melhor dos outros dois: o abrigo noturno com barricada (de B) e a Santa Compaña como chefe (de C).

---

## 3. Uma partida de 25 minutos (conceito A, rota 1)

Relógio: 1 dia = 10 min reais. 1 min real = 2,4 horas do jogo. Noite das 18:45 às 05:45 (~4,6 min).
Rota 1: do km 12 ao km 84 da N-550 (72 km de placa ≈ 2,3 km de jogo). Prazo: 09:00 do dia 3 (~21 min).

| Min real | Relógio | O que acontece | Decisão do grupo | O que deve sentir |
|---|---|---|---|---|
| 0:00 | Dia 1, 07:00 | Posto no km 12. Rádio: "Evacuação em A Pontenova, km 84. Último voo às 9 h do 3º dia". Carro com 1 lata (10 km). No posto: 1 lata garantida + munição | Quem dirige, quem vai na caçamba | Clareza: sei para onde ir |
| 0:30 | 08:10 | Vila logo na frente. Móveis com brilho fraco = pontos de busca. Primeiros achados | Entrar em todas as casas ou só nas da estrada? | Curiosidade |
| 2:00 | 11:50 | Carro na estrada, km 20–30. Barulho do motor puxa zumbis da beira | Atropelar ou desviar (o carro estraga) | Velocidade, alívio |
| 3:00 | 14:00 | **Barreira** no km 31 (carros batidos). O carro não passa | Seguir a pé ou desviar pela AG-34, passando por San Xoán (+4 km, tem loja) | Primeira escolha de verdade |
| 3:30 | 15:25 | 1º nível: cada um escolhe 1 de 3 melhorias no celular | Montar o próprio estilo | Crescimento |
| 4:00 | 16:40 | Rádio: "Escurece em 2 horas" | — | Antecipação |
| 4:30 | 17:50 | Primeiro **Berrador** numa vila. Se ele gritar, chama a vila inteira | Matar rápido ou fugir da vista dele | Urgência |
| 5:00 | 19:00 | **Anoitece.** Zumbis enxergam menos, mas vêm mais. Escoitadores aparecem | **Abrigar-se** (casa de 2 andares, barricar a porta com 3 sucatas) ou **seguir no escuro** | O dilema central |
| 5–7 | 19:00–24:00 | Se abrigou: o cerco bate na porta. O Labrego tenta arrombar. Defesa na escada | Quem segura a porta, quem cura | Tensão em grupo |
| 7–9:30 | 00:00–06:00 | A noite acalma. Dá para saquear o próprio abrigo e as casas vizinhas no escuro | Sair de noite para buscar gasolina? | Coragem ou paciência |
| 10:00 | Dia 2, 07:00 | Amanhece. Rádio dá o tempo restante. Normalmente o grupo está entre os km 35 e 45 | — | Alívio |
| 10–13 | 07:00–14:00 | **Cidade** no km ~50: farmácia, loja de caça, muitos zumbis, Berradores nos telhados | Entrar na cidade (muito saque) ou contornar (perde ~6 km) | Ganância contra medo |
| 13:00 | 14:00 | Nível 3–4. As melhorias combinadas aparecem (ex.: gelo + katana) | Combinar com o colega | Sinergia |
| 15:00 | 19:00 | **2ª noite.** Mais forte. A **Santa Compaña** passa pela estrada (luzes de vela ao longe). Evitar ou enfrentar | Esconder-se, ou caçar o Guia para ganhar o raro | Medo bonito, momento para vídeo |
| 18–20 | Dia 3, 02:00–07:00 | Últimos km, de carro se sobrou gasolina. A barreira militar aparece no km 84 | — | Reta final |
| ~20:00 | 07:00 | **Sinalizador.** 3 min até o helicóptero. A horda inteira vem. O Guia da Compaña volta, mais forte | Onde defender, quem embarca primeiro | Clímax |
| ~23:00 | 08:00 | Helicóptero. Quem embarca é evacuado. Tela de resultado: km, evacuados, achados, XP | — | Vitória (ou "por pouco") |
| 25:00 | — | Volta ao menu com o novo desbloqueio | Jogar a rota 2? | "Só mais uma" |

Grupo rápido: chega no fim da 2ª noite e o final acontece no escuro (mais difícil, bônus de XP).
Grupo lento: precisa chegar antes das 09:00 do dia 3 (~21 min) ou perde a evacuação.
Grupo que perde ainda leva XP pelos km percorridos e pelos achados (seção 8).

---

## 4. Saque: o que se acha e por que vale o risco

**Como funciona.** Os móveis com gaveta (cômoda, baú, guarda-roupa, estante, escrivaninha, fogão e balcão da cozinha,
prateleiras de loja, caixotes e barris) viram **pontos de busca**: brilham de leve quando alguém chega a 4 m.
Segurar **Usar** (E / botão do celular) por 1,5 s revista o móvel. Isso faz barulho de 5 m.
Cada casa tem 2–4 pontos. Cada ponto tem 50% de chance de ter algo.

**Os 5 itens**

| Item | Efeito | Quem usa |
|---|---|---|
| ⛽ Lata de gasolina | +10 km no carro do grupo (tanque: 3 latas) | O grupo |
| 🩹 Remédio | Cura 50% da vida ou levanta na hora um aliado caído | Qualquer um |
| 📦 Munição | +20 de carabina e +6 de espingarda. Se não houver Atirador no grupo, vira XP | Atirador |
| 🔩 Sucata | Barricar porta (3) ou consertar o carro (2 = +30% de lataria) | O grupo |
| ⭐ Achado raro | Ganha 1 melhoria na hora + entra na coleção (seção 8) | Quem achou |

**Onde aparece cada coisa (chance de cada ponto de busca, quando tem algo)**

| Lugar | ⛽ | 🩹 | 📦 | 🔩 | ⭐ |
|---|---|---|---|---|---|
| Térreo (cozinha e sala) | 5% | 30% | 25% | 35% | 5% |
| Quarto (andar de cima) | 5% | 35% | 35% | 10% | 15% |
| Sótão (casas de 3 andares) | 30% | 10% | 10% | 25% | 25% |
| Loja | 70% do tipo da placa: ferragens = sucata · farmácia = remédio · caça e pesca = munição |
| Posto de gasolina | 2 latas garantidas, mas a bomba dispara um alarme (barulho de 30 m) |
| Carro abandonado | 25% de ter 1 lata. Tirar a gasolina leva 3 s (barulho de 6 m) |

Numa rota inteira, o grupo deve revistar uns 25 pontos e achar ~13 itens: ~4 de gasolina (40 km de carro), ~3 de remédio,
~3 de munição, ~3 de sucata e 1–2 raros. Todos esses números vão para o `balance.js`.

**Por que entrar numa casa perigosa**
- **Gasolina = km.** Cada lata poupa ~1 min de caminhada sob ataque.
- **Remédio = segunda chance.** Com a nova regra de queda (seção 12), é a diferença entre perder alguém ou não.
- **Andar de cima e sótão pagam mais**, mas a escada é estreita e só tem uma saída.
- **Moradores:** 30% das casas têm 1–3 zumbis dentro. A porta fechada esconde o que tem lá dentro.
- **Achado raro** só existe dentro de casa e conta para a coleção permanente.
- **À noite, a casa é o abrigo.** Quem saqueou a vila de dia sabe qual casa tem 2 andares e sucata.

---

## 5. Escolhas durante a partida

**Subir de nível.** XP vem de matar (1 normal, 2 corredor, 10 especial), revistar (3) e km percorridos (2 por km).
Nível a cada ~3 min no início, depois mais devagar (~6 níveis por partida). Cada jogador escolhe **1 de 3** melhorias no próprio celular.
A partida não pausa, mas o jogador fica invulnerável por 3 s enquanto escolhe.

**As 24 melhorias** (4 por classe + 8 gerais)

| Classe | Melhoria | Efeito |
|---|---|---|
| 🔫 Atirador | Silenciador caseiro | A pistola chama zumbis a 11 m em vez de 22 m |
| | Bolsos fundos | +50% de munição na reserva; recarga 25% mais rápida |
| | Bala que atravessa | A carabina atravessa 1 zumbi (60% do dano no segundo) |
| | Granada de pescador | Granada recarrega em 4 s em vez de 7; raio +25% |
| ⚔️ Samurai | Corte limpo | O 3º golpe decapita zumbis com menos de 40% de vida |
| | Investida dupla | A investida tem 2 cargas |
| | Passo de gato | A katana e a corrida fazem metade do barulho |
| | Redemoinho de aço | O redemoinho dura o dobro e puxa os zumbis para o centro |
| 🔮 Mago | Dardo em cadeia | O dardo salta para mais 2 zumbis |
| | Chuva de pedras | O meteoro cai em 3 pedaços menores numa área maior |
| | Gelo profundo | A nova de gelo congela por 2 s em vez de deixar lento |
| | Queimada | Matar com fogo devolve 5 de mana |
| 🪕 Bardo | Muiñeira | A balada também acelera ataques e recargas em 30% |
| | Coro | A canção de cura cura 50% a mais e dá 2 s de proteção |
| | Onda forte | A onda sonora derruba (em vez de empurrar) quem está a menos de 3 m |
| | Isca | A canção de cura pode ser tocada a 10 m de distância: atrai os zumbis para lá |
| Geral | Pulmão de atleta | +40% de fôlego |
| | Pele dura | +20% de vida máxima |
| | Empurrão forte | O empurrão sempre derruba e afasta até 5 zumbis |
| | Bota pesada | O pisão mata zumbi caído na hora |
| | Saqueador | Revistar é 2x mais rápido e não faz barulho |
| | Mecânico | Cada lata rende 13 km; consertar o carro é 2x mais rápido |
| | Primeiros socorros | Levantar um aliado caído é 2x mais rápido |
| | Sangue frio | Ao ser agarrado, o primeiro empurrão sempre solta e não gasta fôlego |

**4 combinações entre classes.** Só aparecem no sorteio se as duas classes estiverem no grupo. Assim a escolha vira conversa no sofá.

| Combinação | Classes | Efeito |
|---|---|---|
| Estilhaçar | 🔮 → ⚔️ | Zumbi lento ou congelado pelo gelo que leva golpe de katana estilhaça (morre na hora) |
| Ritmo de guerra | 🪕 → 🔫 | Sob a balada, o Atirador recarrega na hora e ganha 1 granada extra |
| Fogo na roda | 🪕 → 🔮 | Zumbi empurrado pela onda para dentro da área do meteoro leva o dobro de dano |
| Derrubar e cortar | 🔫 → ⚔️ | A investida mata na hora todo zumbi caído que ela atravessar (os derrubados pela espingarda, por exemplo) |

**Outras escolhas:** em cada cruzamento, estrada principal ou desvio com vila; entrar na cidade ou contornar;
abrigar-se ou seguir à noite; quem fica com o remédio; gastar sucata na porta ou no carro.

---

## 6. Escolha de classe e jogo solo

**Separar a classe da vaga** (PR próprio, depois da fundação):
- No menu, cada vaga mostra a classe com ◀ ▶. No celular: setas na tela de espera. No teclado: A e D.
- **Classes repetidas permitidas.** É um jogo de festa: se 2 amigos querem ser Samurai, tudo bem.
  As combinações (seção 5) já incentivam a variedade, sem proibir nada.
- A cor continua sendo da vaga (para cada um se achar na tela).

**Jogo solo — recomendação: sem companheiros controlados pelo computador no lançamento.**
- Companheiros bons precisam dirigir, subir escada, revistar e não atrapalhar. É muito trabalho e muito risco de irritar.
- O jogo já diminui a horda para quem joga sozinho (18 zumbis com 1 jogador, +7 por jogador a mais).
- Ajustes para o solo: 1 remédio inicial; o jogador caído se levanta sozinho uma vez por noite; +20% de chance de saque.
- O `?bots=3` da fundação é só ferramenta de teste: bots burros, que andam e atacam.
- Depois do vertical slice, se os testes mostrarem que o solo é chato, voltamos ao assunto com dados.

---

## 7. Inimigos

Todos usam a IA que já existe (visão em cone, audição, agarrão). Entram dentro do limite de 55 zumbis.

| Inimigo | O que faz | Usa | Como vencer | Quando aparece |
|---|---|---|---|---|
| 📢 **Berrador** | Ao te VER, para e enche o peito (1,5 s, bem visível). Se terminar, grita: todos os zumbis a 45 m vêm correndo | Visão + audição | Matar antes do grito, ou sair da vista dele (portas e paredes bloqueiam) | Vilas e cidades, desde o 1º dia |
| 👂 **Escoitador** | Cego. Ouve qualquer barulho a partir de 3 m (até andar) num raio de 25 m e dá um bote rápido na direção do som | Audição | Andar devagar, matar em silêncio (Samurai), atrair com a música (Bardo) | À noite; perto de rios |
| 🪓 **Labrego** | Grandão. Arromba porta fechada e barricada (barulho de 20 m). Não cai com empurrão e derruba quem ele bate | Portas e casas | Gelo para atrasar; granada ou 3º golpe da katana para atordoar | Cercos noturnos; perto do fim |
| 🕯️ **Santa Compaña** (chefe) | Procissão de 6–8 almas encapuzadas com velas acesas, guiadas pelo **Guia**, que carrega a cruz. Anda pela estrada. Enquanto houver vela acesa, o Guia não leva dano. Quem toca a fila fica lento e "marcado" (os zumbis o enxergam de longe) | Estradas, noite, luz, visão | Apagar as velas (matar as almas), separar a fila e então derrubar o Guia | Passa na 2ª noite (opcional, dá raro); volta no final |

A Santa Compaña é folclore real da Galiza: a imagem é forte para o trailer e única no gênero.

---

## 8. Progressão entre partidas (3 camadas, save local)

1. **Rotas** (dificuldade). Rota 1: 60 km, 1 noite. Rota 5: 140 km, 3 noites, todos os especiais.
   Vencer uma rota libera a próxima. Cada rota começa num km diferente da N-550, então o trecho do mapa muda.
2. **Nível da conta.** O XP da partida (mesmo perdendo) sobe o nível. Cada nível libera algo:
   novas melhorias no sorteio (começa com 16 das 24), cores de roupa, a escolha do posto de partida.
3. **Coleção de achados.** 30 achados raros: cartas, fotos, fitas de rádio. Cada um tem 2 linhas de texto sobre a Galiza e o surto.
   É assim que a história é contada, sem cutscene.

**Save:** um arquivo pequeno no PC (no navegador: `localStorage`; no Steam: arquivo na pasta do jogo).
O progresso é do PC ("a casa"), não de cada celular, porque os celulares entram sem conta. Exemplo:
```json
{ "versao": 1, "xp": 1840, "nivel": 7, "rotas": [1, 2], "achados": ["carta-avo", "fita-radio-3"], "melhorias": ["isca", "bota-pesada"] }
```

---

## 9. "Juice" que falta (impacto × esforço)

O jogo já tem som posicional, gore, vibração no celular ao levar dano e coração com pouca vida. Falta:

| # | O que | Impacto | Esforço | Observação |
|---|---|---|---|---|
| 1 | **Anel de barulho**: círculo fino no chão mostrando até onde o som chegou (tiro, carro, música) | Alto | Baixo | Ensina a mecânica principal sem texto |
| 2 | **Flash branco no zumbi** quando leva golpe | Alto | Baixo | Confirma o acerto |
| 3 | **Tremor de tela** em explosão, espingarda e batida de carro | Alto | Baixo | Só na tela de quem está perto (split screen) |
| 4 | **Pausa no impacto** (40 ms) no 3º golpe da katana, no pisão e no atropelamento | Alto | Baixo | Curta, para não travar os outros jogadores |
| 5 | **Setas na borda** apontando zumbis fora da tela que estão te perseguindo | Alto | Médio | Evita "morri do nada" |
| 6 | **Cerimônia de nível**: coluna de luz, som e as 3 cartas no celular | Alto | Médio | Faz parte do PR de melhorias |
| 7 | **Clarão do tiro** iluminando o chão à noite | Alto | Baixo | Usar um brilho falso, não luz de verdade (FPS) |
| 8 | **Música dinâmica**: drone de gaita que sobe quando a horda persegue | Alto | Alto | Identidade galega; tudo procedural, como o resto do som |
| 9 | Item "pulando" do móvel para o placar ao ser achado | Médio | Baixo | Recompensa visível para todos |
| 10 | Vibração no celular ao matar e ao achar item | Médio | Baixo | Já existe vibração; só faltam esses eventos |
| 11 | Borda vermelha na tela de quem está com pouca vida | Médio | Baixo | Por tela, no split screen |
| 12 | Texto de abate múltiplo ("Triplo!") | Médio | Baixo | Bom para vídeo |
| 13 | Contorno do jogador atrás de paredes e telhados | Médio | Médio | Hoje o telhado some; falta o caso das paredes |
| 14 | Números de dano | Baixo | Baixo | Não recomendo: briga com o estilo Zomboid. O flash (2) basta |

---

## 10. Plano do vertical slice

Vertical slice = uma rota completa (rota 1) jogável do começo ao fim, com tudo no nível de qualidade final.
PRs pequenos, nesta ordem. Nenhum mistura reorganização com jogabilidade.

| # | PR | Como testar | Critério de diversão |
|---|---|---|---|
| F1 | Fundação: mover pastas + `npm run check` | Smoke + checklist; o jogo igual | — (zero mudança) |
| F2 | Fundação: estado global → instâncias; limpar caches | Smoke + dirigir 10 min; memória estável | — |
| F3 | Fundação: `balance.js` + `?bots=3` | Mudar um número e ver o efeito; testar 4 classes sozinho | — |
| J1 | Escolher classe no menu (◀ ▶), classes repetidas | Entrar 2 celulares, escolher Samurai nos dois | Ninguém pergunta "como troco de classe?" |
| J2 | Juice básico (itens 1–4 e 7 da seção 9) | Atirar, explodir, cortar | Nos primeiros 2 min alguém diz "que gostoso" |
| J3 | Saque v1: pontos de busca + 5 itens + placar do grupo | Revistar uma vila inteira | O grupo entra em 3+ casas sem ninguém mandar |
| J4 | Gasolina no carro + abastecer | Dirigir até acabar; achar lata; abastecer | Acabar a gasolina gera um "ahhh!" e não raiva |
| J5 | **Objetivo da rota**: destino, km, prazo, rádio, início num km sorteado, vitória e derrota, tela de resultado | Jogar a rota 1 inteira | O grupo olha os marcos de km sem ninguém mandar |
| J6 | Regra de queda + noite com abrigo e barricada | Cair, levantar com remédio; barricar uma porta | A 1ª noite gera discussão: "fica ou vai?" |
| J7 | XP, níveis e as 24 melhorias | Subir 3 níveis | Cada um defende a própria escolha |
| J8 | Berrador | Ser visto por um | Alguém grita "mata o Berrador!" |
| J9 | Labrego + Escoitador | Cerco noturno; andar perto de rio à noite | O grupo muda o jeito de andar à noite |
| J10 | Final: sinalizador, helicóptero e Santa Compaña | Chegar ao km 84 | Pedir "mais uma" logo depois |
| J11 | Save local + as 3 camadas de progressão | Fechar e abrir: o progresso continua | Querer desbloquear a rota 2 |
| J12 | Combinações entre classes | Mago + Samurai juntos | Alguém combina uma jogada em voz alta |
| J13 | Controle de videogame (Gamepad API) | Plugar um controle de Xbox/PS | Jogar sem notar diferença do celular |

Depois de cada PR de jogabilidade: você joga o checklist e diz se o critério de diversão aconteceu.
Se não aconteceu, ajustamos antes de seguir.

---

## 11. Comercial (só planejamento)

- **Frase de venda:** "Fujam dos zumbis pela Galiza rural até a evacuação. De 1 a 4 pessoas, e o celular é o controle."
- **Argumento principal:** 4 pessoas jogam sem precisar de 4 controles. Ninguém instala nada: é só escanear o QR code.
- **Jogar à distância:** no Steam Remote Play Together, os amigos recebem a imagem pela Steam e jogam com o controle ou teclado deles.
  O Steam entrega esse controle ao jogo como se estivesse plugado no PC. Por isso o suporte a controle (Gamepad API, PR J13) é obrigatório antes do lançamento.
  Celular à distância também dá, mas exige o relay hospedado na internet (custo mensal pequeno).
- **Empacotar:** recomendo Electron + steamworks.js (mais exemplos e documentação que o NW.js). Bônus: o app pode rodar o relay dentro dele,
  então celulares no mesmo Wi-Fi conectam direto no PC, sem servidor pago.
- **Steam Direct:** taxa de US$ 100 por jogo, devolvida depois dos primeiros US$ 1.000 em vendas.
  A página "Em breve" precisa ficar no ar pelo menos 2 semanas antes do lançamento. Na prática, quanto antes, mais listas de desejo.
- **Preço:** survivors cooperativos independentes costumam ficar entre US$ 4,99 e US$ 19,99. Sugiro **US$ 9,99–14,99**,
  com o preço regional sugerido pela Steam para o Brasil e outros países.
- **Demo:** a rota 1 (60 km, ~15 min, 1 noite), com as 4 classes, o Berrador e a Santa Compaña passando ao longe (sem o final).
  Lançar a demo num **Steam Next Fest** (acontecem 3 por ano) com a página já no ar há meses.
  O save da demo continua no jogo completo.
- **Sem microtransações.** Os desbloqueios (seção 8) vêm só de jogar.

---

## 12. Decisões em aberto

1. **Conceito:** A (Rota de fuga), B (Paróquia sitiada) ou C (Sinos da Compaña)? Recomendo **A**.
2. **Quando alguém cai:** hoje volta sozinho em 25 s. Recomendo: o caído pode ser levantado por um aliado (3 s ao lado) ou por um remédio;
   sem ajuda em 40 s, só volta no próximo amanhecer. Alternativas: manter os 25 s, ou morte até o fim da partida.
3. **Jogo solo:** recomendo solo sem companheiros controlados pelo computador, com os ajustes da seção 6.
4. **Fundação (Etapa 3):** recomendo dividir em 3 PRs (F1, F2, F3 da seção 10).
