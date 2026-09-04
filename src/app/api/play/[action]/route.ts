import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, questionAttempts, questions, reviewItems, stationProgress, stations, topics, users, type QuestionAnswer } from "@/db/schema";
import { apiUser, unauthorized } from "@/lib/auth";
import {
  checkAnswer,
  evaluateBadges,
  getUnlockState,
  isTopicUnlocked,
  levelFromXp,
  touchDailyStreak,
  updateReviewItem,
  type ResponsePayload,
} from "@/lib/gamification";

export const dynamic = "force-dynamic";

export type PlayQuestion = {
  id: number;
  type: "mcq" | "fill" | "tf" | "reorder";
  prompt: string;
  difficulty: number;
  options: string[];
  items?: { idx: number; text: string }[];
  stationTitle?: string;
};

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toPlayQuestion(q: typeof questions.$inferSelect, stationTitle?: string): PlayQuestion {
  const base: PlayQuestion = { id: q.id, type: q.type, prompt: q.prompt, difficulty: q.difficulty, options: [], stationTitle };
  if (q.type === "mcq") base.options = q.options;
  if (q.type === "reorder") {
    let items = q.options.map((text, idx) => ({ idx, text }));
    // ensure not already in correct order
    for (let tries = 0; tries < 5; tries++) {
      items = shuffle(items);
      if (items.some((it, i) => it.idx !== i)) break;
    }
    base.items = items;
  }
  return base;
}

