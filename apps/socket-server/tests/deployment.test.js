// Vérifications statiques de l'infrastructure de déploiement.
//
// Ces tests ne lancent rien : ils relisent les fichiers de déploiement pour
// interdire les pannes déjà rencontrées en production. Chacun correspond à un
// incident réel :
//
//   · un COPY de Dockerfile pointant un fichier renommé
//   · une CI qui teste sans construire, laissant partir un build cassé
//   · un script de déploiement sans set -e, qui redémarre l'image précédente
//     et se déclare en succès
//   · une base de données publiée sur toutes les interfaces
//   · une image Redis rétrogradée, incapable de relire ses propres données

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

describe('Dockerfiles', () => {
  it('ne copie que des fichiers qui existent réellement', () => {
    for (const dockerfile of ['apps/socket-server/Dockerfile', 'apps/web/Dockerfile']) {
      const content = read(dockerfile)
      for (const line of content.split('\n')) {
        const match = line.match(/^COPY\s+(?!--from)(.+)$/)
        if (!match) continue

        // Dernier argument = destination ; les précédents sont les sources
        const parts = match[1].trim().split(/\s+/)
        for (const source of parts.slice(0, -1)) {
          // On ignore les motifs génériques : leur résolution appartient à Docker
          if (source.includes('*') || source === '.') continue
          assert.ok(
            existsSync(join(ROOT, source)),
            `${dockerfile} copie "${source}", qui n'existe pas`
          )
        }
      }
    }
  })

  it('lance le backend depuis le point d\'entrée réel', () => {
    const content = read('apps/socket-server/Dockerfile')
    assert.match(content, /CMD \["node", "src\/index\.js"\]/)
    assert.ok(existsSync(join(ROOT, 'apps/socket-server/src/index.js')))
  })

  it('interroge une route de santé que le serveur expose vraiment', () => {
    const dockerfile = read('apps/socket-server/Dockerfile')
    const route = dockerfile.match(/HEALTHCHECK[\s\S]*?localhost:3001(\/[\w/-]*)/)?.[1]
    assert.ok(route, 'le Dockerfile doit définir un HEALTHCHECK')

    // La route doit être déclarée quelque part dans les sources du backend
    const declared = ['src/features/health/routes.js', 'src/index.js']
      .some(f => existsSync(join(ROOT, 'apps/socket-server', f))
              && read(join('apps/socket-server', f)).includes(`'${route}'`))
    assert.ok(declared, `le HEALTHCHECK interroge ${route}, qu'aucune route ne déclare`)
  })
})

describe('docker-compose', () => {
  const compose = read('docker-compose.yml')

  it('ne publie ni PostgreSQL ni Redis sur toutes les interfaces', () => {
    // Un mapping "5432:5432" écoute sur 0.0.0.0 ; seul un préfixe 127.0.0.1 est admis.
    const exposed = [...compose.matchAll(/^\s*-\s*"(\d+):(\d+)"/gm)].map(m => m[1])
    for (const port of ['5432', '6379']) {
      assert.ok(
        !exposed.includes(port),
        `le port ${port} est publié sur toutes les interfaces — le binder sur 127.0.0.1`
      )
    }
  })

  it('épingle Redis à une version, jamais latest', () => {
    const image = compose.match(/image:\s*(redis:[\w.-]+)/)?.[1]
    assert.ok(image, 'aucune image Redis trouvée')
    assert.ok(!image.includes('latest'), 'redis:latest rend la version déployée imprévisible')

    // Rétrograder Redis rend le RDB existant illisible : le service ne démarre plus.
    const major = parseInt(image.split(':')[1], 10)
    assert.ok(major >= 8, `Redis ${major} est antérieur aux données en production (v8)`)
  })

  it('déclare la dépendance de l\'API à ses deux bases', () => {
    const api = compose.slice(compose.indexOf('voxelplace-api:'), compose.indexOf('voxelplace-web:'))
    assert.match(api, /voxelplace-db:/,    'depends_on doit mentionner PostgreSQL')
    assert.match(api, /voxelplace-redis:/, 'depends_on doit mentionner Redis')
  })

  it('documente dans .env.example toutes les variables qu\'il attend', () => {
    const example = read('.env.example')
    const used = new Set(
      [...compose.matchAll(/\$\{([A-Z_][A-Z0-9_]*)(?::-[^}]*)?\}/g)].map(m => m[1])
    )
    for (const name of used) {
      // Les variables à valeur par défaut (${X:-y}) sont facultatives
      const hasDefault = new RegExp(`\\$\\{${name}:-`).test(compose)
      if (hasDefault) continue
      assert.ok(
        example.includes(`${name}=`),
        `${name} est requis par docker-compose mais absent de .env.example`
      )
    }
  })
})

describe('pipeline CI/CD', () => {
  const workflow = read('.github/workflows/deploy.yml')

  it('construit le frontend, et pas seulement ses tests', () => {
    // Les tests ne type-checkent pas : sans build, une erreur TypeScript passe
    // la CI et ne casse qu'au moment du docker build, sur le serveur.
    assert.match(workflow, /npm run build --workspace=apps\/web/,
      'la CI doit construire le frontend avant de déployer')
  })

  it('bloque le déploiement si le lint ou les tests échouent', () => {
    const needs = workflow.match(/needs:\s*\[([^\]]+)\]/)?.[1] ?? ''
    for (const job of ['lint', 'test-backend', 'test-frontend']) {
      assert.ok(needs.includes(job), `le job deploy doit dépendre de ${job}`)
    }
  })

  it('exécute le lint du backend', () => {
    assert.match(workflow, /npm run lint:backend/,
      'ESLint est ce qui attrape les identifiants utilisés sans import')
  })

  it('fait tourner les tests backend contre un vrai PostgreSQL', () => {
    assert.match(workflow, /image:\s*postgres:16/,
      'les requêtes analytiques ne sont pas reproductibles sans vrai PostgreSQL')
    assert.match(workflow, /TEST_DATABASE_URL/)
  })

  it('interrompt le script de déploiement à la première erreur', () => {
    const script = workflow.slice(workflow.indexOf('script: |'))
    assert.match(script, /set -e/,
      'sans set -e, un build raté laisse redémarrer l\'image précédente en silence')
  })

  it('ne dépend pas de sudo, indisponible dans un shell SSH sans terminal', () => {
    const script = workflow.slice(workflow.indexOf('script: |'))
    // Les commentaires du script sont exclus : ils expliquent justement
    // pourquoi sudo a été retiré.
    const code = script
      .split('\n')
      .filter(line => !line.trim().startsWith('#'))
      .join('\n')
    assert.ok(!/\bsudo\b/.test(code),
      'sudo ne peut pas demander de mot de passe ici : utiliser docker cp')
  })
})

describe('configuration', () => {
  it('documente dans .env.example les secrets lus par le backend', () => {
    const example = read('.env.example')
    for (const name of ['JWT_SECRET', 'ADMIN_PASSWORD']) {
      assert.ok(example.includes(`${name}=`), `${name} doit figurer dans .env.example`)
    }
  })

  it('garde .env hors du dépôt', () => {
    assert.match(read('.gitignore'), /^\.env$/m)
  })
})
