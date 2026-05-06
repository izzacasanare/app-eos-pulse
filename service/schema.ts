/**
 * EOS Pulse — Drizzle Schema
 *
 * All tables live inside pgSchema(APP_ID) — never the public schema.
 * APP_ID sourced from manifest.id in package.json.
 *
 * Import only from domain/ — never from handlers/ or server.ts.
 */

import {
  pgSchema,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  date,
  jsonb,
  real,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import crypto from "node:crypto";

const APP_ID = "m4mom3q0m8bw2p9w93urcjeb9x2y4dna";

export const appSchema = pgSchema(APP_ID);

const defaultId = () => uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt  = () => timestamp("created_at").notNull().defaultNow();
const updatedAt  = () => timestamp("updated_at").notNull().defaultNow();

// ---------------------------------------------------------------------------
// teams
// ---------------------------------------------------------------------------

export const teams = appSchema.table("teams", {
  id:        defaultId(),
  name:      text("name").notNull(),
  type:      text("type").notNull(),             // 'l10' | 'quarterly' | 'both'
  createdAt: createdAt(),
});

export type Team    = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = appSchema.table("users", {
  id:        defaultId(),
  name:      text("name").notNull(),
  email:     text("email").notNull().unique(),
  role:      text("role").notNull(),             // 'super_admin' | 'leadership' | 'team_lead' | 'host' | 'member'
  teamId:    uuid("team_id").references(() => teams.id),
  createdAt: createdAt(),
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// meetings
// ---------------------------------------------------------------------------

export const meetings = appSchema.table("meetings", {
  id:                defaultId(),
  teamId:            uuid("team_id").notNull().references(() => teams.id),
  type:              text("type").notNull(),             // 'l10' | 'quarterly'
  scheduledAt:       timestamp("scheduled_at").notNull(),
  startedAt:         timestamp("started_at"),
  hostId:            uuid("host_id").references(() => users.id),
  status:            text("status").notNull().default("upcoming"), // 'upcoming' | 'live' | 'pending_close' | 'closed'
  fathomUrl:         text("fathom_url"),
  meetingRatingAvg:  real("meeting_rating_avg"),
  summarySentAt:     timestamp("summary_sent_at"),
  createdAt:         createdAt(),
});

export type Meeting    = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;

// ---------------------------------------------------------------------------
// meeting_segments
// ---------------------------------------------------------------------------

export const meetingSegments = appSchema.table("meeting_segments", {
  id:          defaultId(),
  meetingId:   uuid("meeting_id").notNull().references(() => meetings.id),
  segmentName: text("segment_name").notNull(),
  startedAt:   timestamp("started_at").notNull().defaultNow(),
  endedAt:     timestamp("ended_at"),
});

export type MeetingSegment    = typeof meetingSegments.$inferSelect;
export type NewMeetingSegment = typeof meetingSegments.$inferInsert;

// ---------------------------------------------------------------------------
// checkins
// ---------------------------------------------------------------------------

export const checkins = appSchema.table("checkins", {
  id:                   defaultId(),
  memberId:             uuid("member_id").notNull().references(() => users.id),
  meetingId:            uuid("meeting_id").notNull().references(() => meetings.id),
  personalGoodNews:     text("personal_good_news"),
  professionalGoodNews: text("professional_good_news"),
  submittedAt:          timestamp("submitted_at").notNull().defaultNow(),
});

export type Checkin    = typeof checkins.$inferSelect;
export type NewCheckin = typeof checkins.$inferInsert;

// ---------------------------------------------------------------------------
// headlines
// ---------------------------------------------------------------------------

export const headlines = appSchema.table("headlines", {
  id:              defaultId(),
  submitterId:     uuid("submitter_id").notNull().references(() => users.id),
  meetingId:       uuid("meeting_id").notNull().references(() => meetings.id),
  category:        text("category").notNull(),   // 'absence' | 'headcount' | 'closed_won' | 'cancellation' | 'general'
  content:         text("content").notNull(),
  escalatedToIds:  boolean("escalated_to_ids").notNull().default(false),
  submittedAt:     timestamp("submitted_at").notNull().defaultNow(),
});

export type Headline    = typeof headlines.$inferSelect;
export type NewHeadline = typeof headlines.$inferInsert;

// ---------------------------------------------------------------------------
// rocks
// ---------------------------------------------------------------------------

export const rocks = appSchema.table("rocks", {
  id:            defaultId(),
  title:         text("title").notNull(),
  teamId:        uuid("team_id").notNull().references(() => teams.id),
  level:         text("level").notNull(),        // 'company' | 'dept' | 'individual'
  ownerId:       uuid("owner_id").notNull().references(() => users.id),
  quarter:       integer("quarter").notNull(),
  year:          integer("year").notNull(),
  parentRockId:  uuid("parent_rock_id").references((): AnyPgColumn => rocks.id),
  status:        text("status").notNull().default("on_track"), // 'on_track' | 'off_track' | 'at_risk' | 'blocked' | 'on_hold' | 'completed'
  clickupTaskId: text("clickup_task_id"),
  createdAt:     createdAt(),
  updatedAt:     updatedAt(),
});

export type Rock    = typeof rocks.$inferSelect;
export type NewRock = typeof rocks.$inferInsert;

// ---------------------------------------------------------------------------
// rock_status_history
// ---------------------------------------------------------------------------

export const rockStatusHistory = appSchema.table("rock_status_history", {
  id:          defaultId(),
  rockId:      uuid("rock_id").notNull().references(() => rocks.id),
  meetingId:   uuid("meeting_id").references(() => meetings.id),
  status:      text("status").notNull(),         // mirrors rocks.status values
  comment:     text("comment"),
  changedById: uuid("changed_by_id").notNull().references(() => users.id),
  changedAt:   timestamp("changed_at").notNull().defaultNow(),
});

export type RockStatusHistory    = typeof rockStatusHistory.$inferSelect;
export type NewRockStatusHistory = typeof rockStatusHistory.$inferInsert;

// ---------------------------------------------------------------------------
// issues
// ---------------------------------------------------------------------------

export const issues = appSchema.table("issues", {
  id:                    defaultId(),
  title:                 text("title").notNull(),
  description:           text("description"),
  submitterId:           uuid("submitter_id").notNull().references(() => users.id),
  sourceTeamId:          uuid("source_team_id").notNull().references(() => teams.id),
  targetDeptId:          uuid("target_dept_id").notNull().references(() => teams.id),
  priority:              text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high' | 'critical'
  status:                text("status").notNull().default("open"),     // 'open' | 'assigned' | 'in_progress' | 'pending_closure' | 'closed'
  assignedToId:          uuid("assigned_to_id").references(() => users.id),
  meetingId:             uuid("meeting_id").references(() => meetings.id),
  escalateToLeadership:  boolean("escalate_to_leadership").notNull().default(false),
  resolutionNotes:       text("resolution_notes"),
  sopLink:               text("sop_link"),
  isFathomSource:        boolean("is_fathom_source").notNull().default(false),
  clickupTaskId:         text("clickup_task_id"),
  createdAt:             createdAt(),
  updatedAt:             updatedAt(),
});

export type Issue    = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;

// ---------------------------------------------------------------------------
// todos
// ---------------------------------------------------------------------------

export const todos = appSchema.table("todos", {
  id:               defaultId(),
  title:            text("title").notNull(),
  assignedToId:     uuid("assigned_to_id").notNull().references(() => users.id),
  teamId:           uuid("team_id").notNull().references(() => teams.id),
  meetingId:        uuid("meeting_id").references(() => meetings.id),
  dueDate:          date("due_date"),
  status:           text("status").notNull().default("open"), // 'open' | 'done' | 'blocked' | 'carried'
  carryOverReason:  text("carry_over_reason"),
  linkedRockId:     uuid("linked_rock_id").references(() => rocks.id),
  acknowledgedAt:   timestamp("acknowledged_at"),
  clickupTaskId:    text("clickup_task_id"),
  createdAt:        createdAt(),
  updatedAt:        updatedAt(),
});

export type Todo    = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

/**
 * Key-value store for app configuration.
 * Keys: CLICKUP_API_KEY, CLICKUP_IDS_LIST_ID, CLICKUP_ROCKS_LIST_ID,
 *       CLICKUP_TODOS_LIST_ID, IDS_SYNC_ENABLED, ROCKS_SYNC_ENABLED,
 *       TODOS_SYNC_ENABLED, TEAMS_WEBHOOK_URL
 */
export const settings = appSchema.table("settings", {
  id:        defaultId(),
  key:       text("key").notNull().unique(),
  value:     text("value"),
  updatedAt: updatedAt(),
});

export type Setting    = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

// ---------------------------------------------------------------------------
// vto
// ---------------------------------------------------------------------------

export const vto = appSchema.table("vto", {
  id:                  defaultId(),
  version:             integer("version").notNull().default(1),
  coreValues:          jsonb("core_values"),
  coreFocus:           jsonb("core_focus"),
  tenYearTarget:       text("ten_year_target"),
  threeYearPicture:    jsonb("three_year_picture"),
  oneYearPlan:         jsonb("one_year_plan"),
  marketingStrategy:   jsonb("marketing_strategy"),
  threeUniques:        jsonb("three_uniques"),
  provenProcess:       jsonb("proven_process"),
  lastReviewedAt:      timestamp("last_reviewed_at"),
  reviewedById:        uuid("reviewed_by_id").references(() => users.id),
  leadershipSessionId: uuid("leadership_session_id").references(() => meetings.id),
  createdAt:           createdAt(),
});

export type Vto    = typeof vto.$inferSelect;
export type NewVto = typeof vto.$inferInsert;
