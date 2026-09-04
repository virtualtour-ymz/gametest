import Link from "next/link";
import { and, count, desc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { badges, reviewItems, stationProgress, userBadges } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { levelProgress, levelTitle } from "@/lib/gamification";
import { getCategoryProgress, getNextStation, getRecentAttempts, relativeTime } from "@/lib/queries";
import { EmptyState, PageHeader, RadialChart, StatCard, fa } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [cats, next, recent, [{ due }], [{ done }], earned] = await Promise.all([
    getCategoryProgress(user.id),
    getNextStation(user.id),
    getRecentAttempts(user.id),
    db.select({ due: count() }).from(reviewItems).where(and(eq(reviewItems.userId, user.id), lte(reviewItems.dueAt, new Date()))),
    db.select({ done: count() }).from(stationProgress).where(and(eq(stationProgress.userId, user.id), eq(stationProgress.completed, true))),
    db
      .select({ name: badges.name, icon: badges.icon, color: badges.color, earnedAt: userBadges.earnedAt })
      .from(userBadges)
      .innerJoin(badges, eq(badges.id, userBadges.badgeId))
      .where(eq(userBadges.userId, user.id))
      .orderBy(desc(userBadges.earnedAt))
      .limit(4),
  ]);
  const lp = levelProgress(user.xp);
  const totalStations = cats.reduce((a, c) => a + c.total, 0);
  const overall = totalStations ? Math.round((Number(done) / totalStations) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "صبح بخیر" : hour < 18 ? "ظهر بخیر" : "عصر بخیر";

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader title={`${greeting}، ${user.name.split(" ")[0]} 👋`} subtitle="آمادهٔ یک ایستگاه بالینی دیگر هستید؟" />

      {/* Hero: continue + level */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card relative overflow-hidden bg-gradient-to-br from-brand-600 to-violet-600 p-6 text-white lg:col-span-2">
          <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 left-24 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-2xl" />
          {next ? (
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-white/70">ادامهٔ مسیر</p>
                <div className="mt-1 flex items-center gap-2 text-sm text-white/80">
                  <span>{next.categoryIcon}</span>
                  <span>{next.categoryName}</span>
                  <span>›</span>
                  <span>{next.topicTitle}</span>
                </div>
                <h2 className="mt-1 text-xl font-extrabold md:text-2xl">{next.stationTitle}</h2>
              </div>
              <Link href={`/station/${next.stationId}`} className="btn bg-white text-brand-700 shadow-lg hover:bg-brand-50 shrink-0 px-6 py-3">
                شروع ایستگاه ▶
              </Link>
            </div>
          ) : (
            <div className="relative z-10">
              <h2 className="text-2xl font-extrabold">🎉 همهٔ ایستگاه‌ها را کامل کرده‌اید!</h2>
              <p className="mt-1 text-white/80">برای تثبیت یادگیری، سؤال‌های ضعیف را مرور کنید.</p>
            </div>
          )}
        </div>
        <div className="card flex items-center gap-4 p-5">
          <RadialChart percent={lp.percent} color="#6366f1" size={104} stroke={11} label={`سطح ${fa(lp.level)}`} sub={levelTitle(lp.level)} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500">تا سطح بعد</p>
            <p className="text-2xl font-black text-slate-900">{fa(lp.needed - lp.current)} <span className="text-sm font-semibold text-slate-400">XP</span></p>
            <p className="mt-1 text-xs text-slate-500">مجموع امتیاز: {fa(user.xp)}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="🔥" label="استریک روزانه" value={`${fa(user.currentStreak)} روز`} hint={`رکورد: ${fa(user.longestStreak)} روز`} color="#f97316" />
        <StatCard icon="🏥" label="ایستگاه‌های کامل‌شده" value={`${fa(done)} / ${fa(totalStations)}`} hint={`${fa(overall)}٪ کل مسیر`} color="#14b8a6" />
        <StatCard icon="🔁" label="سؤال آمادهٔ مرور" value={fa(due)} hint={Number(due) > 0 ? "همین حالا مرور کنید" : "چیزی برای مرور نیست"} color="#ec4899" />
        <StatCard icon="🏅" label="نشان‌های کسب‌شده" value={fa(earned.length ? earned.length : 0)} hint="مشاهده در بخش نشان‌ها" color="#f59e0b" />
      </div>

      {/* Category radial charts */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">پیشرفت در دسته‌ها</h2>
          <Link href="/learn" className="text-sm font-semibold text-brand-600 hover:underline">مشاهدهٔ مسیر کامل →</Link>
        </div>
        {cats.length === 0 ? (
          <EmptyState icon="🗺️" title="هنوز محتوایی وجود ندارد" description="مدیر سیستم به‌زودی دسته‌ها و ایستگاه‌ها را اضافه می‌کند." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {cats.map((c) => (
              <Link key={c.id} href={`/learn#cat-${c.id}`} className="card group flex flex-col items-center gap-2 p-4 text-center transition hover:-translate-y-0.5 hover:shadow-lg">
                <RadialChart percent={c.percent} color={c.color} size={92} stroke={9} />
                <div className="text-2xl">{c.icon}</div>
                <p className="text-sm font-bold leading-snug">{c.name}</p>
                <p className="text-[11px] text-slate-500">{fa(c.completed)} از {fa(c.total)} ایستگاه</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-lg font-extrabold">فعالیت‌های اخیر</h2>
          {recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              هنوز هیچ ایستگاهی را نگذرانده‌اید. <Link href="/learn" className="font-semibold text-brand-600">اولین ایستگاه را شروع کنید</Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <span className="h-10 w-1.5 rounded-full" style={{ background: a.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{a.mode === "review" ? "جلسهٔ مرور هوشمند" : a.stationTitle}</p>
                    <p className="text-xs text-slate-500">{a.mode === "review" ? "" : a.topicTitle + " · "}{relativeTime(a.createdAt)}</p>
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-extrabold ${a.passed ? "text-emerald-600" : "text-rose-600"}`}>{fa(a.score)}/{fa(a.total)}</p>
                    <p className="text-[11px] text-amber-600">+{fa(a.xpEarned)} XP</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Badges */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">آخرین نشان‌ها</h2>
            <Link href="/badges" className="text-xs font-semibold text-brand-600 hover:underline">همه</Link>
          </div>
          {earned.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">با گذراندن اولین ایستگاه، اولین نشان خود را بگیرید!</p>
          ) : (
            <ul className="space-y-3">
              {earned.map((b, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl text-2xl" style={{ background: `${b.color}22` }}>{b.icon}</span>
                  <div>
                    <p className="text-sm font-bold">{b.name}</p>
                    <p className="text-[11px] text-slate-500">{relativeTime(b.earnedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
