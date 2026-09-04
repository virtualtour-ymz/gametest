"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, fa } from "@/components/ui";
import { levelProgress, levelTitle } from "@/lib/levels";
import type { SafeUser } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "داشبورد", icon: "📊" },
  { href: "/learn", label: "مسیر یادگیری", icon: "🗺️" },
  { href: "/review", label: "مرور هوشمند", icon: "🔁" },
  { href: "/badges", label: "نشان‌ها", icon: "🏅" },
  { href: "/leaderboard", label: "رتبه‌بندی", icon: "🏆" },
];
const ADMIN_NAV = [
  { href: "/admin", label: "تحلیل و آمار", icon: "📈" },
  { href: "/admin/content", label: "مدیریت محتوا", icon: "🗂️" },
  { href: "/admin/import", label: "ورود گروهی سؤال", icon: "📥" },
];

export default function Sidebar({ user, reviewDue }: { user: SafeUser | null; reviewDue: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const lp = user ? levelProgress(user.xp) : null;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active ? "bg-brand-600 text-white shadow-md shadow-brand-600/30" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="text-lg">{n.icon}</span>
            <span className="flex-1">{n.label}</span>
            {n.href === "/review" && reviewDue > 0 && (
              <span className={`chip ${active ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"}`}>{fa(reviewDue)}</span>
            )}
          </Link>
        );
      })}
      {user?.role === "admin" && (
        <>
          <p className="mb-1 mt-5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">پنل مدیریت</p>
          {ADMIN_NAV.map((n) => {
            const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "bg-amber-500 text-white shadow-md shadow-amber-500/30" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="text-lg">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );

  const userBox = user && lp ? (
    <div className="m-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} color={user.avatarColor} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{user.name}</p>
          <p className="truncate text-[11px] text-slate-500">
            سطح {fa(lp.level)} · {levelTitle(lp.level)}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
          <span>{fa(lp.current)} / {fa(lp.needed)} XP</span>
          <span>🔥 {fa(user.currentStreak)} روز</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-gradient-to-l from-brand-400 to-brand-600 transition-all" style={{ width: `${lp.percent}%` }} />
        </div>
      </div>
      <button onClick={logout} className="btn-ghost mt-2 w-full text-xs">
        خروج از حساب
      </button>
    </div>
  ) : (
    <div className="m-3 space-y-2">
      <Link href="/login" className="btn-primary w-full">ورود</Link>
      <Link href="/register" className="btn-secondary w-full">ثبت‌نام</Link>
    </div>
  );

  return (
    <>
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">🩺</span>
          نِرس‌آرنا
        </Link>
        <button onClick={() => setOpen(true)} className="btn-ghost px-2" aria-label="منو">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      </header>

      {open && <div className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/dashboard" className="flex items-center gap-2 text-lg font-black">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">🩺</span>
            نِرس‌آرنا
          </Link>
          <button onClick={() => setOpen(false)} className="btn-ghost px-2 lg:hidden" aria-label="بستن">✕</button>
        </div>
        {nav}
        {userBox}
      </aside>
    </>
  );
}
