CREATE SCHEMA "m4mom3q0m8bw2p9w93urcjeb9x2y4dna";
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."checkins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"personal_good_news" text,
	"professional_good_news" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."headlines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"submitter_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"escalated_to_ids" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."issues" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"submitter_id" uuid NOT NULL,
	"source_team_id" uuid NOT NULL,
	"target_dept_id" uuid NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to_id" uuid,
	"meeting_id" uuid,
	"escalate_to_leadership" boolean DEFAULT false NOT NULL,
	"resolution_notes" text,
	"sop_link" text,
	"is_fathom_source" boolean DEFAULT false NOT NULL,
	"clickup_task_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"team_id" uuid NOT NULL,
	"type" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"host_id" uuid,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"fathom_url" text,
	"meeting_rating_avg" real,
	"summary_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rock_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"rock_id" uuid NOT NULL,
	"meeting_id" uuid,
	"status" text NOT NULL,
	"comment" text,
	"changed_by_id" uuid NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rocks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"team_id" uuid NOT NULL,
	"level" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"quarter" integer NOT NULL,
	"year" integer NOT NULL,
	"parent_rock_id" uuid,
	"status" text DEFAULT 'on_track' NOT NULL,
	"clickup_task_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."teams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."todos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"assigned_to_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"meeting_id" uuid,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"carry_over_reason" text,
	"linked_rock_id" uuid,
	"acknowledged_at" timestamp,
	"clickup_task_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"team_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."vto" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"core_values" jsonb,
	"core_focus" jsonb,
	"ten_year_target" text,
	"three_year_picture" jsonb,
	"one_year_plan" jsonb,
	"marketing_strategy" jsonb,
	"three_uniques" jsonb,
	"proven_process" jsonb,
	"last_reviewed_at" timestamp,
	"reviewed_by_id" uuid,
	"leadership_session_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."checkins" ADD CONSTRAINT "checkins_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."checkins" ADD CONSTRAINT "checkins_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."headlines" ADD CONSTRAINT "headlines_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."headlines" ADD CONSTRAINT "headlines_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."issues" ADD CONSTRAINT "issues_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."issues" ADD CONSTRAINT "issues_source_team_id_teams_id_fk" FOREIGN KEY ("source_team_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."issues" ADD CONSTRAINT "issues_target_dept_id_teams_id_fk" FOREIGN KEY ("target_dept_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."issues" ADD CONSTRAINT "issues_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."issues" ADD CONSTRAINT "issues_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings" ADD CONSTRAINT "meetings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings" ADD CONSTRAINT "meetings_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rock_status_history" ADD CONSTRAINT "rock_status_history_rock_id_rocks_id_fk" FOREIGN KEY ("rock_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rock_status_history" ADD CONSTRAINT "rock_status_history_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rock_status_history" ADD CONSTRAINT "rock_status_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rocks" ADD CONSTRAINT "rocks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rocks" ADD CONSTRAINT "rocks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rocks" ADD CONSTRAINT "rocks_parent_rock_id_rocks_id_fk" FOREIGN KEY ("parent_rock_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."todos" ADD CONSTRAINT "todos_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."todos" ADD CONSTRAINT "todos_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."todos" ADD CONSTRAINT "todos_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."todos" ADD CONSTRAINT "todos_linked_rock_id_rocks_id_fk" FOREIGN KEY ("linked_rock_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."rocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users" ADD CONSTRAINT "users_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."vto" ADD CONSTRAINT "vto_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."vto" ADD CONSTRAINT "vto_leadership_session_id_meetings_id_fk" FOREIGN KEY ("leadership_session_id") REFERENCES "m4mom3q0m8bw2p9w93urcjeb9x2y4dna"."meetings"("id") ON DELETE no action ON UPDATE no action;