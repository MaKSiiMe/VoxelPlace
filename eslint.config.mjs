import globals from 'globals'

/**
 * Configuration ESLint — cible le backend et les outils Node.
 *
 * Le front est couvert par `next lint` et par le type-check TypeScript ; le
 * backend, lui, est du JavaScript sans étape de compilation : rien ne vérifiait
 * qu'un identifiant utilisé était bien défini. C'est ainsi qu'un appel à
 * `verifyToken` sans import a pu partir en production et tuer le serveur à
 * chaque connexion authentifiée. La règle `no-undef` ci-dessous ferme cette
 * porte, et c'est la raison d'être principale de ce fichier.
 */
export default [
  {
    // tools/ est présent dans .gitignore : le linter sait le traiter si on le
    // vise à la main en local, mais le script npm ne doit pas le cibler — le
    // dossier n'existe pas sur un dépôt fraîchement cloné, et ESLint échoue
    // sur un motif qui ne correspond à rien.
    files: ['apps/socket-server/**/*.js', 'tools/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType:  'module',
      globals:     { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      'no-undef':          'error',
      'no-unused-vars':    ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-const-assign':   'error',
      'no-dupe-keys':      'error',
      'no-dupe-args':      'error',
      'no-duplicate-case': 'error',
      'no-unreachable':    'error',
      'no-fallthrough':    'error',
      'no-self-compare':   'error',
      'no-unsafe-negation':'error',
      'valid-typeof':      'error',
      'require-atomic-updates': 'warn',
      // Un `await` oublié sur une fonction async est indétectable sans types :
      // cette règle attrape le cas le plus courant (promesse jetée à la poubelle).
      'no-async-promise-executor': 'error',
    },
  },
  {
    files: ['apps/socket-server/tests/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
