# Teste manual (5 minutos, depois de cada PR)

Marque cada item. Se algo der errado, anote o número do item e o que aconteceu, e mande para a IA.
Você precisa de **1 celular** e do teclado do PC. Para o item 12 (4 jogadores), de 3 celulares.

## Preparar (1 min)
1. No Codespaces, pegue a branch do PR (ou a `main` depois do merge) e rode `npm install`.
   Depois do PR "limpeza" isso é obrigatório: a pasta `node_modules` some no `git pull`.
2. Terminal 1: `npm run server`. Terminal 2: `npm run dev`. Abra o jogo no PC do jeito de sempre.

## Checklist
| # | Teste | O que você deve ver | ✓ |
|---|---|---|---|
| 1 | **Menu** abre | 4 vagas (Atirador, Samurai, Mago, Bardo), QR code, código de 4 letras e "Servidor conectado" em verde | ☐ |
| 2 | **Entrar pelo celular** (QR code) e trocar a classe com ◀ ▶ | O celular mostra "Você é o Jogador N" e a classe. Ao tocar ▶, a classe muda no celular e no PC | ☐ |
| 3 | **Entrar pelo teclado** e trocar a classe com A/D | Clique "⌨️ Mouse e teclado" numa vaga livre → "pronto". A e D trocam a classe. Escolha a mesma do celular: os dois entram iguais, cada um com o anel da sua cor no chão. Enter inicia | ☐ |
| 4 | **Atirador**: clique atira, 1/2/3 trocam a arma, R recarrega, G joga a granada | Tiros, cápsulas, explosão. Munição muda no placar | ☐ |
| 5 | **Samurai**: clique faz o combo de 3 golpes, Q investida, F redemoinho | O 3º golpe derruba. A investida atravessa os zumbis | ☐ |
| 6 | **Mago**: clique solta o dardo, Q meteoro, F nova de gelo | O dardo persegue o zumbi. Barra azul de mana desce e volta | ☐ |
| 7 | **Bardo**: clique solta a onda, Q canção de cura, F balada | A onda empurra. A balada mostra ✨ no placar | ☐ |
| 8 | **Carro**: chegue perto de um carro (há carros na largada), E entra, WASD dirige, E sai | O botão 🚗 aparece no celular perto do carro. Motor faz barulho | ☐ |
| 9 | **Casa**: entre por uma porta e suba a escada (fica no fundo da casa) | A porta abre sozinha. O telhado some e você vê o andar de cima | ☐ |
| 10 | **Tela dividida**: afaste o celular e o teclado (~20 passos) e depois junte | A tela se divide em duas e depois volta a ser uma | ☐ |
| 11 | **Morrer e voltar**: deixe um jogador ser mordido até cair | Com 2 jogadores: volta em 25 s ao lado do outro. Sozinho: "FIM DE JOGO" e volta ao menu | ☐ |
| 12 | **Noite**: aperte N várias vezes (+1 hora cada) até 20:00 | O céu escurece, os postes acendem e aparecem mais zumbis | ☐ |
| 13 | **Esc** durante a partida | Volta ao menu sem travar | ☐ |
| 14 | **Sensação**: atire, jogue granada, dê o 3º golpe da katana | Anel fraco no chão até onde o som foi · zumbi pisca branco · a tela treme na explosão · o 3º golpe dá um "tranco" curtinho · à noite o tiro clareia o chão | ☐ |
| 15 | **Saque**: entre numa casa, chegue perto de uma cômoda e aperte E (ou o botão do celular) | Losangos amarelos nos móveis perto · o botão do celular vira "🔍 Revistar" · anel cresce sob você · mensagem do que achou · estoque no topo muda. Use de novo: "🪚 Desmontar", martelo, +tábuas. Andar no meio cancela | ☐ |
| 16 | **Barricada**: junte 2 🪵 (desmonte móveis), fique dentro da casa perto da porta e aperte E | O botão vira "🪵 Barricar (2)" · martelo · tábuas na porta + barrinha verde em cima. Saia e entre pela porta: você passa. Atraia zumbis: eles param na porta e batem; a barrinha cai, aparece "⚠ Barricada sob ataque". Conserte (1 🪵) e reforce (2 🪵) | ☐ |
| 17 | **Janelas e rádio**: dentro de uma casa, num lugar sem móvel, aperte E | "📻 Pôr rádio" · anel verde no chão · 📻 no placar. Atraia um zumbi do lado de uma janela: ele bate, o vidro quebra (barulho de vidro, buraco escuro) e ele pula para dentro. Barrique uma janela (E perto dela, por dentro): o zumbi bate nela em vez de pular | ☐ |

Para testar outra classe pelo teclado: Esc → no menu, aperte A ou D → Enter.

**Sem amigos por perto?** Abra o jogo com `?bots=3` no fim do endereço (ex.: `.../?bots=3`). Três jogadores do computador entram
nas vagas livres, cada um com sua classe, e seguem você. Aperte **B** para eles se espalharem (a tela divide) e **B** de novo para voltarem
(a tela junta). Serve para os itens 4–7, 10 e 11 e para anotar o FPS com 4 jogadores.

## Anotar o FPS
O FPS aparece em verde no canto de cima, à direita. Anote depois de 1 minuto de jogo, de dia, na largada.

| Data | PR | FPS com 1 jogador | FPS com 4 jogadores | Tela dividida em 4? | Observação |
|---|---|---|---|---|---|
| | | | | | |

Se o FPS cair mais de 10% em relação ao PR anterior, avise a IA antes de aprovar o PR.
