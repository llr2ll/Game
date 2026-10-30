// Avisos entre partes do jogo: quem avisa não precisa saber quem escuta.
// Ex.: o mundo avisa "porta abriu" e o jogo decide o som; o gerador avisa "aqui cabe um carro" e o jogo decide se cria.
export function CreateEvents() {
  const map = new Map()
  const api = {
    on(name, fn) { let a = map.get(name); if (!a) map.set(name, (a = [])); a.push(fn); return () => api.off(name, fn) },
    off(name, fn) { const a = map.get(name); const i = a ? a.indexOf(fn) : -1; if (i >= 0) a.splice(i, 1) },
    emit(name, data) { const a = map.get(name); if (a) for (const fn of a) fn(data) },
  }
  return api
}
// canal compartilhado: o mundo ainda é feito de módulos soltos (vira instância criada pelo jogo na fundação F2)
export const events = CreateEvents()
