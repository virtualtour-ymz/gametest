import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, questions, stations, topics, type QuestionAnswer } from "@/db/schema";
import { apiUser, forbidden, unauthorized } from "@/lib/auth";

export type Resource = "categories" | "topics" | "stations" | "questions";
const TABLES = { categories, topics, stations, questions } as const;

export function isResource(r: string): r is Resource {
  return r in TABLES;
}

export async function guardAdmin() {
  const user = await apiUser();
  if (!user) return { error: unauthorized() };
  if (user.role !== "admin") return { error: forbidden() };
  return { user };
}

export function slugify(s: string) {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || `cat-${Date.now()}`
  );
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateQuestion(raw: Record<string, unknown>): Result<{
  type: "mcq" | "fill" | "tf" | "reorder";
  prompt: string;
  options: string[];
  answer: QuestionAnswer;
  explanation: string;
  difficulty: number;
}> {
  const type = String(raw.type ?? "");
  const prompt = String(raw.prompt ?? "").trim();
  if (!prompt) return { ok: false, error: "متن سؤال الزامی است" };
  const explanation = String(raw.explanation ?? "");
  const difficulty = Math.min(3, Math.max(1, Number(raw.difficulty ?? 1) || 1));
  const opts = Array.isArray(raw.options) ? (raw.options as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : [];
  const ans = (raw.answer ?? {}) as Record<string, unknown>;

  if (type === "mcq") {
    if (opts.length < 2) return { ok: false, error: "سؤال چهارگزینه‌ای حداقل ۲ گزینه نیاز دارد" };
    const index = Number(ans.index);
    if (!Number.isInteger(index) || index < 0 || index >= opts.length) return { ok: false, error: "شمارهٔ گزینهٔ صحیح نامعتبر است" };
    return { ok: true, value: { type, prompt, options: opts, answer: { index }, explanation, difficulty } };
  }
  if (type === "tf") {
    if (typeof ans.value !== "boolean") return { ok: false, error: "پاسخ صحیح/غلط باید true یا false باشد" };
    return { ok: true, value: { type, prompt, options: [], answer: { value: ans.value }, explanation, difficulty } };
  }
  if (type === "fill") {
    const accepted = Array.isArray(ans.accepted) ? (ans.accepted as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : [];
    if (accepted.length === 0) return { ok: false, error: "حداقل یک پاسخ قابل‌قبول برای جای خالی لازم است" };
    return { ok: true, value: { type, prompt, options: [], answer: { accepted }, explanation, difficulty } };
  }
  if (type === "reorder") {
    if (opts.length < 2) return { ok: false, error: "مرتب‌سازی حداقل ۲ مرحله نیاز دارد" };
    // options are stored in the correct order; answer is identity
    return { ok: true, value: { type, prompt, options: opts, answer: { order: opts.map((_, i) => i) }, explanation, difficulty } };
  }
  return { ok: false, error: "نوع سؤال نامعتبر است" };
}

export async function createResource(resource: Resource, body: Record<string, unknown>) {
  switch (resource) {
    case "categories": {
      const name = String(body.name ?? "").trim();
      if (!name) return { error: "نام دسته الزامی است" };
      const [row] = await db
        .insert(categories)
        .values({
          name,
          slug: body.slug ? slugify(String(body.slug)) : slugify(name) + "-" + Date.now().toString(36),
          description: String(body.description ?? ""),
          color: String(body.color ?? "#6366f1"),
          icon: String(body.icon ?? "🩺"),
          sortOrder: Number(body.sortOrder ?? 0) || 0,
        })
        .returning();
      return { row };
    }
    case "topics": {
      const title = String(body.title ?? "").trim();
      const categoryId = Number(body.categoryId);
      if (!title || !categoryId) return { error: "عنوان و دسته الزامی است" };
      const [row] = await db
        .insert(topics)
        .values({ title, categoryId, description: String(body.description ?? ""), sortOrder: Number(body.sortOrder ?? 0) || 0, isPublished: body.isPublished !== false })
        .returning();
      return { row };
    }
    case "stations": {
      const title = String(body.title ?? "").trim();
      const topicId = Number(body.topicId);
      if (!title || !topicId) return { error: "عنوان و مبحث الزامی است" };
      const [row] = await db
        .insert(stations)
        .values({
          title,
          topicId,
          scenario: String(body.scenario ?? ""),
          sortOrder: Number(body.sortOrder ?? 0) || 0,
          xpReward: Number(body.xpReward ?? 50) || 50,
          passPercent: Math.min(100, Math.max(1, Number(body.passPercent ?? 70) || 70)),
        })
        .returning();
      return { row };
    }
    case "questions": {
      const stationId = Number(body.stationId);
      if (!stationId) return { error: "ایستگاه الزامی است" };
      const v = validateQuestion(body);
      if (!v.ok) return { error: v.error };
      const [row] = await db
        .insert(questions)
        .values({ stationId, ...v.value, sortOrder: Number(body.sortOrder ?? 0) || 0 })
        .returning();
      return { row };
    }
  }
}

export async function updateResource(resource: Resource, id: number, body: Record<string, unknown>) {
  switch (resource) {
    case "categories": {
      const patch: Partial<typeof categories.$inferInsert> = {};
      if (body.name !== undefined) patch.name = String(body.name).trim();
      if (body.description !== undefined) patch.description = String(body.description);
      if (body.color !== undefined) patch.color = String(body.color);
      if (body.icon !== undefined) patch.icon = String(body.icon);
      if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0;
      const [row] = await db.update(categories).set(patch).where(eq(categories.id, id)).returning();
      return { row };
    }
    case "topics": {
      const patch: Partial<typeof topics.$inferInsert> = {};
      if (body.title !== undefined) patch.title = String(body.title).trim();
      if (body.description !== undefined) patch.description = String(body.description);
      if (body.categoryId !== undefined) patch.categoryId = Number(body.categoryId);
      if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0;
      if (body.isPublished !== undefined) patch.isPublished = !!body.isPublished;
      const [row] = await db.update(topics).set(patch).where(eq(topics.id, id)).returning();
      return { row };
    }
    case "stations": {
      const patch: Partial<typeof stations.$inferInsert> = {};
      if (body.title !== undefined) patch.title = String(body.title).trim();
      if (body.scenario !== undefined) patch.scenario = String(body.scenario);
      if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0;
      if (body.xpReward !== undefined) patch.xpReward = Number(body.xpReward) || 50;
      if (body.passPercent !== undefined) patch.passPercent = Math.min(100, Math.max(1, Number(body.passPercent) || 70));
      const [row] = await db.update(stations).set(patch).where(eq(stations.id, id)).returning();
      return { row };
    }
    case "questions": {
      const v = validateQuestion(body);
      if (!v.ok) return { error: v.error };
      const patch: Partial<typeof questions.$inferInsert> = { ...v.value };
      if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder) || 0;
      const [row] = await db.update(questions).set(patch).where(eq(questions.id, id)).returning();
      return { row };
    }
  }
}

export async function deleteResource(resource: Resource, id: number) {
  const table = TABLES[resource];
  await db.delete(table).where(eq(table.id, id));
  return { ok: true };
}
