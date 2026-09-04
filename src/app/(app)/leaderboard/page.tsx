import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { stationProgress, userBadges, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { levelFromXp, levelTitle } from "@/lib/gamification";
import { Avatar, EmptyState, PageHeader, fa } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const me = await getCurrentUser();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      color: users.avatarColor,
      xp: users.xp,
      streak: users.currentStreak,
      badges: sql<number>`(select count(*) from ${userBadges} where ${userBadges.userId} = ${users.id})`,
      stations: sql<number>`(select count(*) from ${stationProgress} where ${stationProgress.userId} = ${users.id} and ${stationProgress.completed} = true)`,
    })
    .from(users)
    .orderBy(desc(users.xp), users.id)
    .limit(50);
  const [{ total }] = await db.select({ total: count() }).from(users);
  void eq;
  const myRank = me ? rows.findIndex((r) => r.id === me.id) + 1 : 0;
  const top3 = rows.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="animate-fade-up">
      <PageHeader title="جدول رتبه‌بندی" subtitle={`${fa(total)} دانشجو در حال رقابت هستند. رتبه بر اساس مجموع امتیاز تجربه است.`} />

      {rows.length === 0 ? (
        <EmptyState icon="🏆" title="هنوز کسی امتیازی نگرفته" description="اولین نفر باشید!" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 items-end gap-3">
            {[top3[1], top3[0], top3[2]].map((u, i) =>
              u ? (
                <div key={u.id} className={`card flex flex-col items-center p-4 text-center ${i === 1 ? "bg-gradient-to-b from-amber-50 to-white ring-2 ring-amber-300 -translate-y-3" : ""}`}>
                  <span className="text-3xl">{medals[i === 1 ? 0 : i === 0 ? 1 : 2]}</span>
                  <Avatar name={u.name} color={u.color} size={i === 1 ? 64 : 52} />
                  <p className="mt-2 truncate text-sm font-extrabold w-full">{u.name}</p>
                  <p className="text-xs text-slate-500">سطح {fa(levelFromXp(u.xp))}</p>
                  <p className="mt-1 text-lg font-black text-amber-600">{fa(u.xp)} <span className="text-[10px] text-slate-400">XP</span></p>
                </div>
              ) : (
                <div key={i} />
              ),
            )}
          </div>

          {me && myRank > 0 && (
            <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
              شما در رتبهٔ <span className="font-black">{fa(myRank)}</span> قرار دارید
              {myRank > 1 && <> — تا رتبهٔ بالاتر {fa(rows[myRank - 2].xp - rows[myRank - 1].xp + 1)} امتیاز فاصله دارید.</>}
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold">رتبه</th>
                  <th className="px-4 py-3 text-right font-semibold">دانشجو</th>
                  <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">سطح</th>
                  <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">ایستگاه‌ها</th>
                  <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">نشان‌ها</th>
                  <th className="px-4 py-3 text-right font-semibold">استریک</th>
                  <th className="px-4 py-3 text-left font-semibold">XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u, i) => {
                  const lvl = levelFromXp(u.xp);
                  const isMe = me?.id === u.id;
                  return (
                    <tr key={u.id} className={isMe ? "bg-brand-50/60" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 font-black text-slate-500">{i < 3 ? medals[i] : fa(i + 1)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} color={u.color} size={36} />
                          <div className="min-w-0">
                            <p className="truncate font-bold">{u.name} {isMe && <span className="chip bg-brand-100 text-brand-700">شما</span>}</p>
                            <p className="text-[11px] text-slate-500 sm:hidden">سطح {fa(lvl)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <p className="font-semibold">{fa(lvl)}</p>
                        <p className="text-[11px] text-slate-500">{levelTitle(lvl)}</p>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">{fa(u.stations)}</td>
                      <td className="hidden px-4 py-3 md:table-cell">🏅 {fa(u.badges)}</td>
                      <td className="px-4 py-3">{u.streak > 0 ? `🔥 ${fa(u.streak)}` : <span className="text-slate-300">—</span>}</td>
                      <td className="px-4 py-3 text-left font-black text-amber-600">{fa(u.xp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
