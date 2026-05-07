CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meeting_ratings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"meeting_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meeting_ratings" ADD CONSTRAINT "meeting_ratings_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meeting_ratings" ADD CONSTRAINT "meeting_ratings_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;
