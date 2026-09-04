import { eq } from "drizzle-orm";
import { db } from "@/db";
import { badges, userBadges } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ensureBadges } from "@/lib/gamification";
import { PageHeader, fa } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const user = await requireUser();
  await ensureBadges();
  const all = await db.select().from(badges).orderBy(badges.id);
  const mine = await db.select({ badgeId: userBadges.badgeId, earnedAt: userBadges.earnedAt }).from(userBadges).where(eq(userBadges.userId, user.id));
  const mineMap = new Map(mine.map((m) => [m.badgeId, m.earnedAt]));
  const earnedCount = mine.length;

  return (
    <div className="animate-fade-up">
      <PageHeader title="نشان‌ها" subtitle={`${fa(earnedCount)} از ${fa(all.length)} نشان را کسب کرده‌اید. هر نشان یک دستاورد بالینی است!`} />
      <div className="mb-6 h-3 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-l from-amber-400 to-orange-500 transition-all" style={{ width: `${all.length ? (earnedCount / all.length) * 100 : 0}%` }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((b) => {
          const earnedAt = mineMap.get(b.id);
          return (
            <div key={b.id} className={`card relative overflow-hidden p-5 transition ${earnedAt ? "hover:-translate-y-0.5 hover:shadow-lg" : "opacity-70 grayscale"}`} style={earnedAt ? { borderColor: `${b.color}66` } : undefined}>
              {earnedAt && <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full opacity-20" style={{ background: b.color }} />}
              <div className="flex items-start gap-4">
                <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-4xl ${earnedAt ? "animate-float" : ""}`} style={{ background: `${b.color}22` }}>
                  {earnedAt ? b.icon : "🔒"}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold">{b.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{b.description}</p>
                  <p className="mt-2 text-[11px] font-semibold" style={{ color: earnedAt ? b.color : "#94a3b8" }}>
                    {earnedAt ? `کسب‌شده در ${new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(earnedAt)}` : "هنوز کسب نشده"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
