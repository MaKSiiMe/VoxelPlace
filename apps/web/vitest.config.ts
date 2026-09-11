import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // tsconfig laisse le JSX intact (« preserve ») pour que Next le transforme.
  // Vitest ne passe pas par Next : on lui demande le runtime JSX automatique
  // de React, sans quoi les tests de composants .tsx ne se chargent pas.
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  test: {
    // Par défaut en Node ; les tests de composants déclarent « @vitest-environment jsdom »
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@shared':   path.resolve(__dirname, './shared'),
      '@features': path.resolve(__dirname, './features'),
    },
  },
})
