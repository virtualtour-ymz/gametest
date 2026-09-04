import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["student", "admin"]);
export const questionTypeEnum = pgEnum("question_type", ["mcq", "fill", "tf", "reorder"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("student"),
  avatarColor: text("avatar_color").notNull().default("#6366f1"),
  xp: integer("xp").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon").notNull().default("🩺"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
});

export const stations = pgTable("stations", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  scenario: text("scenario").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  xpReward: integer("xp_reward").notNull().default(50),
  passPercent: integer("pass_percent").notNull().default(70),
});

export type QuestionAnswer =
  | { index: number }
  | { accepted: string[] }
  | { value: boolean }
  | { order: number[] };

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    stationId: integer("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    type: questionTypeEnum("type").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    answer: jsonb("answer").$type<QuestionAnswer>().notNull(),
    explanation: text("explanation").notNull().default(""),
    difficulty: integer("difficulty").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("questions_station_idx").on(t.stationId)],
);

export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stationId: integer("station_id").references(() => stations.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("station"),
  score: integer("score").notNull().default(0),
  total: integer("total").notNull().default(0),
  passed: boolean("passed").notNull().default(false),
  xpEarned: integer("xp_earned").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questionAttempts = pgTable(
  "question_attempts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    attemptId: integer("attempt_id").references(() => attempts.id, { onDelete: "set null" }),
    isCorrect: boolean("is_correct").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("qa_question_idx").on(t.questionId), index("qa_user_idx").on(t.userId)],
);

export const stationProgress = pgTable(
  "station_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stationId: integer("station_id")
      .notNull()
      .references(() => stations.id, { onDelete: "cascade" }),
    bestScore: integer("best_score").notNull().default(0),
    bestTotal: integer("best_total").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    attemptsCount: integer("attempts_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("station_progress_unique").on(t.userId, t.stationId)],
);

export const reviewItems = pgTable(
  "review_items",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    wrongCount: integer("wrong_count").notNull().default(0),
    correctStreak: integer("correct_streak").notNull().default(0),
    intervalDays: integer("interval_days").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("review_items_unique").on(t.userId, t.questionId)],
);

export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull().default("#f59e0b"),
});

export const userBadges = pgTable(
  "user_badges",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    badgeId: integer("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_badges_unique").on(t.userId, t.badgeId)],
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  topics: many(topics),
}));
export const topicsRelations = relations(topics, ({ one, many }) => ({
  category: one(categories, { fields: [topics.categoryId], references: [categories.id] }),
  stations: many(stations),
}));
export const stationsRelations = relations(stations, ({ one, many }) => ({
  topic: one(topics, { fields: [stations.topicId], references: [topics.id] }),
  questions: many(questions),
}));
export const questionsRelations = relations(questions, ({ one }) => ({
  station: one(stations, { fields: [questions.stationId], references: [stations.id] }),
}));

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Station = typeof stations.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Badge = typeof badges.$inferSelect;