function correctDisplay(q: typeof questions.$inferSelect): string | string[] {
  const a = q.answer as QuestionAnswer;
  if ("index" in a) return q.options[a.index] ?? "";
  if ("value" in a) return a.value ? "صحیح" : "غلط";
  if ("accepted" in a) return a.accepted[0] ?? "";
  if ("order" in a) return a.order.map((i) => q.options[i]);
  return "";
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { action } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  /* ---------- START ---------- */
  if (action === "start") {
    const mode = body.mode === "review" ? "review" : "station";

    if (mode === "review") {
      const due = await db
        .select({ q: questions, st: stations.title })
        .from(reviewItems)
        .innerJoin(questions, eq(questions.id, reviewItems.questionId))
        .innerJoin(stations, eq(stations.id, questions.stationId))
        .where(and(eq(reviewItems.userId, user.id), lte(reviewItems.dueAt, new Date())))
        .orderBy(asc(reviewItems.dueAt))
        .limit(10);
      if (due.length === 0) return Response.json({ error: "سؤالی برای مرور وجود ندارد" }, { status: 404 });
      const [att] = await db.insert(attempts).values({ userId: user.id, stationId: null, mode: "review", total: due.length }).returning({ id: attempts.id });
      return Response.json({ attemptId: att.id, mode, questions: due.map((d) => toPlayQuestion(d.q, d.st)) });
    }

    const stationId = Number(body.stationId);
    const [st] = await db.select().from(stations).where(eq(stations.id, stationId));
    if (!st) return Response.json({ error: "ایستگاه یافت نشد" }, { status: 404 });
    if (user.role !== "admin") {
      const topicOk = await isTopicUnlocked(user.id, st.topicId);
      const state = await getUnlockState(user.id, st.topicId);
      const me = state.find((s) => s.id === stationId);
      if (!topicOk || !me?.unlocked) return Response.json({ error: "این ایستگاه هنوز قفل است" }, { status: 403 });
    }
    const qs = await db.select().from(questions).where(eq(questions.stationId, stationId)).orderBy(asc(questions.sortOrder), asc(questions.id));
    if (qs.length === 0) return Response.json({ error: "این ایستگاه هنوز سؤالی ندارد" }, { status: 404 });
    const [att] = await db.insert(attempts).values({ userId: user.id, stationId, mode: "station", total: qs.length }).returning({ id: attempts.id });
    return Response.json({ attemptId: att.id, mode, questions: qs.map((q) => toPlayQuestion(q)) });
  }

  /* ---------- ANSWER ---------- */
  if (action === "answer") {
    const attemptId = Number(body.attemptId);
    const questionId = Number(body.questionId);
    const response = (body.response ?? {}) as ResponsePayload;
    const [att] = await db.select().from(attempts).where(and(eq(attempts.id, attemptId), eq(attempts.userId, user.id)));
    if (!att || att.finishedAt) return Response.json({ error: "جلسهٔ نامعتبر" }, { status: 400 });
    const [q] = await db.select().from(questions).where(eq(questions.id, questionId));
    if (!q) return Response.json({ error: "سؤال یافت نشد" }, { status: 404 });
    const [dup] = await db
      .select({ id: questionAttempts.id, isCorrect: questionAttempts.isCorrect })
      .from(questionAttempts)
      .where(and(eq(questionAttempts.attemptId, attemptId), eq(questionAttempts.questionId, questionId)));
    if (dup) return Response.json({ correct: dup.isCorrect, explanation: q.explanation, correctAnswer: correctDisplay(q), duplicate: true });

    const correct = checkAnswer(q.type, q.answer as QuestionAnswer, response);
    await db.insert(questionAttempts).values({ userId: user.id, questionId, attemptId, isCorrect: correct });
    await updateReviewItem(user.id, questionId, correct);
    return Response.json({ correct, explanation: q.explanation, correctAnswer: correctDisplay(q) });
  }

  /* ---------- FINISH ---------- */
  if (action === "finish") {
    const attemptId = Number(body.attemptId);
    const [att] = await db.select().from(attempts).where(and(eq(attempts.id, attemptId), eq(attempts.userId, user.id)));
    if (!att) return Response.json({ error: "جلسهٔ نامعتبر" }, { status: 400 });
    if (att.finishedAt) return Response.json({ error: "این جلسه قبلاً پایان یافته" }, { status: 400 });

    const qa = await db
      .select({ isCorrect: questionAttempts.isCorrect, difficulty: questions.difficulty })
      .from(questionAttempts)
      .innerJoin(questions, eq(questions.id, questionAttempts.questionId))
      .where(eq(questionAttempts.attemptId, attemptId))
      .orderBy(asc(questionAttempts.id));

    let score = 0;
    let xp = 0;
    let streak = 0;
    let bestStreak = 0;
    const perCorrect = att.mode === "review" ? 6 : 10;
    for (const r of qa) {
      if (r.isCorrect) {
        score++;
        streak++;
        bestStreak = Math.max(bestStreak, streak);
        xp += perCorrect * r.difficulty;
        if (streak >= 3) xp += 5;
      } else streak = 0;
    }
    const total = att.total || qa.length;
    let passed = false;
    let bonus = 0;
    let firstPass = false;

    if (att.mode === "station" && att.stationId) {
      const [st] = await db.select().from(stations).where(eq(stations.id, att.stationId));
      passed = total > 0 && (score / total) * 100 >= (st?.passPercent ?? 70);
      const [prog] = await db
        .select()
        .from(stationProgress)
        .where(and(eq(stationProgress.userId, user.id), eq(stationProgress.stationId, att.stationId)));
      if (passed) {
        firstPass = !prog?.completed;
        bonus = firstPass ? (st?.xpReward ?? 50) : Math.round((st?.xpReward ?? 50) * 0.25);
        xp += bonus;
      }
      if (prog) {
        const better = prog.bestTotal === 0 || score / total > prog.bestScore / prog.bestTotal;
        await db
          .update(stationProgress)
          .set({
            bestScore: better ? score : prog.bestScore,
            bestTotal: better ? total : prog.bestTotal,
            completed: prog.completed || passed,
            attemptsCount: prog.attemptsCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(stationProgress.id, prog.id));
      } else {
        await db.insert(stationProgress).values({ userId: user.id, stationId: att.stationId, bestScore: score, bestTotal: total, completed: passed, attemptsCount: 1 });
      }
    } else {
      passed = total > 0 && score / total >= 0.5;
    }

    const [before] = await db.select({ xp: users.xp }).from(users).where(eq(users.id, user.id));
    const prevLevel = levelFromXp(before?.xp ?? 0);
    await db.update(users).set({ xp: sql`${users.xp} + ${xp}` }).where(eq(users.id, user.id));
    await touchDailyStreak(user.id);
    await db.update(attempts).set({ score, total, passed, xpEarned: xp, bestStreak, finishedAt: new Date() }).where(eq(attempts.id, attemptId));

    const newBadges = await evaluateBadges(user.id, { sessionBestStreak: bestStreak, perfect: att.mode === "station" && total > 0 && score === total, passed });
    const [after] = await db.select({ xp: users.xp, currentStreak: users.currentStreak }).from(users).where(eq(users.id, user.id));
    const newLevel = levelFromXp(after?.xp ?? 0);

    // next station suggestion
    let nextStationId: number | null = null;
    if (att.mode === "station" && att.stationId && passed) {
      const [st] = await db.select().from(stations).where(eq(stations.id, att.stationId));
      if (st) {
        const state = await getUnlockState(user.id, st.topicId);
        const idx = state.findIndex((s) => s.id === st.id);
        nextStationId = state[idx + 1]?.id ?? null;
        if (!nextStationId) {
          // first station of the next topic
          const [t] = await db.select().from(topics).where(eq(topics.id, st.topicId));
          if (t) {
            const sib = await db.select().from(topics).where(and(eq(topics.categoryId, t.categoryId), eq(topics.isPublished, true))).orderBy(topics.sortOrder, topics.id);
            const ti = sib.findIndex((x) => x.id === t.id);
            const nextTopic = sib[ti + 1];
            if (nextTopic) {
              const [first] = await db.select().from(stations).where(eq(stations.topicId, nextTopic.id)).orderBy(stations.sortOrder, stations.id).limit(1);
              nextStationId = first?.id ?? null;
            }
          }
        }
      }
    }

    // remaining review count
    const remaining = await db
      .select({ id: reviewItems.id })
      .from(reviewItems)
      .where(and(eq(reviewItems.userId, user.id), lte(reviewItems.dueAt, new Date())));

    return Response.json({
      score,
      total,
      passed,
      xpEarned: xp,
      bonus,
      firstPass,
      bestStreak,
      totalXp: after?.xp ?? 0,
      dailyStreak: after?.currentStreak ?? 0,
      levelUp: newLevel > prevLevel ? newLevel : null,
      newBadges,
      nextStationId,
      reviewRemaining: remaining.length,
    });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

// ensure unused import warnings don't trip lint
void inArray;
