-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE IF NOT EXISTS "pixel_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"color_id" smallint NOT NULL,
	"username" varchar(32),
	"source" varchar(20),
	"placed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(32) NOT NULL,
	"password_hash" varchar(72) NOT NULL,
	"source" varchar(20) DEFAULT 'web' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_key" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ph_coords" ON "pixel_history" USING btree ("x" int2_ops,"y" int2_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ph_placed_at" ON "pixel_history" USING btree ("placed_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ph_username" ON "pixel_history" USING btree ("username" text_ops);
*/