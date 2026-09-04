import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, categories, stationProgress, stations, topics } from "@/db/schema";

export async function getCategoryProgress(userId: number) {
  const cats = await db.select().from(categories).orderBy(categories.sortOrder, categories.id);
  const totals = await db
    .select({ categoryId: topics.categoryId, total: count() })
    .from(stations)
    .innerJoin(topics, eq(topics.id, stations.topicId))
    .where(eq(topics.isPublished, true))
    .groupBy(topics.categoryId);
  const done = await db
    .select({ categoryId: topics.categoryId, done: count() })
    .from(stationProgress)
    .innerJoin(stations, eq(stations.id, stationProgress.stationId))
    .innerJoin(topics, eq(topics.id, stations.topicId))
    .where(and(eq(stationProgress.userId, userId), eq(stationProgress.completed, true)))
    .groupBy(topics.categoryId);
  const topicCounts = await db
    .select({ categoryId: topics.categoryId, c: count() })
    .from(topics)
    .where(eq(topics.isPublished, true))
    .groupBy(topics.categoryId);
  const tMap = new Map(totals.map((t) => [t.categoryId, Number(t.total)]));
  const dMap = new Map(done.map((d) => [d.categoryId, Number(d.done)]));
  const tcMap = new Map(topicCounts.map((d) => [d.categoryId, Number(d.c)]));
  return cats.map((c) => {
    const total = tMap.get(c.id) ?? 0;
    const completed = dMap.get(c.id) ?? 0;
    return { ...c, total, completed, topicCount: tcMap.get(c.id) ?? 0, percent: total ? Math.round((completed / total) * 100) : 0 };
  });
}

/** First station (by category/topic/station order) that the user hasn't completed yet. */
export async function getNextStation(userId: number) {
  const rows = await db
    .select({
      stationId: stations.id,
      stationTitle: stations.title,
      topicId: topics.id,
      topicTitle: topics.title,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      completed: sql<boolean>`coalesce(${stationProgress.completed}, false)`,
    })
    .from(stations)
    .innerJoin(topics, eq(topics.id, stations.topicId))
    .innerJoin(categories, eq(categories.id, topics.categoryId))
    .leftJoin(stationProgress, and(eq(stationProgress.stationId, stations.id), eq(stationProgress.userId, userId)))
    .where(eq(topics.isPublished, true))
    .orderBy(categories.sortOrder, categories.id, topics.sortOrder, topics.id, stations.sortOrder, stations.id);
  return rows.find((r) => !r.completed) ?? null;
}

export async function getRecentAttempts(userId: number, limit = 6) {
  return db
    .select({
      id: attempts.id,
      score: attempts.score,
      total: attempts.total,
      passed: attempts.passed,
      xpEarned: attempts.xpEarned,
      mode: attempts.mode,
      createdAt: attempts.createdAt,
      stationTitle: sql<string>`coalesce(${stations.title}, 'مرور هوشمند')`,
      topicTitle: sql<string>`coalesce(${topics.title}, '')`,
      color: sql<string>`coalesce(${categories.color}, '#ec4899')`,
    })
    .from(attempts)
    .leftJoin(stations, eq(stations.id, attempts.stationId))
    .leftJoin(topics, eq(topics.id, stations.topicId))
    .leftJoin(categories, eq(categories.id, topics.categoryId))
    .where(and(eq(attempts.userId, userId), sql`${attempts.finishedAt} is not null`))
    .orderBy(desc(attempts.createdAt))
    .limit(limit);
}

export function relativeTime(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "همین حالا";
  if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ساعت پیش`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} روز پیش`;
  return new Intl.DateTimeFormat("fa-IR").format(d);
}
