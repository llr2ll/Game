# Game design (30/10/2026)

## Decisões do dono (30/10/2026)
| Tema | Decisão |
|---|---|
| Conceito | **B — A paróquia sitiada** |
| Quando alguém cai | Um aliado levanta em 3 s ao lado, ou um remédio levanta na hora. Sem ajuda em 40 s, só volta no próximo amanhecer |
| Jogo solo | Sem companheiros controlados pelo computador, com ajustes para quem joga sozinho (seção 6) |
| Fundação (Etapa 3) | 3 PRs menores: F1 pastas + check · F2 instâncias e caches · F3 `balance.js` + `?bots=3` |

**Status:** direção escolhida, nada implementado ainda. Os números são pontos de partida: depois da fundação,
todos vão morar em `balance.js` para ajuste.

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
   Só que não existe decisão diferente para tomar à noite. Chuva e neblina não mudam nada no jogo.
3. **Só o Atirador precisa de recurso.** Os suprimentos a cada 75 s dão munição só para ele. Samurai, Mago e Bardo não dependem de nada.
   Sem recurso escasso, não existe motivo para explorar.
4. **O carro anula qualquer distância.** O sedã chega a 23 m/s. Nas placas, 1 km vale 32 m de jogo.
   Resultado: "30 km" passam em ~40 s de carro. Dentro dele, o dano cai 65%.
5. **Não há lugar seguro nem perigoso.** A horda renasce a 24–36 m de quem estiver jogando, em qualquer lugar.
   Ir para a vila ou para o mato dá quase no mesmo (a vila tem só 25% a mais).
6. **Morrer quase não custa.** Quem cai volta sozinho em 25 s. Sem custo, a tensão dos agarrões some.
7. **O mundo é sempre o mesmo mapa.** Não existe semente (sorteio do mapa). Depois de algumas partidas, vira decoreba.
   Solução barata: cada partida começa numa vila diferente. O mundo é infinito, então cada lugar é novo.
8. **Ponto forte escondido:** o mundo já fala de geografia. Há placas com nomes de vilas e distâncias, marcos de km,
   códigos de estrada (N-550, AG-xx) e postos de gasolina na N-550. Poucos jogos de zumbi têm isso pronto.
9. **Ponto forte:** o combate não é sobre dano, é sobre barulho, posição e agarrão (estilo Project Zomboid).
   O tiro chama zumbis a 30 m, a música do Bardo a 18 m, o carro a 18 m, o golpe de katana a só 7 m.
   O barulho já funciona como um "preço" de cada ação.

---

## 2. Os três conceitos

### ✅ Conceito B — A paróquia sitiada (escolhido)

**Premissa.** Galiza, outubro. O rádio da paróquia de *San Xoán de Lamas* recebe a mensagem:
o exército chega ao amanhecer do 4º dia. O grupo escolhe uma casa da vila para resistir.
De dia, sai para buscar tábuas, remédio e munição. À noite, a horda cerca a casa.

**Objetivo de uma partida.** Aguentar 3 noites (~27 min) até o resgate. Cada noite é mais forte.
Na 3ª, à meia-noite, a Santa Compaña vem buscar a paróquia.
Perde quando todos estão caídos ao mesmo tempo.

**A base.** Qualquer casa da vila vira base: basta pôr o rádio dentro dela (Usar no rádio).
As entradas são a porta e as janelas do térreo. Cada entrada aceita uma barricada de tábuas, que tem vida.
Os zumbis batem nas barricadas até quebrar e então entram. Se o térreo cair, o grupo recua para o andar de cima:
a escada vira a última linha de defesa. Casa de 2 andares = mais segura, mas costuma ter mais janelas.

**Por que as 4 classes existem aqui**

| Classe | História | Papel na mecânica |
|---|---|---|
| 🔫 Atirador | Caçador da comarca, guardava a espingarda da caça | Defende da janela do andar de cima. Mata de longe, mas o tiro chama zumbis a 30 m. Única classe que gasta munição achada |
| ⚔️ Samurai | Professora de kendo do ginásio de Ourense; a katana era peça de exposição | Segura a entrada que está caindo, no corpo a corpo. Mata quase em silêncio (7 m), então é quem sai de noite |
| 🔮 Mago | A meiga da aldeia, neta da curandeira. "Non creo nas meigas, mais habelas, hainas" | Fecha uma entrada inteira com gelo ou meteoro. Não depende de saque: a mana volta sozinha |
| 🪕 Bardo | O gaiteiro da festa da paróquia | Cura e levanta quem caiu durante o cerco. De dia, a música atrai a horda para longe de quem está saqueando |

