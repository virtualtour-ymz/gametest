import { and, count, eq, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  badges,
  categories,
  questionAttempts,
  reviewItems,
  stationProgress,
  stations,
  topics,
  userBadges,
  users,
  type QuestionAnswer,
} from "@/db/schema";

export { levelFromXp, xpForLevel, levelProgress, levelTitle, LEVEL_TITLES } from "./levels";
import { levelFromXp } from "./levels";

/* ---------- Answer checking ---------- */
export function normalizeText(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\u064A]/g, "\u06CC") // Arabic yeh → Persian yeh
    .replace(/[\u0643]/g, "\u06A9") // Arabic kaf → Persian kaf
    .replace(/[\u200c\u200f\u200e]/g, "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[\s\-_.،,]+/g, " ")
    .trim();
}

export type ResponsePayload = { index?: number; text?: string; value?: boolean; order?: number[] };

export function checkAnswer(type: string, answer: QuestionAnswer, response: ResponsePayload): boolean {
  switch (type) {
    case "mcq":
      return "index" in answer && response.index === answer.index;
    case "tf":
      return "value" in answer && response.value === answer.value;
    case "fill": {
      if (!("accepted" in answer) || typeof response.text !== "string") return false;
      const given = normalizeText(response.text);
      return answer.accepted.some((a) => normalizeText(a) === given);
    }
    case "reorder": {
      if (!("order" in answer) || !Array.isArray(response.order)) return false;
      return (
        response.order.length === answer.order.length &&
        response.order.every((v, i) => v === answer.order[i])
      );
    }
    default:
      return false;
  }
}

/* ---------- Streaks ---------- */
function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function touchDailyStreak(userId: number) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return;
  const today = toDateKey(new Date());
  if (u.lastActiveDate === today) return;
  const yesterday = toDateKey(new Date(Date.now() - 86400_000));
  const nextStreak = u.lastActiveDate === yesterday ? u.currentStreak + 1 : 1;
  await db
    .update(users)
    .set({
      currentStreak: nextStreak,
      longestStreak: Math.max(u.longestStreak, nextStreak),
      lastActiveDate: today,
    })
    .where(eq(users.id, userId));
}

/* ---------- Spaced repetition ---------- */
const INTERVALS = [1, 3, 7, 14, 30];

export async function updateReviewItem(userId: number, questionId: number, isCorrect: boolean) {
  const [existing] = await db
    .select()
    .from(reviewItems)
    .where(and(eq(reviewItems.userId, userId), eq(reviewItems.questionId, questionId)));
  const now = new Date();
  if (!isCorrect) {
    if (existing) {
      await db
        .update(reviewItems)
        .set({ wrongCount: existing.wrongCount + 1, correctStreak: 0, intervalDays: 0, dueAt: now, updatedAt: now })
        .where(eq(reviewItems.id, existing.id));
    } else {
      await db.insert(reviewItems).values({ userId, questionId, wrongCount: 1, correctStreak: 0, intervalDays: 0, dueAt: now });
    }
    return;
  }
  if (existing) {
    const streak = existing.correctStreak + 1;
    const interval = INTERVALS[Math.min(streak - 1, INTERVALS.length - 1)];
    await db
      .update(reviewItems)
      .set({
        correctStreak: streak,
        intervalDays: interval,
        dueAt: new Date(now.getTime() + interval * 86400_000),
        updatedAt: now,
      })
      .where(eq(reviewItems.id, existing.id));
  }
}

/* ---------- Badges ---------- */
export const BADGE_DEFS = [
  { key: "first_step", name: "اولین قدم", description: "اولین ایستگاه را با موفقیت گذراندید", icon: "🎯", color: "#10b981" },
  { key: "perfectionist", name: "بی‌نقص", description: "یک ایستگاه را با نمرهٔ کامل به پایان رساندید", icon: "💎", color: "#06b6d4" },
  { key: "hot_streak", name: "دست گرم", description: "۸ پاسخ صحیح پیاپی در یک جلسه", icon: "🔥", color: "#f97316" },
  { key: "week_warrior", name: "جنگجوی هفته", description: "۷ روز پیاپی تمرین کردید", icon: "📅", color: "#8b5cf6" },
  { key: "scholar", name: "دانش‌پژوه", description: "به سطح ۵ رسیدید", icon: "🎓", color: "#6366f1" },
  { key: "reviewer", name: "مرورگر حرفه‌ای", description: "۲۰ سؤال را در حالت مرور پاسخ دادید", icon: "🔁", color: "#ec4899" },
  { key: "category_master", name: "استاد دسته", description: "تمام ایستگاه‌های یک دسته را کامل کردید", icon: "🏆", color: "#f59e0b" },
  { key: "xp_1000", name: "هزارتایی", description: "۱۰۰۰ امتیاز تجربه جمع کردید", icon: "⚡", color: "#eab308" },
  { key: "ten_stations", name: "ده ایستگاه", description: "۱۰ ایستگاه را کامل کردید", icon: "🏥", color: "#14b8a6" },
];

