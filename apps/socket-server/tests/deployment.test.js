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
import { spawnSync } from 'node:child_process'
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

  it('applique les changements de nginx.conf, que « up -d » ne recrée pas', () => {
    // nginx.conf est monté en volume : modifier le fichier ne change pas la
    // définition du service, donc « docker compose up -d » laisse le conteneur
    // tourner avec l'ancienne configuration. Le correctif de /health est ainsi
    // resté sans effet.
    const compose = read('docker-compose.yml')
    if (!/nginx\.conf:\/etc\/nginx/.test(compose)) return  // plus monté : rien à recharger

    const script = workflow.slice(workflow.indexOf('script: |'))
      .split('\n').filter(l => !l.trim().startsWith('#')).join('\n')
    assert.match(script, /--force-recreate voxelplace-nginx|restart voxelplace-nginx|nginx -s reload/,
      'le déploiement doit recharger nginx quand sa configuration change')
    assert.match(script, /nginx -t/,
      'la configuration doit être validée avant d\'être appliquée')
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

describe('scripts npm', () => {
  const pkg = JSON.parse(read('package.json'))

  it('ne cible que des chemins présents dans le dépôt', () => {
    // .gitignore contient tools/ : le dossier existe sur la machine de
    // développement mais pas sur un dépôt cloné. Un script qui le vise passe
    // en local et fait échouer la CI, où ESLint sort en erreur sur un motif
    // sans correspondance.
    const tracked = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    if (tracked.status !== 0) return  // hors dépôt Git : rien à vérifier

    const files = tracked.stdout.split('\n').filter(Boolean)
    const isTracked = (p) => files.some(f => f === p || f.startsWith(`${p}/`))

    // Seuls les outils d'analyse sont concernés : ils échouent sur un motif
    // sans correspondance. Une commande comme « rm -rf node_modules » vise
    // légitimement un chemin non versionné.
    const ANALYSERS = /^(eslint|tsc|vitest|prettier)\b/

    for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
      if (!ANALYSERS.test(command.trim())) continue
      for (const arg of command.split(/\s+/).slice(1)) {
        if (arg.startsWith('-') || arg.includes('=') || arg.includes('*')) continue
        if (!existsSync(join(ROOT, arg))) continue  // pas un chemin local
        assert.ok(
          isTracked(arg),
          `le script "${name}" cible "${arg}", qui n'est pas versionné — il échouera en CI`
        )
      }
    }
  })
})

describe('versions Node', () => {
  it('teste et déploie sur la même version majeure', () => {
    // La CI validait sur Node 22 pendant que la production tournait sur Node 20 :
    // du code vérifié sur une version partait s'exécuter sur une autre.
    const workflow = read('.github/workflows/deploy.yml')
    const ciVersions = new Set(
      [...workflow.matchAll(/node-version:\s*'?(\d+)/g)].map(m => m[1])
    )
    assert.equal(ciVersions.size, 1, `la CI utilise plusieurs versions : ${[...ciVersions].join(', ')}`)
    const ci = [...ciVersions][0]

    for (const dockerfile of ['apps/socket-server/Dockerfile', 'apps/web/Dockerfile']) {
      for (const [, version] of read(dockerfile).matchAll(/FROM node:(\d+)/g)) {
        assert.equal(version, ci, `${dockerfile} construit sur Node ${version}, la CI teste sur Node ${ci}`)
      }
    }
  })
})

describe('nginx', () => {
  const nginx = read('nginx.conf')

  it('route vers l\'API tout ce qu\'elle sert, /health compris', () => {
    // /health vit sur l'API mais n'est pas sous /api/ : sans entrée dédiée,
    // nginx l'envoie au frontend, qui répond par sa page 404.
    for (const path of ['/api/', '/socket.io/', '/health']) {
      const block = new RegExp(`location\\s*=?\\s*${path.replace(/\//g, '\\/')}\\s*\\{[^}]*proxy_pass\\s+http:\\/\\/api`)
      assert.match(nginx, block, `${path} doit être proxifié vers l'API`)
    }
  })

  it('conserve les en-têtes de mise à niveau WebSocket pour Socket.io', () => {
    const socketBlock = nginx.slice(nginx.indexOf('location /socket.io/'))
    assert.match(socketBlock, /proxy_set_header\s+Upgrade\s+\$http_upgrade/)
    assert.match(socketBlock, /proxy_set_header\s+Connection\s+"upgrade"/)
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