**Sistemas que já existem e entram no jogo:** casas com portas, andares, escadas e móveis (base, saque, recuo);
visão e audição dos zumbis (o martelo na barricada chama zumbi); dia de 10 min (ritmo de saque e cerco);
carros (buscar coisas longe de dia); placas e nomes de vilas (para onde ir buscar); split screen (o grupo pode se dividir de dia).

**O que precisa ser criado:** escolher a base; barricadas com vida nas portas e janelas do térreo; zumbis que atacam barricadas;
o "diretor da noite" (decide quantos zumbis vêm, de onde e quando); pontos de busca nos móveis e 5 itens; desmontar móveis para tirar tábuas;
regras de queda; níveis e melhorias; 3 zumbis especiais e o chefe; resgate e tela de resultado; save.

**Os 3 riscos e como contornar**
1. **O mundo infinito fica pouco usado.** O saque das casas não volta. No dia 2 as casas perto da base já estão vazias:
   é preciso ir de carro à vila vizinha ou à cidade, guiado pelas placas ("← Vilar 4 km"). Cada cerco também acontece numa paróquia diferente.
   Assim, quanto mais longe, mais saque, e mais risco de a noite pegar o grupo fora de casa.
2. **O limite de 55 zumbis ao mesmo tempo (por causa do FPS).** O cerco não precisa de 200 zumbis juntos. Ele vem em fluxo:
   quem morre renasce a 40–50 m da base, fora da vista, e volta a caminhar para a casa. A sensação de horda vem da pressão
   constante em 2 ou 3 entradas ao mesmo tempo. O limite vai para o `balance.js` e vamos medir o FPS com 4 jogadores no cerco.
3. **Gargalo fácil demais** (o Mago joga o meteoro na porta e pronto). Por isso as janelas também são entradas,
   o Labrego quebra barricadas rápido e o Escoitador corre para a barricada que fez barulho. O grupo precisa se dividir entre as entradas.

---

### Conceito A — Rota de fuga (não escolhido; fica de registro)

O último helicóptero sai de *A Pontenova*, no km 84 da N-550, até as 9 h do 3º dia. O grupo atravessa vilas pela estrada,
guiado pelas placas e pelos marcos de km, revira casas atrás de gasolina, munição e remédio e decide entre arriscar ou seguir.
Usaria estradas, placas, marcos de km e carros. Maior risco: errar a dose do carro (viagem curta demais ou caminhada tediosa).
Peças do A que o B aproveita: as viagens de carro de dia, guiadas pelas placas, e a Santa Compaña como chefe.

### Conceito C — Os sinos da Compaña (não escolhido; fica de registro)

A praga é uma maldição: o grupo precisa tocar os sinos de 4 igrejas da comarca antes da 3ª noite, em qualquer ordem.
Cada sino leva 20 s e chama todos os zumbis num raio de 40 m. Precisaria de igreja (prédio novo) e mapa. Maior risco:
objetivos espalhados confundem 4 pessoas no sofá.

---

## 3. Uma partida de ~27 minutos (cerco de 3 noites)

Relógio: 1 dia = 10 min reais. 1 min real = 2,4 horas do jogo. Noite das 18:45 às 05:45 (~4,6 min).
A partida começa ao meio-dia do dia 1 e termina no amanhecer do dia 4.

