import { and, asc, count, desc, eq, gt, lte } from "drizzle-orm";
import { db } from "@/db";
import { questions, reviewItems, stations } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { EmptyState, PageHeader, StatCard, TYPE_LABELS, fa } from "@/components/ui";
import ReviewLauncher from "@/components/ReviewLauncher";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const user = await requireUser();
  const { start } = await searchParams;
  const now = new Date();
  const [[{ due }], [{ upcoming }], [{ total }], weakest, nextDue] = await Promise.all([
    db.select({ due: count() }).from(reviewItems).where(and(eq(reviewItems.userId, user.id), lte(reviewItems.dueAt, now))),
    db.select({ upcoming: count() }).from(reviewItems).where(and(eq(reviewItems.userId, user.id), gt(reviewItems.dueAt, now))),
    db.select({ total: count() }).from(reviewItems).where(eq(reviewItems.userId, user.id)),
    db
      .select({ id: reviewItems.id, prompt: questions.prompt, type: questions.type, wrongCount: reviewItems.wrongCount, correctStreak: reviewItems.correctStreak, dueAt: reviewItems.dueAt, station: stations.title, intervalDays: reviewItems.intervalDays })
      .from(reviewItems)
      .innerJoin(questions, eq(questions.id, reviewItems.questionId))
      .innerJoin(stations, eq(stations.id, questions.stationId))
      .where(eq(reviewItems.userId, user.id))
      .orderBy(desc(reviewItems.wrongCount), asc(reviewItems.dueAt))
      .limit(8),
    db.select({ dueAt: reviewItems.dueAt }).from(reviewItems).where(and(eq(reviewItems.userId, user.id), gt(reviewItems.dueAt, now))).orderBy(asc(reviewItems.dueAt)).limit(1),
  ]);

  if (start === "1" && Number(due) > 0) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="جلسهٔ مرور هوشمند" subtitle="سؤال‌هایی که قبلاً اشتباه پاسخ داده‌اید، با فاصلهٔ زمانی بهینه دوباره پرسیده می‌شوند." />
        <ReviewLauncher />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="مرور هوشمند"
        subtitle="سیستم مرور فاصله‌دار: هر بار درست پاسخ دهید، فاصلهٔ مرور بعدی طولانی‌تر می‌شود (۱ → ۳ → ۷ → ۱۴ → ۳۰ روز)."
        action={Number(due) > 0 ? <a href="/review?start=1" className="btn-primary px-6 py-3">شروع مرور ({fa(due)} سؤال) ▶</a> : undefined}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon="⏰" label="آمادهٔ مرور" value={fa(due)} color="#ec4899" hint="سؤال‌هایی که موعدشان رسیده" />
        <StatCard icon="📆" label="در صف آینده" value={fa(upcoming)} color="#8b5cf6" hint={nextDue[0] ? `نزدیک‌ترین: ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(nextDue[0].dueAt)}` : "—"} />
        <StatCard icon="🧠" label="کل سؤال‌های ضعیف" value={fa(total)} color="#14b8a6" hint="مجموع سؤال‌های تحت نظر" />
      </div>

      {Number(total) === 0 ? (
        <EmptyState icon="🌟" title="هیچ سؤال ضعیفی ندارید!" description="وقتی در ایستگاه‌ها به سؤالی اشتباه پاسخ دهید، این‌جا برای مرور فاصله‌دار ظاهر می‌شود." action={{ href: "/learn", label: "رفتن به مسیر یادگیری" }} />
      ) : (
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-extrabold">ضعیف‌ترین سؤال‌های شما</h2>
          <ul className="divide-y divide-slate-100">
            {weakest.map((w) => {
              const m = TYPE_LABELS[w.type];
              const isDue = w.dueAt <= now;
              return (
                <li key={w.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 chip shrink-0" style={{ background: `${m.color}1a`, color: m.color }}>{m.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold">{w.prompt}</p>
                    <p className="text-xs text-slate-500">{w.station}</p>
                  </div>
                  <div className="shrink-0 text-left text-xs">
                    <p className="font-bold text-rose-600">{fa(w.wrongCount)} بار اشتباه</p>
                    <p className={isDue ? "text-emerald-600 font-semibold" : "text-slate-400"}>{isDue ? "آمادهٔ مرور" : `فاصله ${fa(w.intervalDays)} روز`}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
