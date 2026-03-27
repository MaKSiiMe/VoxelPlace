import { pgTable, index, bigserial, smallint, varchar, timestamp, unique, serial } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const pixelHistory = pgTable("pixel_history", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	x: smallint().notNull(),
	y: smallint().notNull(),
	colorId: smallint("color_id").notNull(),
	username: varchar({ length: 32 }),
	source: varchar({ length: 20 }),
	placedAt: timestamp("placed_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => {
	return {
		idxPhCoords: index("idx_ph_coords").using("btree", table.x.asc().nullsLast().op("int2_ops"), table.y.asc().nullsLast().op("int2_ops")),
		idxPhPlacedAt: index("idx_ph_placed_at").using("btree", table.placedAt.asc().nullsLast().op("timestamp_ops")),
		idxPhUsername: index("idx_ph_username").using("btree", table.username.asc().nullsLast().op("text_ops")),
	}
});

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: varchar({ length: 32 }).notNull(),
	passwordHash: varchar("password_hash", { length: 72 }).notNull(),
	source: varchar({ length: 20 }).default('web').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => {
	return {
		usersUsernameKey: unique("users_username_key").on(table.username),
	}
});