| Min real | Relógio | O que acontece | Decisão do grupo | O que deve sentir |
|---|---|---|---|---|
| 0:00 | Dia 1, 12:00 | O grupo chega de picape a San Xoán de Lamas. Rádio: "O exército chega no amanhecer do 4º dia. Aguentem 3 noites" | Qual casa vira a base? | Clareza: sei o que fazer |
| 0:30 | 13:10 | Rádio colocado. As entradas da base aparecem marcadas (porta + janelas do térreo). Móveis com brilho fraco = pontos de busca | Saquear a própria base ou as vizinhas primeiro? | Curiosidade |
| 1:00–2:30 | 14:25–18:00 | Saque na vila. Tábuas, remédio, munição. Desmontar uma mesa dá tábuas, mas faz barulho de 12 m | Quanto barulho arriscar | Pressa boa |
| 2:00 | 16:50 | Rádio: "Escurece em 2 horas". 1º nível: cada um escolhe 1 de 3 melhorias no celular | Montar o próprio estilo | Crescimento |
| 2:30 | 18:00 | Barricar: 2 tábuas por entrada. As marteladas chamam os primeiros zumbis | Porta ou janelas primeiro? | Preparação |
| 2:50 | 18:45 | **1ª noite.** Fluxo de zumbis normais e corredores, por 2 lados | Quem segura cada entrada | Primeiro susto |
| 3:00–5:00 | 19:00–24:00 | 1º pico. A janela da cozinha cai. Alguém cai e precisa ser levantado | Largar a entrada para levantar o amigo? | Tensão em grupo |
| 5:00–7:30 | 00:00–05:45 | Calmaria entre picos: consertar barricadas (1 tábua), saquear o sótão, usar remédio | Sair no escuro para buscar tábuas? | Respiro |
| 7:30 | Dia 2, 06:00 | **Amanhece.** Os zumbis se espalham. Tela rápida: barricadas de pé, abates, quem caiu | — | Alívio |
| 7:30–10:00 | 06:00–12:00 | A vila está quase vazia. Placa: "← Vilar 4 km · ↑ A Pobra 6 km" (cidade, com farmácia e ferragens). Gasolina para ir e voltar? | Ir perto e seguro ou longe e rico? **Dividir o grupo?** (tela dividida) | Ganância contra medo |
| 10:00–12:00 | 12:00–16:50 | Na cidade: **Berrador** num cruzamento. Se gritar, chama o quarteirão inteiro | Matar rápido ou sair da vista dele | Urgência |
| 12:00 | 16:50 | Rádio: "Escurece em 2 horas". Volta para a base | Parar no posto (gasolina, mas alarme)? | Corrida contra o relógio |
| 12:50 | 18:45 | **2ª noite.** Entra o **Labrego** (quebra barricada rápido) e o **Escoitador** (corre para quem martela) | Consertar agora (barulho) ou segurar no braço | O jogo muda de cara |
| 14:00–17:00 | 21:30–05:00 | Se o térreo cair: recuo para o andar de cima. A escada vira a muralha. As combinações aparecem (gelo + katana) | Quem fica na escada | Desespero bonito |
| 17:30 | Dia 3, 06:00 | Amanhece. Nível 4–5 | — | "Conseguimos" |
| 17:30–22:00 | 06:00–16:50 | Último dia: preparar a noite final. Sótãos dão achados raros. Reforçar barricadas (+2 tábuas = vida dobrada) | Gastar o dia em tábuas ou em remédio | Planejamento |
| 22:50 | 18:45 | **3ª noite.** Mais forte, todos os especiais | — | Crescendo |
| 25:00 | Dia 4, 00:00 | **Meia-noite: a Santa Compaña.** Velas acesas na estrada. A procissão contorna a casa; enquanto houver vela acesa, o Guia não leva dano e os zumbis ficam mais rápidos | Sair para apagar as velas ou segurar a casa | Clímax, momento para vídeo |
| 27:30 | 06:00 | **Resgate.** Caminhões do exército na estrada. Tela de resultado: noites, abates, barricadas, achados, XP | — | Vitória (ou "por pouco") |
| — | — | Volta ao menu com o novo desbloqueio | Jogar o próximo cerco? | "Só mais uma" |

O cerco da demo (Cerco 1) tem 2 noites (~17 min) e termina com a Santa Compaña passando ao longe, sem a luta final.

---

## 4. Saque: o que se acha e por que vale o risco

**Como funciona.** Os móveis com gaveta (cômoda, baú, guarda-roupa, estante, escrivaninha, fogão e balcão da cozinha,
prateleiras de loja, caixotes e barris) viram **pontos de busca**: brilham de leve quando alguém chega a 4 m.
Segurar **Usar** (E / botão do celular) por 1,5 s revista o móvel. Isso faz barulho de 5 m.
Cada casa tem 2–4 pontos. Cada ponto tem 50% de chance de ter algo. **O saque não volta**: casa revistada fica vazia.

