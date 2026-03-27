import { pgTable, bigserial, smallint, varchar, timestamp, index } from 'drizzle-orm/pg-core'

// Table append-only : chaque pose de pixel = une ligne
// Utilisée pour heatmap, timelapse, stats, git-blame pixel
export const pixelHistory = pgTable(
  'pixel_history',
  {
    id:       bigserial('id', { mode: 'number' }).primaryKey(),
    x:        smallint('x').notNull(),
    y:        smallint('y').notNull(),
    colorId:  smallint('color_id').notNull(),
    username: varchar('username', { length: 32 }),
    source:   varchar('source', { length: 20 }),
    placedAt: timestamp('placed_at').notNull().defaultNow(),
  },
  (table) => [
    index('idx_ph_coords').on(table.x, table.y),
    index('idx_ph_placed_at').on(table.placedAt),
    index('idx_ph_username').on(table.username),
  ]
)
