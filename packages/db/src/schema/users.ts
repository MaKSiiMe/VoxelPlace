import { pgTable, serial, varchar, timestamp, index } from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id:           serial('id').primaryKey(),
    username:     varchar('username', { length: 32 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 72 }).notNull(),
    source:       varchar('source', { length: 20 }).notNull().default('web'),
    createdAt:    timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_users_username').on(table.username),
  ]
)
