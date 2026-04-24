/**
 * EOS Pulse — Drizzle Schema
 *
 * Defines all database tables.
 * This file has NO runtime imports — Drizzle column helpers only.
 *
 * Import only from domain/ files — never from handlers/ or server.ts.
 *
 * All tables documented in: docs/data-model.md
 */

// TODO: Add drizzle-orm to deno.json imports, then uncomment below.
// import { pgTable, uuid, text, timestamptz, date, integer, jsonb, unique } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Placeholder type aliases — replace with Drizzle table definitions
// ---------------------------------------------------------------------------

// users
// export const users = pgTable("users", {
//   id:           uuid("id").primaryKey().defaultRandom(),
//   name:         text("name").notNull(),
//   email:        text("email").notNull().unique(),
//   teamId:       uuid("team_id").references(() => teams.id),
//   role:         text("role").notNull().default("member"),   // 'admin' | 'leader' | 'member'
//   teamsUserId:  text("teams_user_id"),
//   createdAt:    timestamptz("created_at").notNull().defaultNow(),
// });

// teams
// export const teams = pgTable("teams", {
//   id:        uuid("id").primaryKey().defaultRandom(),
//   name:      text("name").notNull(),
//   leadId:    uuid("lead_id").references(() => users.id),
//   createdAt: timestamptz("created_at").notNull().defaultNow(),
// });

// meetings
// export const meetings = pgTable("meetings", {
//   id:            uuid("id").primaryKey().defaultRandom(),
//   type:          text("type").notNull(),                          // 'l10' | 'leadership'
//   teamId:        uuid("team_id").references(() => teams.id).notNull(),
//   facilitatorId: uuid("facilitator_id").references(() => users.id),
//   scheduledAt:   timestamptz("scheduled_at").notNull(),
//   startedAt:     timestamptz("started_at"),
//   closedAt:      timestamptz("closed_at"),
//   status:        text("status").notNull().default("scheduled"),   // 'scheduled' | 'open' | 'closed'
//   agendaJson:    jsonb("agenda_json"),
//   notes:         text("notes"),
//   createdAt:     timestamptz("created_at").notNull().defaultNow(),
// });

// issues
// export const issues = pgTable("issues", {
//   id:              uuid("id").primaryKey().defaultRandom(),
//   meetingId:       uuid("meeting_id").references(() => meetings.id),
//   teamId:          uuid("team_id").references(() => teams.id).notNull(),
//   ownerId:         uuid("owner_id").references(() => users.id).notNull(),
//   title:           text("title").notNull(),
//   description:     text("description"),
//   status:          text("status").notNull().default("open"),      // 'open' | 'ids_in_progress' | 'resolved' | 'dropped'
//   resolutionNotes: text("resolution_notes"),                      // min 50 chars when resolved — enforced in domain
//   priority:        text("priority"),                             // 'low' | 'medium' | 'high'
//   createdAt:       timestamptz("created_at").notNull().defaultNow(),
//   resolvedAt:      timestamptz("resolved_at"),
// });

// rocks
// export const rocks = pgTable("rocks", {
//   id:          uuid("id").primaryKey().defaultRandom(),
//   ownerId:     uuid("owner_id").references(() => users.id).notNull(),
//   teamId:      uuid("team_id").references(() => teams.id).notNull(),
//   title:       text("title").notNull(),
//   description: text("description"),
//   quarter:     text("quarter").notNull(),                         // 'Q2-2025'
//   status:      text("status").notNull().default("on_track"),     // 'on_track' | 'off_track' | 'complete' | 'dropped'
//   dueDate:     date("due_date").notNull(),
//   createdAt:   timestamptz("created_at").notNull().defaultNow(),
// });

// rock_status_history  — APPEND ONLY
// export const rockStatusHistory = pgTable("rock_status_history", {
//   id:             uuid("id").primaryKey().defaultRandom(),
//   rockId:         uuid("rock_id").references(() => rocks.id).notNull(),
//   changedBy:      uuid("changed_by").references(() => users.id).notNull(),
//   previousStatus: text("previous_status").notNull(),
//   newStatus:      text("new_status").notNull(),
//   note:           text("note"),
//   changedAt:      timestamptz("changed_at").notNull().defaultNow(),
// });

// todos
// export const todos = pgTable("todos", {
//   id:          uuid("id").primaryKey().defaultRandom(),
//   meetingId:   uuid("meeting_id").references(() => meetings.id),
//   ownerId:     uuid("owner_id").references(() => users.id).notNull(),
//   title:       text("title").notNull(),
//   dueDate:     date("due_date"),
//   status:      text("status").notNull().default("open"),         // 'open' | 'complete' | 'dropped'
//   createdAt:   timestamptz("created_at").notNull().defaultNow(),
//   completedAt: timestamptz("completed_at"),
// });

// checkins
// export const checkins = pgTable("checkins", {
//   id:            uuid("id").primaryKey().defaultRandom(),
//   meetingId:     uuid("meeting_id").references(() => meetings.id).notNull(),
//   userId:        uuid("user_id").references(() => users.id).notNull(),
//   headline:      text("headline"),
//   scorecardData: jsonb("scorecard_data"),
//   submittedAt:   timestamptz("submitted_at").notNull().defaultNow(),
// }, (t) => ({
//   uniqueCheckin: unique().on(t.meetingId, t.userId),
// }));

// headlines
// export const headlines = pgTable("headlines", {
//   id:        uuid("id").primaryKey().defaultRandom(),
//   meetingId: uuid("meeting_id").references(() => meetings.id).notNull(),
//   userId:    uuid("user_id").references(() => users.id).notNull(),
//   text:      text("text").notNull(),
//   createdAt: timestamptz("created_at").notNull().defaultNow(),
// });

// vto
// export const vto = pgTable("vto", {
//   id:                uuid("id").primaryKey().defaultRandom(),
//   version:           integer("version").notNull(),
//   coreValues:        jsonb("core_values"),
//   coreFocus:         jsonb("core_focus"),
//   bhag:              text("bhag"),
//   marketingStrategy: jsonb("marketing_strategy"),
//   threeYearPicture:  jsonb("three_year_picture"),
//   oneYearPlan:       jsonb("one_year_plan"),
//   rocksQ:            jsonb("rocks_q"),
//   issuesList:        jsonb("issues_list"),
//   updatedBy:         uuid("updated_by").references(() => users.id),
//   updatedAt:         timestamptz("updated_at").notNull().defaultNow(),
// });

// ---------------------------------------------------------------------------
// Type exports (inferred from tables once schema is uncommented)
// ---------------------------------------------------------------------------

// export type User             = typeof users.$inferSelect;
// export type NewUser          = typeof users.$inferInsert;
// export type Team             = typeof teams.$inferSelect;
// export type Meeting          = typeof meetings.$inferSelect;
// export type NewMeeting       = typeof meetings.$inferInsert;
// export type Issue            = typeof issues.$inferSelect;
// export type NewIssue         = typeof issues.$inferInsert;
// export type Rock             = typeof rocks.$inferSelect;
// export type NewRock          = typeof rocks.$inferInsert;
// export type RockStatusHistory = typeof rockStatusHistory.$inferSelect;
// export type Todo             = typeof todos.$inferSelect;
// export type NewTodo          = typeof todos.$inferInsert;
// export type Checkin          = typeof checkins.$inferSelect;
// export type Headline         = typeof headlines.$inferSelect;
// export type Vto              = typeof vto.$inferSelect;

export const SCHEMA_PLACEHOLDER = "Replace commented tables with Drizzle definitions once drizzle-orm is in deno.json";
