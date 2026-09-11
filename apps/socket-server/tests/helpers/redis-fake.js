// ── Redis de test ────────────────────────────────────────────────────────────
// Implémente uniquement les commandes que VoxelPlace utilise réellement, avec
// la même sémantique binaire que Redis. La liste ci-dessous est donc aussi
// l'inventaire exact de la surface Redis du projet :
//
//   get · getBuffer · set · setrange · del · exists
//   hset · hget · hgetall · hdel · hincrby · hscan
//   ping · quit
//
// Un mock générique est tentant, mais le cœur du projet repose sur SETRANGE
// appliqué à un buffer de 4 Mo : c'est précisément la sémantique qu'il faut
// reproduire fidèlement, pas approximer.

export class FakeRedis {
  constructor() {
    this.strings = new Map()  // clé → Buffer
    this.hashes  = new Map()  // clé → Map<field, string>
    this.failing = false      // bascule pour simuler une panne Redis
  }

  /** Simule une indisponibilité : toute commande rejette. */
  setFailing(failing) { this.failing = failing }

  #check() {
    if (this.failing) return Promise.reject(new Error('Redis indisponible (simulé)'))
    return null
  }

  async get(key) {
    const fail = this.#check(); if (fail) return fail
    const buf = this.strings.get(key)
    return buf ? buf.toString('utf8') : null
  }

  async getBuffer(key) {
    const fail = this.#check(); if (fail) return fail
    const buf = this.strings.get(key)
    // Redis renvoie une copie : le buffer interne ne doit pas fuiter
    return buf ? Buffer.from(buf) : null
  }

  async set(key, value) {
    const fail = this.#check(); if (fail) return fail
    this.strings.set(key, Buffer.isBuffer(value) ? Buffer.from(value) : Buffer.from(String(value)))
    return 'OK'
  }

  /**
   * SETRANGE — écrit `value` à partir de l'octet `offset`.
   * Comme Redis, agrandit la valeur si nécessaire en comblant avec des zéros.
   */
  async setrange(key, offset, value) {
    const fail = this.#check(); if (fail) return fail
    const patch   = Buffer.isBuffer(value) ? value : Buffer.from(String(value))
    const current = this.strings.get(key) ?? Buffer.alloc(0)
    const needed  = offset + patch.length
    let next = current
    if (current.length < needed) {
      next = Buffer.alloc(needed, 0)
      current.copy(next)
    }
    patch.copy(next, offset)
    this.strings.set(key, next)
    return next.length
  }

  async del(...keys) {
    const fail = this.#check(); if (fail) return fail
    let n = 0
    for (const key of keys.flat()) {
      if (this.strings.delete(key)) n++
      if (this.hashes.delete(key))  n++
    }
    return n
  }

  async exists(key) {
    const fail = this.#check(); if (fail) return fail
    return (this.strings.has(key) || this.hashes.has(key)) ? 1 : 0
  }

  async hset(key, field, value) {
    const fail = this.#check(); if (fail) return fail
    if (!this.hashes.has(key)) this.hashes.set(key, new Map())
    const hash   = this.hashes.get(key)
    const isNew  = !hash.has(field)
    hash.set(field, String(value))
    return isNew ? 1 : 0
  }

  async hget(key, field) {
    const fail = this.#check(); if (fail) return fail
    return this.hashes.get(key)?.get(field) ?? null
  }

  async hgetall(key) {
    const fail = this.#check(); if (fail) return fail
    const hash = this.hashes.get(key)
    // Redis renvoie un objet vide, jamais null, pour un hash absent
    return hash ? Object.fromEntries(hash) : {}
  }

  async hdel(key, ...fields) {
    const fail = this.#check(); if (fail) return fail
    const hash = this.hashes.get(key)
    if (!hash) return 0
    let n = 0
    for (const f of fields.flat()) if (hash.delete(f)) n++
    return n
  }

  /**
   * HSCAN — parcours par curseur. Renvoie [curseurSuivant, [champ, valeur, …]],
   * « '0' » signalant la fin, comme Redis. COUNT est respecté pour que le code
   * appelant soit réellement exercé sur plusieurs pages.
   */
  async hscan(key, cursor, ...args) {
    const fail = this.#check(); if (fail) return fail
    const countIdx = args.findIndex(a => String(a).toUpperCase() === 'COUNT')
    const count    = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) : 10
    const entries  = [...(this.hashes.get(key) ?? new Map())]
    const start    = parseInt(cursor, 10) || 0
    const page     = entries.slice(start, start + count)
    const next     = start + count >= entries.length ? '0' : String(start + count)
    return [next, page.flat()]
  }

  async hincrby(key, field, increment) {
    const fail = this.#check(); if (fail) return fail
    if (!this.hashes.has(key)) this.hashes.set(key, new Map())
    const hash = this.hashes.get(key)
    const next = parseInt(hash.get(field) ?? '0', 10) + increment
    hash.set(field, String(next))
    return next
  }

  /**
   * Pipeline : accumule les commandes et les exécute à l'appel d'exec().
   * Utilisé par la restauration du canvas depuis PostgreSQL.
   */
  pipeline() {
    const queued = []
    const chain = {
      hset: (...args) => { queued.push(['hset', args]); return chain },
      set:  (...args) => { queued.push(['set',  args]); return chain },
      del:  (...args) => { queued.push(['del',  args]); return chain },
      exec: async () => {
        const results = []
        for (const [cmd, args] of queued) {
          results.push([null, await this[cmd](...args)])
        }
        return results
      },
    }
    return chain
  }

  async ping() {
    const fail = this.#check(); if (fail) return fail
    return 'PONG'
  }

  async quit() { return 'OK' }

  /** Remet l'instance à zéro entre deux tests. */
  flushall() {
    this.strings.clear()
    this.hashes.clear()
    this.failing = false
    return Promise.resolve('OK')
  }
}