**Desmontar móvel.** Qualquer mesa, cama ou armário pode ser desmontado (3 s) e vira 1–2 tábuas.
Tábua nunca acaba de vez, mas cada desmonte faz barulho de 12 m. Desmontar móvel dentro da base, à noite, chama zumbi.

**Os 5 itens**

| Item | Efeito | Quem usa |
|---|---|---|
| 🪵 Tábuas | Barricar uma entrada (2), reforçar (+2 = vida dobrada) ou consertar (1) | O grupo |
| 🩹 Remédio | Cura 50% da vida ou levanta na hora um aliado caído | Qualquer um |
| 📦 Munição | +20 de carabina e +6 de espingarda. Se não houver Atirador no grupo, vira XP | Atirador |
| ⛽ Gasolina | +10 km no carro (tanque: 3 latas). Ir à vila vizinha e voltar gasta ~1 lata | O grupo |
| ⭐ Achado raro | Ganha 1 melhoria na hora + entra na coleção (seção 8) | Quem achou |

**Onde aparece cada coisa (chance de cada ponto de busca, quando tem algo)**

| Lugar | 🪵 | 🩹 | 📦 | ⛽ | ⭐ |
|---|---|---|---|---|---|
| Térreo (cozinha e sala) | 35% | 25% | 25% | 10% | 5% |
| Quarto (andar de cima) | 15% | 35% | 35% | — | 15% |
| Sótão (casas de 3 andares) | 40% | 5% | 10% | 20% | 25% |
| Loja | 70% do tipo da placa: ferragens = tábuas · farmácia = remédio · caça e pesca = munição |
| Posto de gasolina | 2 latas garantidas, mas a bomba dispara um alarme (barulho de 30 m) |
| Carro abandonado | 25% de ter 1 lata. Tirar a gasolina leva 3 s (barulho de 6 m) |

Numa partida, o grupo deve revistar uns 35 pontos e achar ~17 itens: ~7 de tábuas, ~4 de remédio, ~3 de munição,
~2 de gasolina e 1–2 raros. Todos esses números vão para o `balance.js`.

**Por que entrar numa casa perigosa**
- **Tábuas = a vida da base.** Cada barricada a mais é uma entrada que aguenta mais um pico da noite.
- **Remédio = segunda chance.** Com a regra de queda escolhida, é a diferença entre perder alguém até o amanhecer ou não.
- **Andar de cima e sótão pagam mais**, mas a escada é estreita e só tem uma saída.
- **Moradores:** 30% das casas têm 1–3 zumbis dentro. A porta fechada esconde o que tem lá dentro.
- **Achado raro** só existe dentro de casa e conta para a coleção permanente.
- **O que está perto acaba.** A cada dia o saque bom fica mais longe da base.

---

## 5. Escolhas durante a partida

**Subir de nível.** XP vem de matar (1 normal, 2 corredor, 10 especial), revistar (3), consertar barricada (2)
e sobreviver a uma noite (20 para cada um). Nível a cada ~3 min no início, depois mais devagar (~6 níveis por partida).
Cada jogador escolhe **1 de 3** melhorias no próprio celular. A partida não pausa,
mas o jogador fica invulnerável por 3 s enquanto escolhe.

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
| | Isca | A canção de cura pode ser tocada a 10 m de distância: atrai os zumbis para lá, longe da barricada |
| Geral | Pulmão de atleta | +40% de fôlego |
| | Pele dura | +20% de vida máxima |
| | Empurrão forte | O empurrão sempre derruba e afasta até 5 zumbis |
| | Bota pesada | O pisão mata zumbi caído na hora |
| | Saqueador | Revistar é 2x mais rápido e não faz barulho |
| | Carpinteiro | Barricadas com +50% de vida; consertar e desmontar 2x mais rápido e com metade do barulho |
| | Primeiros socorros | Levantar um aliado caído é 2x mais rápido |
| | Sangue frio | Ao ser agarrado, o primeiro empurrão sempre solta e não gasta fôlego |

**4 combinações entre classes.** Só aparecem no sorteio se as duas classes estiverem no grupo. Assim a escolha vira conversa no sofá.

