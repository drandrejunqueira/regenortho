import { vi } from 'vitest'

// Drizzle query builders are thenable objects: cada método (.from/.where/.orderBy/...)
// devolve outro builder encadeável, e o valor final só resolve quando o objeto é
// aguardado. Este helper simula isso: qualquer método listado retorna o próprio
// objeto (permitindo encadear à vontade) e `then`/`catch` resolvem para `result`.
export function chain(result: unknown = []) {
  const obj: Record<string, unknown> = {}
  const methods = [
    'from', 'where', 'orderBy', 'limit', 'set', 'values',
    'returning', 'onConflictDoUpdate', 'groupBy', 'innerJoin', 'leftJoin',
  ]
  for (const m of methods) {
    obj[m] = vi.fn(() => obj)
  }
  obj.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  obj.catch = (reject: (e: unknown) => unknown) => Promise.resolve(result).catch(reject)
  obj.finally = (fn: () => void) => Promise.resolve(result).finally(fn)
  return obj
}
