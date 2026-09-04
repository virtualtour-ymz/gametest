import { eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, stations } from "@/db/schema";
import { guardAdmin, validateQuestion } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

/**
 * Bulk import. Body: { stationId?: number, items: Array<{ stationId?: number, type, prompt, options?, answer, explanation?, difficulty? }> }
 * Each item may override stationId. Validates everything first; inserts atomically only if all valid (unless `partial: true`).
 */
export async function POST(req: Request) {
  const g = await guardAdmin();
  if ("error" in g) return g.error;
  const body = (await req.json().catch(() => null)) as { stationId?: number; items?: unknown; partial?: boolean } | null;
  if (!body || !Array.isArray(body.items)) return Response.json({ error: "فرمت ورودی نامعتبر است؛ آرایهٔ items لازم است" }, { status: 400 });

  const stationIds = new Set((await db.select({ id: stations.id }).from(stations)).map((s) => s.id));
  const errors: { index: number; error: string }[] = [];
  const valid: { stationId: number; value: ReturnType<typeof validateQuestion> extends infer R ? (R extends { ok: true; value: infer V } ? V : never) : never }[] = [];

  (body.items as unknown[]).forEach((raw, i) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const sid = Number(item.stationId ?? body.stationId);
    if (!sid || !stationIds.has(sid)) {
      errors.push({ index: i, error: `ایستگاه با شناسهٔ ${item.stationId ?? body.stationId ?? "—"} وجود ندارد` });
      return;
    }
    const v = validateQuestion(item);
    if (!v.ok) errors.push({ index: i, error: v.error });
    else valid.push({ stationId: sid, value: v.value });
  });

  if (errors.length && !body.partial) {
    return Response.json({ error: "برخی ردیف‌ها نامعتبرند؛ هیچ سؤالی وارد نشد", errors, imported: 0 }, { status: 400 });
  }

  let imported = 0;
  for (const v of valid) {
    const existing = await db.select({ id: questions.id }).from(questions).where(eq(questions.stationId, v.stationId));
    await db.insert(questions).values({ stationId: v.stationId, ...v.value, sortOrder: existing.length });
    imported++;
  }
  return Response.json({ imported, errors });
}
