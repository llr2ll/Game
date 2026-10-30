// Contrato de input: teclado e celular mandam exatamente o mesmo formato. Não mude sem pedir.
//   game.setInput(id, { mx, mz, ax, az, run, fire })  mover e mirar de -1 a 1 (mirar inclinado = ataca) · run 0/1 · fire só no mouse
//   game.act(id, ação)                                 b1 b2 b3 (botões da classe) · shove · use · jump · reload · swap · nomes de arma
// Copia a mensagem para o estado de input do jogador, aceitando só números (o celular manda texto via rede).
export function ApplyInput(i, m) {
  i.mx = +m.mx || 0; i.mz = +m.mz || 0; i.ax = +m.ax || 0; i.az = +m.az || 0; i.run = m.run ? 1 : 0
  i.fire = m.fire === undefined ? undefined : m.fire ? 1 : 0
}