export async function ensureBadges() {
  for (const b of BADGE_DEFS) {
    await db.insert(badges).values(b).onConflictDoNothing({ target: badges.key });
  }
}

type BadgeContext = { sessionBestStreak?: number; perfect?: boolean; passed?: boolean };

/** Evaluate all badge rules for a user; returns newly-earned badges. */
export async function evaluateBadges(userId: number, ctx: BadgeContext = {}) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return [];
  const allBadges = await db.select().from(badges);
  const owned = await db.select({ badgeId: userBadges.badgeId }).from(userBadges).where(eq(userBadges.userId, userId));
  const ownedIds = new Set(owned.map((o) => o.badgeId));
  const byKey = new Map(allBadges.map((b) => [b.key, b]));

  const [{ completedCount }] = await db
    .select({ completedCount: count() })
    .from(stationProgress)
    .where(and(eq(stationProgress.userId, userId), eq(stationProgress.completed, true)));

  const [{ reviewCount }] = await db
    .select({ reviewCount: count() })
    .from(questionAttempts)
    .innerJoin(sql`attempts`, sql`attempts.id = ${questionAttempts.attemptId}`)
    .where(and(eq(questionAttempts.userId, userId), sql`attempts.mode = 'review'`));

  // category mastery
  const totals = await db
    .select({ categoryId: topics.categoryId, total: count() })
    .from(stations)
    .innerJoin(topics, eq(topics.id, stations.topicId))
    .groupBy(topics.categoryId);
  const done = await db
    .select({ categoryId: topics.categoryId, done: count() })
    .from(stationProgress)
    .innerJoin(stations, eq(stations.id, stationProgress.stationId))
    .innerJoin(topics, eq(topics.id, stations.topicId))
    .where(and(eq(stationProgress.userId, userId), eq(stationProgress.completed, true)))
    .groupBy(topics.categoryId);
  const doneMap = new Map(done.map((d) => [d.categoryId, Number(d.done)]));
  const categoryMastered = totals.some((t) => Number(t.total) > 0 && (doneMap.get(t.categoryId) ?? 0) >= Number(t.total));

  const rules: Record<string, boolean> = {
    first_step: Number(completedCount) >= 1,
    perfectionist: !!ctx.perfect,
    hot_streak: (ctx.sessionBestStreak ?? 0) >= 8,
    week_warrior: u.currentStreak >= 7 || u.longestStreak >= 7,
    scholar: levelFromXp(u.xp) >= 5,
    reviewer: Number(reviewCount) >= 20,
    category_master: categoryMastered,
    xp_1000: u.xp >= 1000,
    ten_stations: Number(completedCount) >= 10,
  };

  const earned: (typeof allBadges)[number][] = [];
  for (const [key, ok] of Object.entries(rules)) {
    const b = byKey.get(key);
    if (!b || !ok || ownedIds.has(b.id)) continue;
    await db.insert(userBadges).values({ userId, badgeId: b.id }).onConflictDoNothing();
    earned.push(b);
  }
  return earned;
}

/* ---------- Unlock logic ---------- */
export async function getUnlockState(userId: number, topicId: number) {
  const list = await db.select().from(stations).where(eq(stations.topicId, topicId)).orderBy(stations.sortOrder, stations.id);
  const ids = list.map((s) => s.id);
  const prog = ids.length
    ? await db
        .select()
        .from(stationProgress)
        .where(and(eq(stationProgress.userId, userId), inArray(stationProgress.stationId, ids)))
    : [];
  const progMap = new Map(prog.map((p) => [p.stationId, p]));
  let prevDone = true;
  return list.map((s) => {
    const p = progMap.get(s.id);
    const unlocked = prevDone;
    prevDone = !!p?.completed;
    return { ...s, progress: p ?? null, unlocked };
  });
}

export async function isTopicUnlocked(userId: number, topicId: number) {
  const [t] = await db.select().from(topics).where(eq(topics.id, topicId));
  if (!t) return false;
  const siblings = await db
    .select()
    .from(topics)
    .where(and(eq(topics.categoryId, t.categoryId), eq(topics.isPublished, true)))
    .orderBy(topics.sortOrder, topics.id);
  const idx = siblings.findIndex((s) => s.id === topicId);
  if (idx <= 0) return true;
  const prev = siblings[idx - 1];
  const prevStations = await db.select({ id: stations.id }).from(stations).where(eq(stations.topicId, prev.id));
  if (prevStations.length === 0) return true;
  const [{ c }] = await db
    .select({ c: count() })
    .from(stationProgress)
    .where(
      and(
        eq(stationProgress.userId, userId),
        eq(stationProgress.completed, true),
        inArray(
          stationProgress.stationId,
          prevStations.map((s) => s.id),
        ),
      ),
    );
  return Number(c) >= prevStations.length;
}

export { categories };
