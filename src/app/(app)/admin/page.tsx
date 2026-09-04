import Link from "next/link";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, categories, questionAttempts, questions, stations, topics, users } from "@/db/schema";
import { PageHeader, StatCard, TYPE_LABELS, fa } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const [[{ userCount }], [{ qCount }], [{ stCount }], [{ attemptCount }], [{ answers }], hardest, perCategory, perType, recentUsers] = await Promise.all([
    db.select({ userCount: count() }).from(users),
    db.select({ qCount: count() }).from(questions),
    db.select({ stCount: count() }).from(stations),
    db.select({ attemptCount: count() }).from(attempts).where(sql`${attempts.finishedAt} is not null`),
    db.select({ answers: count() }).from(questionAttempts),
    db
      .select({
        id: questions.id,
        prompt: questions.prompt,
        type: questions.type,
        difficulty: questions.difficulty,
        stationId: stations.id,
        stationTitle: stations.title,
        topicId: topics.id,
        color: categories.color,
        total: count(questionAttempts.id),
        correct: sql<number>`sum(case when ${questionAttempts.isCorrect} then 1 else 0 end)`,
      })
      .from(questionAttempts)
      .innerJoin(questions, eq(questions.id, questionAttempts.questionId))
      .innerJoin(stations, eq(stations.id, questions.stationId))
      .innerJoin(topics, eq(topics.id, stations.topicId))
      .innerJoin(categories, eq(categories.id, topics.categoryId))
      .groupBy(questions.id, stations.id, topics.id, categories.color)
      .having(sql`count(${questionAttempts.id}) >= 3`)
      .orderBy(sql`sum(case when ${questionAttempts.isCorrect} then 1 else 0 end)::float / count(${questionAttempts.id}) asc`, desc(count(questionAttempts.id)))
      .limit(12),
    db
      .select({
        name: categories.name,
        color: categories.color,
        icon: categories.icon,
        total: count(questionAttempts.id),
        correct: sql<number>`coalesce(sum(case when ${questionAttempts.isCorrect} then 1 else 0 end), 0)`,
      })
      .from(categories)
      .leftJoin(topics, eq(topics.categoryId, categories.id))
      .leftJoin(stations, eq(stations.topicId, topics.id))
      .leftJoin(questions, eq(questions.stationId, stations.id))
      .leftJoin(questionAttempts, eq(questionAttempts.questionId, questions.id))
      .groupBy(categories.id)
      .orderBy(categories.sortOrder),
    db
      .select({
        type: questions.type,
        total: count(questionAttempts.id),
        correct: sql<number>`coalesce(sum(case when ${questionAttempts.isCorrect} then 1 else 0 end), 0)`,
      })
      .from(questions)
      .leftJoin(questionAttempts, eq(questionAttempts.questionId, questions.id))
      .groupBy(questions.type),
    db.select({ id: users.id, name: users.name, email: users.email, xp: users.xp, role: users.role, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(6),
  ]);

  const overallAcc = Number(answers) ? Math.round((perCategory.reduce((a, c) => a + Number(c.correct), 0) / Number(answers)) * 100) : 0;

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="تحلیل و آمار"
        subtitle="نمای کلی عملکرد دانشجویان و شناسایی سؤال‌های دشوار برای بازنگری محتوا"
        action={
          <div className="flex gap-2">
            <Link href="/admin/content" className="btn-secondary">مدیریت محتوا</Link>
            <Link href="/admin/import" className="btn-primary">ورود گروهی سؤال</Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon="👥" label="کاربران" value={fa(userCount)} color="#6366f1" />
        <StatCard icon="🏥" label="ایستگاه‌ها" value={fa(stCount)} color="#14b8a6" />
        <StatCard icon="❓" label="سؤال‌ها" value={fa(qCount)} color="#f59e0b" />
        <StatCard icon="📝" label="جلسات تکمیل‌شده" value={fa(attemptCount)} color="#ec4899" />
        <StatCard icon="🎯" label="دقت کلی پاسخ‌ها" value={`${fa(overallAcc)}٪`} hint={`${fa(answers)} پاسخ ثبت‌شده`} color="#10b981" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hardest questions */}
        <section className="card p-5 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-extrabold">سخت‌ترین سؤال‌ها</h2>
            <p className="text-xs text-slate-500">سؤال‌هایی با کمترین نرخ پاسخ صحیح (حداقل ۳ پاسخ ثبت‌شده). برای ویرایش کلیک کنید.</p>
          </div>
          {hardest.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">هنوز دادهٔ کافی برای تحلیل وجود ندارد.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {hardest.map((h, i) => {
                const acc = Math.round((Number(h.correct) / Number(h.total)) * 100);
                const m = TYPE_LABELS[h.type];
                return (
                  <li key={h.id}>
                    <Link href={`/admin/content/${h.topicId}?station=${h.stationId}&q=${h.id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50 -mx-2 px-2 rounded-xl transition">
                      <span className="w-6 text-center text-sm font-black text-slate-400">{fa(i + 1)}</span>
                      <span className="h-10 w-1.5 rounded-full" style={{ background: h.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold">{h.prompt}</p>
                        <p className="text-[11px] text-slate-500">
                          <span style={{ color: m.color }}>{m.icon} {m.label}</span> · {h.stationTitle} · {"★".repeat(h.difficulty)}
                        </p>
                      </div>
                      <div className="w-28 shrink-0">
                        <div className="mb-1 flex justify-between text-[11px]">
                          <span className={`font-bold ${acc < 50 ? "text-rose-600" : acc < 70 ? "text-amber-600" : "text-emerald-600"}`}>{fa(acc)}٪ صحیح</span>
                          <span className="text-slate-400">{fa(h.total)} پاسخ</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${acc < 50 ? "bg-rose-500" : acc < 70 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${acc}%` }} />
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          {/* Per-category accuracy */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-extrabold">دقت به تفکیک دسته</h2>
            <ul className="space-y-3">
              {perCategory.map((c) => {
                const acc = Number(c.total) ? Math.round((Number(c.correct) / Number(c.total)) * 100) : 0;
                return (
                  <li key={c.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold">{c.icon} {c.name}</span>
                      <span className="text-slate-500">{fa(acc)}٪ · {fa(c.total)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${acc}%`, background: c.color }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
          {/* Per type */}
          <section className="card p-5">
            <h2 className="mb-3 text-lg font-extrabold">دقت به تفکیک نوع سؤال</h2>
            <div className="grid grid-cols-2 gap-2">
              {perType.map((t) => {
                const m = TYPE_LABELS[t.type];
                const acc = Number(t.total) ? Math.round((Number(t.correct) / Number(t.total)) * 100) : 0;
                return (
                  <div key={t.type} className="rounded-xl p-3" style={{ background: `${m.color}12` }}>
                    <p className="text-xs font-semibold" style={{ color: m.color }}>{m.icon} {m.label}</p>
                    <p className="text-xl font-black">{fa(acc)}٪</p>
                    <p className="text-[10px] text-slate-500">{fa(t.total)} پاسخ</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-extrabold">کاربران اخیر</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500">
              <tr><th className="py-2 text-right">نام</th><th className="py-2 text-right">ایمیل</th><th className="py-2 text-right">نقش</th><th className="py-2 text-right">XP</th><th className="py-2 text-right">عضویت</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <td className="py-2 font-semibold">{u.name}</td>
                  <td className="py-2 text-slate-500" dir="ltr">{u.email}</td>
                  <td className="py-2"><span className={`chip ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{u.role === "admin" ? "مدیر" : "دانشجو"}</span></td>
                  <td className="py-2 font-bold text-amber-600">{fa(u.xp)}</td>
                  <td className="py-2 text-slate-500">{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
