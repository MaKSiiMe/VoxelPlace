// ── Application Fastify de test ──────────────────────────────────────────────
// Monte un serveur Fastify vierge et y enregistre les features demandées, avec
// les mêmes dépendances qu'en production (pool PostgreSQL réel, Redis de test).
//
// Les requêtes passent par fastify.inject() : pas de port, pas de réseau, mais
// le vrai cycle Fastify (routage, parsing, sérialisation, codes de statut).

import Fastify from 'fastify'
import cors from '@fastify/cors'

export const TEST_JWT_SECRET = 'secret_de_test_uniquement'

/**
 * @param {Function[]} features  fonctions xxxRoutes(fastify, deps)
 * @param {object}     deps      dépendances à leur transmettre
 */
export async function buildTestApp(features, deps = {}) {
  const fastify = Fastify({ logger: false })
  await fastify.register(cors, { origin: true })
  for (const feature of features) {
    await feature(fastify, { jwtSecret: TEST_JWT_SECRET, JWT_SECRET: TEST_JWT_SECRET, ...deps })
  }
  await fastify.ready()
  return fastify
}

/** En-têtes d'une requête émise par le front (la vérification CSRF l'exige). */
export const BROWSER_HEADERS = {
  'content-type':     'application/json',
  'x-requested-with': 'XMLHttpRequest',
}

export function authHeaders(token) {
  return { ...BROWSER_HEADERS, authorization: `Bearer ${token}` }
}
