import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { stationProgress, stations, topics } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getCategoryProgress } from "@/lib/queries";
import { EmptyState, PageHeader, RadialChart, fa } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LearnPage() {
  const user = await requireUser();
  const cats = await getCategoryProgress(user.id);
  const allTopics = await db.select().from(topics).where(eq(topics.isPublished, true)).orderBy(topics.sortOrder, topics.id);
  const stationTotals = await db.select({ topicId: stations.topicId, c: count() }).from(stations).groupBy(stations.topicId);
  const stationDone = await db
    .select({ topicId: stations.topicId, c: count() })
    .from(stationProgress)
    .innerJoin(stations, eq(stations.id, stationProgress.stationId))
    .where(and(eq(stationProgress.userId, user.id), eq(stationProgress.completed, true)))
    .groupBy(stations.topicId);
  const totalMap = new Map(stationTotals.map((s) => [s.topicId, Number(s.c)]));
  const doneMap = new Map(stationDone.map((s) => [s.topicId, Number(s.c)]));

  return (
    <div className="animate-fade-up">
      <PageHeader title="مسیر یادگیری" subtitle="دسته‌ها را انتخاب کنید، مبحث‌ها را به ترتیب باز کنید و ایستگاه‌های بالینی را بگذرانید." />

      {cats.length === 0 ? (
        <EmptyState icon="🗺️" title="هنوز مسیری تعریف نشده" description="به‌زودی دسته‌ها و مبحث‌ها اضافه می‌شوند." />
      ) : (
        <div className="space-y-8">
          {cats.map((c) => {
            const ts = allTopics.filter((t) => t.categoryId === c.id);
            let prevDone = true;
            return (
              <section key={c.id} id={`cat-${c.id}`} className="card overflow-hidden">
                <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 p-5" style={{ background: `linear-gradient(90deg, ${c.color}14, transparent)` }}>
                  <RadialChart percent={c.percent} color={c.color} size={72} stroke={8} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{c.icon}</span>
                      <h2 className="text-lg font-extrabold">{c.name}</h2>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{c.description}</p>
                  </div>
                  <div className="text-left text-xs text-slate-500">
                    <p>{fa(ts.length)} مبحث</p>
                    <p>{fa(c.completed)} / {fa(c.total)} ایستگاه</p>
                  </div>
                </div>
                {ts.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500">این دسته هنوز مبحثی ندارد.</p>
                ) : (
                  <ol className="grid gap-3 p-4 sm:grid-cols-2">
                    {ts.map((t, i) => {
                      const total = totalMap.get(t.id) ?? 0;
                      const done = doneMap.get(t.id) ?? 0;
                      const unlocked = prevDone;
                      prevDone = total === 0 || done >= total;
                      const complete = total > 0 && done >= total;
                      const pct = total ? Math.round((done / total) * 100) : 0;
                      const inner = (
                        <div className={`relative flex h-full items-center gap-3 rounded-xl border p-4 transition ${unlocked ? "border-slate-200 bg-white hover:-translate-y-0.5 hover:shadow-md" : "border-dashed border-slate-200 bg-slate-50 opacity-70"}`}>
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black text-white" style={{ background: unlocked ? c.color : "#94a3b8" }}>
                            {complete ? "✓" : unlocked ? fa(i + 1) : "🔒"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{t.title}</p>
                            <p className="truncate text-xs text-slate-500">{t.description}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                              </div>
                              <span className="text-[11px] text-slate-500">{fa(done)}/{fa(total)}</span>
                            </div>
                          </div>
                        </div>
                      );
                      return (
                        <li key={t.id}>
                          {unlocked ? <Link href={`/learn/${t.id}`}>{inner}</Link> : <div title="ابتدا مبحث قبلی را کامل کنید">{inner}</div>}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
