// Tests de la présence des joueurs connectés.
//
// Régressions couvertes :
//   · les visiteurs sans compte n'étaient plus comptés en ligne depuis que
//     l'identité se prouve au handshake ;
//   · fermer un onglet effaçait la correspondance pseudo → socket d'un autre
//     onglet du même joueur, qui ne recevait plus ses notifications.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { registerPresence, unregisterPresence, presencePayload } from '../src/features/players/presence.js'

let players, sockets
beforeEach(() => { players = new Map(); sockets = new Map() })

describe('registerPresence', () => {
  it('compte un visiteur sans compte comme présent sur le web, sans pseudo', () => {
    registerPresence(players, sockets, 's1', null)
    assert.deepEqual(presencePayload(players), { count: 1, byPlatform: { web: 1 } })
    assert.equal(players.get('s1').username, null)
    assert.equal(sockets.size, 0, 'un visiteur ne reçoit aucune notification ciblée')
  })

  it('enregistre un joueur identifié et sa correspondance pseudo → socket', () => {
    registerPresence(players, sockets, 's1', { username: 'Alice', source: 'web' })
    assert.equal(sockets.get('alice'), 's1')
  })

  it('compte par plateforme', () => {
    registerPresence(players, sockets, 's1', { username: 'Alice', source: 'web' })
    registerPresence(players, sockets, 's2', { username: 'MC-Server', source: 'minecraft' })
    registerPresence(players, sockets, 's3', null)
    assert.deepEqual(presencePayload(players), { count: 3, byPlatform: { web: 2, minecraft: 1 } })
  })
})

describe('unregisterPresence', () => {
  it('retire le joueur et sa correspondance', () => {
    registerPresence(players, sockets, 's1', { username: 'Alice', source: 'web' })
    unregisterPresence(players, sockets, 's1')
    assert.equal(players.size, 0)
    assert.equal(sockets.size, 0)
  })

  it('préserve la correspondance d\'un autre onglet du même joueur', () => {
    registerPresence(players, sockets, 'onglet-1', { username: 'Alice', source: 'web' })
    registerPresence(players, sockets, 'onglet-2', { username: 'Alice', source: 'web' })

    unregisterPresence(players, sockets, 'onglet-1')   // fermeture du premier onglet

    assert.equal(sockets.get('alice'), 'onglet-2',
      'l\'onglet encore ouvert doit continuer de recevoir les notifications')
  })

  it('retire un visiteur sans erreur', () => {
    registerPresence(players, sockets, 's1', null)
    assert.doesNotThrow(() => unregisterPresence(players, sockets, 's1'))
    assert.equal(players.size, 0)
  })

  it('ignore un socket inconnu', () => {
    assert.doesNotThrow(() => unregisterPresence(players, sockets, 'fantome'))
  })
})
