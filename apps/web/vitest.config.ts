import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@shared':   path.resolve(__dirname, './shared'),
      '@features': path.resolve(__dirname, './features'),
    },
  },
})