| Combinação | Classes | Efeito |
|---|---|---|
| Estilhaçar | 🔮 → ⚔️ | Zumbi lento ou congelado pelo gelo que leva golpe de katana estilhaça (morre na hora) |
| Ritmo de guerra | 🪕 → 🔫 | Sob a balada, o Atirador recarrega na hora e ganha 1 granada extra |
| Fogo na roda | 🪕 → 🔮 | Zumbi empurrado pela onda para dentro da área do meteoro leva o dobro de dano |
| Derrubar e cortar | 🔫 → ⚔️ | A investida mata na hora todo zumbi caído que ela atravessar (os derrubados pela espingarda, por exemplo) |

**Outras escolhas:** qual casa vira base; saquear perto e seguro ou longe e rico; dividir o grupo de dia;
porta ou janelas primeiro; consertar no meio do cerco (barulho) ou segurar no braço; quem fica com o remédio;
sair no escuro para buscar tábuas; apagar as velas da Compaña ou defender a casa.

---

## 6. Escolha de classe e jogo solo

**Separar a classe da vaga** (PR J1, depois da fundação):
- No menu, cada vaga mostra a classe com ◀ ▶. No celular: setas na tela de espera. No teclado: A e D.
- **Classes repetidas permitidas.** É um jogo de festa: se 2 amigos querem ser Samurai, tudo bem.
  As combinações (seção 5) já incentivam a variedade, sem proibir nada.
- A cor continua sendo da vaga (para cada um se achar na tela).

**Jogo solo (decidido): sem companheiros controlados pelo computador.**
- O jogo já diminui a horda para quem joga sozinho (18 zumbis com 1 jogador, +7 por jogador a mais). O cerco segue a mesma regra.
- Ajustes do solo: 1 remédio inicial; o jogador caído se levanta sozinho uma vez por noite; +20% de chance de saque;
  barricadas perdem vida 25% mais devagar (uma pessoa não segura 4 entradas).
- O `?bots=3` da fundação é só ferramenta de teste: bots burros, que andam e atacam.

---

## 7. Inimigos

Todos usam a IA que já existe (visão em cone, audição, agarrão) mais um estado novo: **atacar barricada**.
Entram dentro do limite de 55 zumbis.

| Inimigo | O que faz | Usa | Como vencer | Quando aparece |
|---|---|---|---|---|
| 📢 **Berrador** | Ao te VER, para e enche o peito (1,5 s, bem visível). Se terminar, grita: todos os zumbis a 45 m vêm correndo. No cerco, chama um pico extra | Visão + audição | Matar antes do grito, ou sair da vista dele (portas e paredes bloqueiam) | De dia nas vilas e cidades; à noite a partir da 2ª |
| 👂 **Escoitador** | Cego. Ouve qualquer barulho a partir de 3 m num raio de 25 m e dá um bote rápido na direção do som. Adora marteladas | Audição | Consertar só quando ele estiver longe; matar em silêncio (Samurai); atrair com a música (Bardo) | À noite, a partir da 2ª |
| 🪓 **Labrego** | Grandão. Quebra barricada 4x mais rápido. Não cai com empurrão e derruba quem ele bate | Barricadas e portas | Gelo para atrasar; granada ou 3º golpe da katana para atordoar | A partir da 2ª noite |
| 🕯️ **Santa Compaña** (chefe) | Procissão de 6–8 almas encapuzadas com velas acesas, guiadas pelo **Guia**, que carrega a cruz. Contorna a casa. Enquanto houver vela acesa, o Guia não leva dano e os zumbis ficam 25% mais rápidos. Quem toca a fila fica lento e "marcado" (os zumbis o enxergam de longe) | Noite, luz, visão, estrada | Sair da casa para apagar as velas (matar as almas) e então derrubar o Guia | Meia-noite da última noite |

A Santa Compaña é folclore real da Galiza: a imagem é forte para o trailer e única no gênero.

**O diretor da noite** (como o cerco funciona por baixo): ao anoitecer, os zumbis passam a nascer a 40–50 m da base,
fora da vista, e caminham para a entrada mais perto. Cada noite tem 2 picos (perto das 21 h e das 2 h) com calmaria no meio.
Barulho na base (tiro, martelo, música) puxa mais zumbis no pico seguinte. Quantidade por noite (com 4 jogadores):
1ª ~60, 2ª ~100 com especiais, 3ª ~150 com especiais e o chefe. Nunca mais de 55 ao mesmo tempo.

---

## 8. Progressão entre partidas (3 camadas, save local)

