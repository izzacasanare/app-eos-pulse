CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
