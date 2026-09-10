// Tests du cooldown de pose de pixel — la règle de jeu centrale.
// L'horloge est injectée : le temps est simulé, aucun test n'attend réellement.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createCooldownController, cooldownForStreak, effectiveRole } from '../src/features/canvas/cooldown.js'

/** Pool factice : renvoie le rôle et le streak demandés. */
function fakePool(rows = []) {
  let calls = 0
  return {
    get calls() { return calls },
    query: async () => { calls++; return { rows } },
  }
}

/** Pool qui échoue systématiquement, pour simuler une base indisponible. */
const brokenPool = { query: async () => { throw new Error('base indisponible') } }

let clock
function makeClock(start = 1_000_000) {
  let t = start
  const fn = () => t
  fn.advance = (ms) => { t += ms }
  return fn
}
beforeEach(() => { clock = makeClock() })

describe('cooldownForStreak', () => {
  it('applique les paliers 60s / 45s / 30s / 20s', () => {
    assert.equal(cooldownForStreak(0),  60_000)
    assert.equal(cooldownForStreak(4),  60_000)
    assert.equal(cooldownForStreak(5),  45_000)
    assert.equal(cooldownForStreak(9),  45_000)
    assert.equal(cooldownForStreak(10), 30_000)
    assert.equal(cooldownForStreak(19), 30_000)
    assert.equal(cooldownForStreak(20), 20_000)
    assert.equal(cooldownForStreak(999), 20_000)
  })
})

describe('effectiveRole', () => {
  it('promeut un pseudo à préfixe réservé même si la base dit user', () => {
    assert.equal(effectiveRole('user', 'hbtn_maxime'), 'superuser')
    assert.equal(effectiveRole('user', 'tm_bob'),      'superuser')
    assert.equal(effectiveRole('user', 'PT_ALICE'),    'superuser')
  })

  it('laisse les autres rôles inchangés', () => {
    assert.equal(effectiveRole('user',       'Alice'),       'user')
    assert.equal(effectiveRole('admin',      'Alice'),       'admin')
    assert.equal(effectiveRole('superadmin', 'hbtn_maxime'), 'superadmin')
  })
})

describe('createCooldownController', () => {
  it('autorise la première pose, refuse la suivante immédiate', async () => {
    const c = createCooldownController({ pool: fakePool([{ role: 'user', streak_hours: 0 }]), now: clock })

    const first = await c.check('Alice')
    assert.equal(first.wait, 0)
    assert.equal(first.cooldownMs, 60_000)

    const second = await c.check('Alice')
    assert.equal(second.wait, 60_000, 'doit attendre le cooldown complet')
  })

  it('réautorise la pose une fois le cooldown écoulé', async () => {
    const c = createCooldownController({ pool: fakePool([{ role: 'user', streak_hours: 0 }]), now: clock })
    await c.check('Alice')

    clock.advance(59_999)
    assert.equal((await c.check('Alice')).wait, 1, 'une milliseconde manque encore')

    clock.advance(1)
    assert.equal((await c.check('Alice')).wait, 0)
  })

  it('suit chaque joueur indépendamment', async () => {
    const c = createCooldownController({ pool: fakePool([{ role: 'user', streak_hours: 0 }]), now: clock })
    await c.check('Alice')
    assert.equal((await c.check('Bob')).wait, 0, 'Bob ne doit pas payer le cooldown d\'Alice')
  })

  it("n'impose aucun cooldown aux rôles privilégiés", async () => {
    for (const role of ['superuser', 'admin', 'superadmin']) {
      const c = createCooldownController({ pool: fakePool([{ role, streak_hours: 0 }]), now: clock })
      await c.check('Priv')
      assert.equal((await c.check('Priv')).wait, 0, `${role} ne doit jamais attendre`)
    }
  })

  it('applique la réduction par streak', async () => {
    const c = createCooldownController({ pool: fakePool([{ role: 'user', streak_hours: 20 }]), now: clock })
    assert.equal((await c.check('Assidu')).cooldownMs, 20_000)
  })

  it('exempte les comptes de test', async () => {
    const c = createCooldownController({
      pool: fakePool([{ role: 'user', streak_hours: 0 }]),
      testUsernames: new Set(['Bot']),
      now: clock,
    })
    await c.check('Bot')
    assert.equal((await c.check('Bot')).wait, 0)
  })

  it('met en cache le rôle : une seule requête pour plusieurs poses', async () => {
    const pool = fakePool([{ role: 'user', streak_hours: 0 }])
    const c = createCooldownController({ pool, now: clock })
    await c.check('Alice')
    await c.check('Alice')
    await c.check('Alice')
    assert.equal(pool.calls, 1, 'le cache doit éviter de réinterroger la base')
  })

  it('recharge le rôle après expiration du cache (2 min)', async () => {
    const pool = fakePool([{ role: 'user', streak_hours: 0 }])
    const c = createCooldownController({ pool, now: clock })
    await c.check('Alice')
    clock.advance(2 * 60 * 1000 + 1)
    await c.check('Alice')
    assert.equal(pool.calls, 2)
  })

  it('invalidate force le rechargement immédiat', async () => {
    const pool = fakePool([{ role: 'user', streak_hours: 0 }])
    const c = createCooldownController({ pool, now: clock })
    await c.check('Alice')
    c.invalidate('Alice')
    await c.check('Alice')
    assert.equal(pool.calls, 2)
  })

  it('retombe sur le cooldown le plus strict si la base est indisponible', async () => {
    const c = createCooldownController({ pool: brokenPool, now: clock })
    const res = await c.check('Alice')
    assert.equal(res.wait, 0, 'la première pose reste autorisée')
    assert.equal(res.cooldownMs, 60_000, 'sans base, on applique le cooldown par défaut')
    assert.equal((await c.check('Alice')).wait, 60_000, 'et on ne laisse pas poser sans limite')
  })

  it('traite un joueur inconnu comme un user ordinaire', async () => {
    const c = createCooldownController({ pool: fakePool([]), now: clock })
    assert.equal((await c.check('Fantome')).cooldownMs, 60_000)
  })

  it('sweep purge les entrées expirées sans affecter les récentes', async () => {
    const c = createCooldownController({ pool: fakePool([{ role: 'user', streak_hours: 0 }]), now: clock })
    await c.check('Ancien')
    clock.advance(120_001)
    await c.check('Recent')
    c.sweep()

    // « Ancien » a été purgé : sa prochaine pose repart sans attente
    assert.equal((await c.check('Ancien')).wait, 0)
    // « Recent » est toujours suivi
    assert.ok((await c.check('Recent')).wait > 0)
  })
})
