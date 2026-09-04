import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, questions, topics } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getUnlockState, isTopicUnlocked } from "@/lib/gamification";
import { EmptyState, fa } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TopicPage({ params }: { params: Promise<{ topicId: string }> }) {
  const user = await requireUser();
  const { topicId } = await params;
  const id = Number(topicId);
  if (!Number.isFinite(id)) notFound();
  const [row] = await db
    .select({ topic: topics, category: categories })
    .from(topics)
    .innerJoin(categories, eq(categories.id, topics.categoryId))
    .where(eq(topics.id, id));
  if (!row) notFound();
  const { topic, category } = row;

  const unlockedTopic = await isTopicUnlocked(user.id, id);
  const list = await getUnlockState(user.id, id);
  const qCounts = list.length
    ? await db
        .select({ stationId: questions.stationId, c: count() })
        .from(questions)
        .where(inArray(questions.stationId, list.map((s) => s.id)))
        .groupBy(questions.stationId)
    : [];
  const qMap = new Map(qCounts.map((q) => [q.stationId, Number(q.c)]));
  const doneCount = list.filter((s) => s.progress?.completed).length;

  return (
    <div className="animate-fade-up">
      <nav className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/learn" className="hover:text-brand-600">مسیر یادگیری</Link>
        <span>›</span>
        <span className="flex items-center gap-1"><span>{category.icon}</span>{category.name}</span>
        <span>›</span>
        <span className="font-semibold text-slate-800">{topic.title}</span>
      </nav>

      <div className="card mb-6 flex flex-wrap items-center gap-4 p-6" style={{ borderTop: `4px solid ${category.color}` }}>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">{topic.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{topic.description}</p>
        </div>
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-2xl font-black" style={{ color: category.color }}>{fa(doneCount)}/{fa(list.length)}</p>
            <p className="text-xs text-slate-500">ایستگاه کامل</p>
          </div>
        </div>
      </div>

      {!unlockedTopic ? (
        <EmptyState icon="🔒" title="این مبحث هنوز قفل است" description="برای باز شدن این مبحث، ابتدا تمام ایستگاه‌های مبحث قبلی را کامل کنید." action={{ href: "/learn", label: "بازگشت به مسیر" }} />
      ) : list.length === 0 ? (
        <EmptyState icon="🏗️" title="ایستگاهی تعریف نشده" description="این مبحث هنوز ایستگاه بالینی ندارد." action={{ href: "/learn", label: "بازگشت" }} />
      ) : (
        <ol className="relative space-y-4 before:absolute before:bottom-6 before:right-[22px] before:top-6 before:w-0.5 before:bg-slate-200">
          {list.map((s, i) => {
            const p = s.progress;
            const done = !!p?.completed;
            const pct = p && p.bestTotal ? Math.round((p.bestScore / p.bestTotal) * 100) : 0;
            return (
              <li key={s.id} className="relative pr-14">
                <div
                  className={`absolute right-0 top-4 grid h-11 w-11 place-items-center rounded-full border-4 border-slate-50 text-sm font-black text-white shadow ${!s.unlocked ? "bg-slate-300" : ""}`}
                  style={s.unlocked ? { background: done ? "#10b981" : category.color } : undefined}
                >
                  {done ? "✓" : s.unlocked ? fa(i + 1) : "🔒"}
                </div>
                <div className={`card p-5 ${!s.unlocked ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-extrabold">{s.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{s.scenario}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        <span className="chip bg-slate-100 text-slate-600">❓ {fa(qMap.get(s.id) ?? 0)} سؤال</span>
                        <span className="chip bg-amber-50 text-amber-700">⚡ {fa(s.xpReward)} XP پاداش</span>
                        <span className="chip bg-slate-100 text-slate-600">🎯 حد قبولی {fa(s.passPercent)}٪</span>
                        {p && <span className={`chip ${done ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>بهترین نتیجه {fa(pct)}٪ · {fa(p.attemptsCount)} تلاش</span>}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {s.unlocked ? (
                        <Link href={`/station/${s.id}`} className={done ? "btn-secondary" : "btn-primary"}>
                          {done ? "تمرین مجدد" : p ? "تلاش دوباره" : "شروع ایستگاه ▶"}
                        </Link>
                      ) : (
                        <span className="chip bg-slate-100 text-slate-500">ایستگاه قبلی را کامل کنید</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
