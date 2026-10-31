// Cache com limite para funções puras do mundo (mesma posição = mesmo resultado).
// O mundo é infinito: sem limite, a memória cresce sem parar enquanto se anda (~7,5 MB por minuto de carro).
// TrimCaches() (chamado quando chunks são descarregados) esquece os mais antigos de cada cache — na prática,
// o que ficou para trás. Esquecer só custa recalcular: o resultado é sempre o mesmo.
// onEvict(chave) = esquecer junto algo ligado a essa chave (ex.: os lotes de uma cidade).
const all = []
let scale = 1 // testes encolhem todos os limites para forçar o esquecimento (npm run check)

export function LimitedCache(max, onEvict) {
  const m = new Map()
  all.push({ m, max, onEvict })
  return m
}
export function TrimCaches() {
  for (const { m, max, onEvict } of all) {
    let n = m.size - Math.max(1, Math.floor(max * scale))
    if (n <= 0) continue
    for (const k of m.keys()) {
      m.delete(k)
      if (onEvict) onEvict(k)
      if (--n <= 0) break
    }
  }
}
export const SetCacheScale = (s) => { scale = s }
export const CacheSizes = () => all.map(({ m, max }) => [m.size, max])
