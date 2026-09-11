// Tests de l'identité enregistrée à player:join.
//
// Régression couverte : le serveur enregistrait le pseudo annoncé par le
// client. Un visiteur pouvait se présenter sous le nom d'un autre joueur,
// parler en son nom, capter ses notifications et détourner son bannissement.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolvePlayerIdentity, BRIDGE_SOURCES } from '../src/features/auth/player-identity.js'

describe('resolvePlayerIdentity — joueur web', () => {
  it('enregistre le pseudo du jeton, pas celui annoncé', () => {
    const id = resolvePlayerIdentity({ username: 'Victime', source: 'web' }, { verifiedUsername: 'Alice' })
    assert.deepEqual(id, { username: 'Alice', source: 'web' })
  })

  it('ignore une plateforme annoncée pour se faire passer pour un pont', () => {
    const id = resolvePlayerIdentity({ username: 'Alice', source: 'minecraft' }, { verifiedUsername: 'Alice' })
    assert.equal(id.source, 'web')
  })

  it("n'enregistre rien pour un visiteur sans jeton", () => {
    assert.equal(resolvePlayerIdentity({ username: 'Alice', source: 'web' }, {}), null)
    assert.equal(resolvePlayerIdentity({ username: 'Admin' }), null)
  })
})

describe('resolvePlayerIdentity — pont de jeu authentifié', () => {
  it('reprend l\'identité déclarée par le pont', () => {
    const id = resolvePlayerIdentity({ username: 'MC-Server', source: 'minecraft' }, { isBridge: true })
    assert.deepEqual(id, { username: 'MC-Server', source: 'minecraft' })
  })

  it('assainit le pseudo déclaré', () => {
    const id = resolvePlayerIdentity({ username: '<script>Steve', source: 'minecraft' }, { isBridge: true })
    assert.equal(id.username, 'scriptSteve')
  })

  it('ramène une plateforme inconnue à minecraft', () => {
    assert.equal(resolvePlayerIdentity({ username: 'Bot', source: 'web' }, { isBridge: true }).source, 'minecraft')
  })

  it('refuse un pseudo absent ou vide', () => {
    assert.equal(resolvePlayerIdentity({ source: 'minecraft' }, { isBridge: true }), null)
    assert.equal(resolvePlayerIdentity({ username: '<>' }, { isBridge: true }), null)
  })

  it('connaît les plateformes de jeu prévues', () => {
    for (const s of ['minecraft', 'roblox', 'hytale']) assert.ok(BRIDGE_SOURCES.has(s))
    assert.ok(!BRIDGE_SOURCES.has('web'))
  })
})
