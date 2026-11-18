import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { adminPasswordProblem, ADMIN_PASSWORD_MIN_LENGTH } from '../src/features/admin/password-policy.js'

const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url))
const STRONG     = 'k3Jx9vQpL2mZt8Rw' // exactement 16 caractères

describe('adminPasswordProblem', () => {
  it('accepte un secret de 16 caractères ou plus', () => {
    assert.equal(STRONG.length, ADMIN_PASSWORD_MIN_LENGTH)
    assert.equal(adminPasswordProblem(STRONG), null)
    assert.equal(adminPasswordProblem(STRONG + STRONG), null)
  })

  it('refuse la valeur d\'exemple « changeme », quelle que soit sa casse', () => {
    for (const value of ['changeme', 'ChangeMe', ' changeme ']) {
      assert.match(adminPasswordProblem(value), /changeme/)
    }
  })

  it('refuse un secret de moins de 16 caractères', () => {
    assert.match(adminPasswordProblem(STRONG.slice(0, 15)), /trop court/)
  })

  it('refuse une valeur absente ou vide', () => {
    assert.match(adminPasswordProblem(undefined), /manquant/)
    assert.match(adminPasswordProblem(''), /manquant/)
  })

  it('ne recopie jamais le secret dans le message', () => {
    const short = 'SecretCourt42'
    assert.ok(!adminPasswordProblem(short).includes(short))
  })
})

describe('démarrage de l\'API', () => {
  // Le contrôle a lieu avant toute connexion à Redis ou PostgreSQL : le
  // process doit sortir seul, sans base ni Redis disponibles.
  const start = (adminPassword) => spawnSync(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: 'production',
      BRIDGE_TOKEN: 'jeton_de_pont_de_test',
      ...(adminPassword === undefined ? {} : { ADMIN_PASSWORD: adminPassword }),
    },
    encoding: 'utf8',
    timeout: 15000,
  })

  it('refuse de démarrer avec ADMIN_PASSWORD=changeme', () => {
    const run = start('changeme')
    assert.equal(run.status, 1, run.stderr)
    assert.match(run.stdout + run.stderr, /valeur d'exemple « changeme »/)
  })

  it('refuse de démarrer avec un ADMIN_PASSWORD trop court', () => {
    const run = start('court')
    assert.equal(run.status, 1, run.stderr)
    assert.match(run.stdout + run.stderr, /ADMIN_PASSWORD trop court/)
    assert.ok(!(run.stdout + run.stderr).includes('"court"'), 'le secret ne doit pas apparaître dans les logs')
  })

  it('refuse de démarrer sans ADMIN_PASSWORD', () => {
    const run = start(undefined)
    assert.equal(run.status, 1, run.stderr)
    assert.match(run.stdout + run.stderr, /ADMIN_PASSWORD manquant/)
  })
})