1. **Cercos** (dificuldade). Cerco 1: 2 noites (a demo). Cerco 2: 3 noites. Cerco 3: o Labrego desde a 1ª noite.
   Cerco 4: menos saque. Cerco 5: tudo junto. Vencer um cerco libera o próximo.
   Cada cerco acontece numa **paróquia diferente** (outra vila do mapa), então as casas, a base e os caminhos mudam.
2. **Nível da conta.** O XP da partida (mesmo perdendo) sobe o nível. Cada nível libera variedade, não força:
   novas melhorias no sorteio (começa com 16 das 24), cores de roupa, a escolha da paróquia.
3. **Coleção de achados.** 30 achados raros: cartas, fotos, fitas do rádio da paróquia. Cada um tem 2 linhas de texto
   sobre a Galiza e o surto. É assim que a história é contada, sem cutscene.

**Save:** um arquivo pequeno no PC (no navegador: `localStorage`; no Steam: arquivo na pasta do jogo).
O progresso é do PC ("a casa"), não de cada celular, porque os celulares entram sem conta. Exemplo:
```json
{ "versao": 1, "xp": 1840, "nivel": 7, "cercos": [1, 2], "achados": ["carta-avo", "fita-radio-3"], "melhorias": ["isca", "carpinteiro"] }
```

---

## 9. "Juice" que falta (impacto × esforço)

O jogo já tem som posicional, gore, vibração no celular ao levar dano e coração com pouca vida. Falta:

| # | O que | Impacto | Esforço | Observação |
|---|---|---|---|---|
| 1 | **Barricada rachando**: 3 estados visíveis (inteira, rachada, por um fio) + som de pancada | Alto | Baixo | Essencial para o cerco: mostra onde correr |
| 2 | **Aviso de entrada atacada**: ícone na borda da tela apontando a barricada que está apanhando | Alto | Médio | Com 4 entradas, ninguém vê todas |
| 3 | **Anel de barulho**: círculo fino no chão mostrando até onde o som chegou (tiro, martelo, música) | Alto | Baixo | Ensina a mecânica principal sem texto |
| 4 | **Flash branco no zumbi** quando leva golpe | Alto | Baixo | Confirma o acerto |
| 5 | **Tremor de tela** em explosão, espingarda, barricada quebrando e batida de carro | Alto | Baixo | Só na tela de quem está perto (split screen) |
| 6 | **Pausa no impacto** (40 ms) no 3º golpe da katana, no pisão e no atropelamento | Alto | Baixo | Curta, para não travar os outros jogadores |
| 7 | **Clarão do tiro** iluminando o chão à noite | Alto | Baixo | Brilho falso, não luz de verdade (FPS) |
| 8 | **Cerimônia de nível**: coluna de luz, som e as 3 cartas no celular | Alto | Médio | Faz parte do PR de melhorias |
| 9 | **Música dinâmica**: drone de gaita que sobe no pico do cerco | Alto | Alto | Identidade galega; tudo procedural, como o resto do som |
| 10 | Setas na borda apontando zumbis fora da tela que estão te perseguindo | Médio | Médio | De dia, nas saídas de saque |
| 11 | Item "pulando" do móvel para o placar ao ser achado | Médio | Baixo | Recompensa visível para todos |
| 12 | Vibração no celular ao matar, achar item e quando a barricada da sua entrada cai | Médio | Baixo | A vibração já existe; faltam os eventos |
| 13 | Borda vermelha na tela de quem está com pouca vida | Médio | Baixo | Por tela, no split screen |
| 14 | Texto de abate múltiplo ("Triplo!") | Médio | Baixo | Bom para vídeo |
| 15 | Números de dano | Baixo | Baixo | Não recomendo: briga com o estilo Zomboid. O flash (4) basta |

---

## 10. Plano do vertical slice

Vertical slice = o Cerco 1 (2 noites) jogável do começo ao fim, com tudo no nível de qualidade final.
PRs pequenos, nesta ordem. Nenhum mistura reorganização com jogabilidade.

