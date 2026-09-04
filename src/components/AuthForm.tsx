"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState(mode === "login" ? "student@nurse.ir" : "");
  const [password, setPassword] = useState(mode === "login" ? "student123" : "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "خطایی رخ داد");
      return;
    }
    router.push(data.role === "admin" ? "/admin" : "/dashboard");
    router.refresh();
  }

  function quickFill(e: string, p: string) {
    setEmail(e);
    setPassword(p);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "register" && (
        <div>
          <label className="label">نام و نام خانوادگی</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً سارا محمدی" required />
        </div>
      )}
      <div>
        <label className="label">ایمیل</label>
        <input className="input text-left" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      </div>
      <div>
        <label className="label">رمز عبور</label>
        <input className="input text-left" dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
      </div>
      {error && <div className="animate-shake rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <button className="btn-primary w-full py-3" disabled={loading}>
        {loading ? "لطفاً صبر کنید…" : mode === "login" ? "ورود به حساب" : "ساخت حساب و شروع"}
      </button>

      {mode === "login" && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-2 font-semibold">حساب‌های نمایشی:</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => quickFill("student@nurse.ir", "student123")} className="chip bg-brand-100 text-brand-700 hover:bg-brand-200">
              👩‍⚕️ دانشجو
            </button>
            <button type="button" onClick={() => quickFill("admin@nurse.ir", "admin123")} className="chip bg-amber-100 text-amber-700 hover:bg-amber-200">
              🛠 مدیر محتوا
            </button>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-slate-500">
        {mode === "login" ? (
          <>
            حساب ندارید؟{" "}
            <Link href="/register" className="font-semibold text-brand-600 hover:underline">
              ثبت‌نام کنید
            </Link>
          </>
        ) : (
          <>
            قبلاً ثبت‌نام کرده‌اید؟{" "}
            <Link href="/login" className="font-semibold text-brand-600 hover:underline">
              وارد شوید
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
