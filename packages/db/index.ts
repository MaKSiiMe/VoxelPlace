import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as canvasSchema from './src/schema/canvas'
import * as usersSchema from './src/schema/users'

export const schema = { ...canvasSchema, ...usersSchema }

// Fonctionne avec Docker PostgreSQL ET Neon (même driver)
// Docker  : postgresql://voxelplace:changeme@localhost:5432/voxelplace
// Neon    : postgresql://user:pass@ep-xxx.neon.tech/voxelplace?sslmode=require
export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 10 })
  return drizzle(client, { schema })
}

export * from './src/schema/canvas'
export * from './src/schema/users'
export type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