| # | PR | Como testar | Critério de diversão |
|---|---|---|---|
| F1 | Fundação: mover pastas + `npm run check` | Smoke + checklist; o jogo igual | — (zero mudança) |
| F2 | Fundação: estado global → instâncias; limpar caches | Smoke + dirigir 10 min; memória estável | — |
| F3 | Fundação: `balance.js` + `?bots=3` | Mudar um número e ver o efeito; testar 4 classes sozinho | — |
| J1 | Escolher classe no menu (◀ ▶), classes repetidas | Entrar 2 celulares, escolher Samurai nos dois | Ninguém pergunta "como troco de classe?" |
| J2 | Juice básico (itens 3–7 da seção 9) | Atirar, explodir, cortar | Nos primeiros 2 min alguém diz "que gostoso" |
| J3 | Saque v1: pontos de busca + 5 itens + placar do grupo + desmontar móvel | Revistar uma vila inteira | O grupo entra em 3+ casas sem ninguém mandar |
| J4 | Base e barricadas: rádio, entradas, barricar, reforçar, consertar, zumbi ataca barricada (+ itens 1–2 da seção 9) | Barricar a casa e deixar zumbis baterem | O grupo discute qual casa escolher |
| J5 | **Cerco**: diretor da noite, picos, vitória no amanhecer final, derrota, tela de resultado | Jogar o Cerco 1 inteiro | Na 1ª noite alguém grita "a janela da cozinha caiu!" |
| J6 | Regra de queda (levantar com ajuda ou remédio; 40 s; volta no amanhecer) + ajustes do solo | Cair e ser levantado; jogar sozinho | Alguém larga a entrada para salvar o amigo |
| J7 | XP, níveis e as 24 melhorias | Subir 3 níveis | Cada um defende a própria escolha |
| J8 | Gasolina no carro + vilas vizinhas com mais saque | Ir de carro à vila vizinha e voltar antes da noite | "Dá tempo de ir à cidade?" |
| J9 | Berrador | Ser visto por um | Alguém grita "mata o Berrador!" |
| J10 | Labrego + Escoitador | 2ª noite | O grupo muda o jeito de consertar barricada |
| J11 | Santa Compaña (meia-noite da última noite) | Chegar à última noite | Pedir "mais uma" logo depois |
| J12 | Save local + as 3 camadas de progressão | Fechar e abrir: o progresso continua | Querer desbloquear o Cerco 2 |
| J13 | Combinações entre classes | Mago + Samurai juntos | Alguém combina uma jogada em voz alta |
| J14 | Controle de videogame (Gamepad API) | Plugar um controle de Xbox/PS | Jogar sem notar diferença do celular |

Depois de cada PR de jogabilidade: você joga o checklist e diz se o critério de diversão aconteceu.
Se não aconteceu, ajustamos antes de seguir.

---

## 11. Comercial (só planejamento)

- **Frase de venda:** "Defendam a paróquia por 3 noites na Galiza rural. De 1 a 4 pessoas, e o celular é o controle."
- **Argumento principal:** 4 pessoas jogam sem precisar de 4 controles. Ninguém instala nada: é só escanear o QR code.
- **Jogar à distância:** no Steam Remote Play Together, os amigos recebem a imagem pela Steam e jogam com o controle ou teclado deles.
  O Steam entrega esse controle ao jogo como se estivesse plugado no PC. Por isso o suporte a controle (Gamepad API, PR J14) é obrigatório antes do lançamento.
  Celular à distância também dá, mas exige o relay hospedado na internet (custo mensal pequeno).
- **Empacotar:** recomendo Electron + steamworks.js (mais exemplos e documentação que o NW.js). Bônus: o app pode rodar o relay dentro dele,
  então celulares no mesmo Wi-Fi conectam direto no PC, sem servidor pago.
- **Steam Direct:** taxa de US$ 100 por jogo, devolvida depois dos primeiros US$ 1.000 em vendas.
  A página "Em breve" precisa ficar no ar pelo menos 2 semanas antes do lançamento. Na prática, quanto antes, mais listas de desejo.
- **Preço:** survivors cooperativos independentes costumam ficar entre US$ 4,99 e US$ 19,99. Sugiro **US$ 9,99–14,99**,
  com o preço regional sugerido pela Steam para o Brasil e outros países.
- **Demo:** o Cerco 1 (2 noites, ~17 min), com as 4 classes, o Berrador e a Santa Compaña passando ao longe (sem a luta final).
  Lançar a demo num **Steam Next Fest** (acontecem 3 por ano) com a página já no ar há meses.
  O save da demo continua no jogo completo.
- **Sem microtransações.** Os desbloqueios (seção 8) vêm só de jogar.
