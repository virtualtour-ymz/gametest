"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TYPE_LABELS, fa } from "@/components/ui";
import type { PlayQuestion } from "@/app/api/play/[action]/route";

type Feedback = { correct: boolean; explanation: string; correctAnswer: string | string[] };
type Summary = {
  score: number;
  total: number;
  passed: boolean;
  xpEarned: number;
  bonus: number;
  firstPass: boolean;
  bestStreak: number;
  totalXp: number;
  dailyStreak: number;
  levelUp: number | null;
  newBadges: { name: string; icon: string; color: string; description: string }[];
  nextStationId: number | null;
  reviewRemaining: number;
};

type Props = {
  mode: "station" | "review";
  stationId?: number;
  title: string;
  scenario?: string;
  color: string;
  backHref: string;
};

export default function QuizPlayer({ mode, stationId, title, scenario, color, backHref }: Props) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [qs, setQs] = useState<PlayQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showScenario, setShowScenario] = useState(true);

  // per-question local state
  const [selected, setSelected] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [tfValue, setTfValue] = useState<boolean | null>(null);
  const [order, setOrder] = useState<{ idx: number; text: string }[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const q = qs[idx];

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/play/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "review" ? { mode } : { mode, stationId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در شروع جلسه");
      return;
    }
    setAttemptId(data.attemptId);
    setQs(data.questions);
    setIdx(0);
    setResults([]);
    setStreak(0);
    setBestStreak(0);
    setSummary(null);
    setFeedback(null);
  }, [mode, stationId]);

  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    setSelected(null);
    setText("");
    setTfValue(null);
    setOrder(q?.items ?? []);
    setFeedback(null);
  }, [q]);

  const canSubmit = useMemo(() => {
    if (!q) return false;
    if (q.type === "mcq") return selected !== null;
    if (q.type === "tf") return tfValue !== null;
    if (q.type === "fill") return text.trim().length > 0;
    if (q.type === "reorder") return order.length > 0;
    return false;
  }, [q, selected, tfValue, text, order]);

  async function submit() {
    if (!q || !attemptId || !canSubmit || submitting) return;
    setSubmitting(true);
    const response =
      q.type === "mcq" ? { index: selected } : q.type === "tf" ? { value: tfValue } : q.type === "fill" ? { text } : { order: order.map((o) => o.idx) };
    const res = await fetch("/api/play/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, questionId: q.id, response }),
    });
    const data: Feedback & { error?: string } = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در ثبت پاسخ");
      return;
    }
    setFeedback(data);
    setResults((r) => [...r, data.correct]);
    if (data.correct) {
      setStreak((s) => {
        const n = s + 1;
        setBestStreak((b) => Math.max(b, n));
        return n;
      });
    } else setStreak(0);
  }

  async function next() {
    if (idx + 1 < qs.length) {
      setIdx(idx + 1);
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/play/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "خطا در پایان جلسه");
      return;
    }
    setSummary(data);
    router.refresh();
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length) return;
    setOrder((o) => {
      const a = [...o];
      const [item] = a.splice(from, 1);
      a.splice(to, 0, item);
      return a;
    });
  }

  /* ---------- Loading / error ---------- */
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 animate-fade-up">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-40" />
        <div className="grid gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
        <p className="text-center text-sm text-slate-500">در حال آماده‌سازی ایستگاه…</p>
      </div>
    );
  }
  if (error && !q) {
    return (
      <div className="card mx-auto max-w-lg p-10 text-center animate-fade-up">
        <div className="mb-3 text-4xl">🚧</div>
        <h2 className="text-lg font-extrabold">{error}</h2>
        <div className="mt-5 flex justify-center gap-2">
          <Link href={backHref} className="btn-secondary">بازگشت</Link>
          <button onClick={start} className="btn-primary">تلاش مجدد</button>
        </div>
      </div>
    );
  }

  /* ---------- Summary ---------- */
  if (summary) {
    const pct = summary.total ? Math.round((summary.score / summary.total) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl animate-pop">
        <div className="card relative overflow-hidden p-8 text-center">
          {summary.passed && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-around">
              {["🎉", "⭐", "✨", "🎊", "💫", "🌟", "🎉", "⭐"].map((e, i) => (
                <span key={i} className="animate-confetti text-2xl" style={{ animationDelay: `${i * 0.12}s`, marginTop: 40 }}>
                  {e}
                </span>
              ))}
            </div>
          )}
          <div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full text-5xl" style={{ background: summary.passed ? "#d1fae5" : "#fee2e2" }}>
            {summary.passed ? (pct === 100 ? "💎" : "🏆") : "💪"}
          </div>
          <h2 className="text-2xl font-black">
            {summary.passed
              ? pct === 100
                ? "بی‌نقص! نمرهٔ کامل"
                : mode === "review"
                  ? "مرور موفق!"
                  : "ایستگاه با موفقیت گذرانده شد!"
              : "این بار نشد، ولی نزدیک بودید"}
          </h2>
          <p className="mt-1 text-slate-500">
            {fa(summary.score)} پاسخ صحیح از {fa(summary.total)} سؤال ({fa(pct)}٪)
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-amber-50 p-3">
              <p className="text-2xl font-black text-amber-600">+{fa(summary.xpEarned)}</p>
              <p className="text-xs text-amber-700">امتیاز تجربه</p>
              {summary.bonus > 0 && <p className="text-[10px] text-amber-600">شامل {fa(summary.bonus)} پاداش {summary.firstPass ? "اولین قبولی" : "تکرار"}</p>}
            </div>
            <div className="rounded-2xl bg-orange-50 p-3">
              <p className="text-2xl font-black text-orange-600">🔥 {fa(summary.bestStreak)}</p>
              <p className="text-xs text-orange-700">بهترین استریک جلسه</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-3">
              <p className="text-2xl font-black text-violet-600">📅 {fa(summary.dailyStreak)}</p>
              <p className="text-xs text-violet-700">روز پیاپی</p>
            </div>
          </div>

          {summary.levelUp && (
            <div className="mt-4 animate-pop rounded-2xl border-2 border-brand-300 bg-brand-50 p-4">
              <p className="text-lg font-black text-brand-700">🎖 ارتقا به سطح {fa(summary.levelUp)}!</p>
            </div>
          )}

          {summary.newBadges.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-bold text-slate-600">نشان جدید کسب کردید!</p>
              <div className="flex flex-wrap justify-center gap-2">
                {summary.newBadges.map((b) => (
                  <div key={b.name} className="animate-pop flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: b.color, background: `${b.color}15` }}>
                    <span className="text-2xl">{b.icon}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold">{b.name}</p>
                      <p className="text-[10px] text-slate-500">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* answer map */}
          <div className="mt-6 flex flex-wrap justify-center gap-1.5">
            {results.map((r, i) => (
              <span key={i} className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white ${r ? "bg-emerald-500" : "bg-rose-400"}`}>
                {fa(i + 1)}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {mode === "review" ? (
              <>
                {summary.reviewRemaining > 0 && (
                  <button onClick={start} className="btn-primary">ادامهٔ مرور ({fa(summary.reviewRemaining)} سؤال دیگر)</button>
                )}
                <Link href="/dashboard" className="btn-secondary">داشبورد</Link>
              </>
            ) : (
              <>
                {summary.nextStationId && (
                  <Link href={`/station/${summary.nextStationId}`} className="btn-primary">ایستگاه بعدی ▶</Link>
                )}
                {!summary.passed && <button onClick={start} className="btn-primary">تلاش دوباره</button>}
                <Link href={backHref} className="btn-secondary">بازگشت به مبحث</Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!q) return null;
  const meta = TYPE_LABELS[q.type];
  const progress = Math.round((idx / qs.length) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Link href={backHref} className="btn-ghost px-2 text-slate-500" aria-label="خروج">✕</Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: color }} />
        </div>
        <span className="text-xs font-bold text-slate-500">{fa(idx + 1)}/{fa(qs.length)}</span>
        <span className={`chip ${streak >= 3 ? "bg-orange-100 text-orange-700 animate-pop" : "bg-slate-100 text-slate-500"}`} key={streak}>
          🔥 {fa(streak)}
        </span>
      </div>

      {/* Scenario */}
      {mode === "station" && scenario && (
        <div className="card overflow-hidden">
          <button onClick={() => setShowScenario((s) => !s)} className="flex w-full items-center justify-between px-5 py-3 text-right">
            <span className="flex items-center gap-2 text-sm font-bold"><span>📋</span> سناریوی بالینی</span>
            <span className="text-xs text-slate-400">{showScenario ? "بستن ▲" : "نمایش ▼"}</span>
          </button>
          {showScenario && <p className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 text-sm leading-7 text-slate-700">{scenario}</p>}
        </div>
      )}
      {mode === "review" && q.stationTitle && (
        <p className="text-xs text-slate-500">از ایستگاه: <span className="font-semibold text-slate-700">{q.stationTitle}</span></p>
      )}

      {/* Question card */}
      <div key={q.id} className={`card animate-fade-up p-6 ${feedback && !feedback.correct ? "animate-shake" : ""}`}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="chip" style={{ background: `${meta.color}1a`, color: meta.color }}>{meta.icon} {meta.label}</span>
          <span className="chip bg-slate-100 text-slate-500">{"★".repeat(q.difficulty)}{"☆".repeat(3 - q.difficulty)}</span>
          <span className="chip bg-amber-50 text-amber-700">+{fa((mode === "review" ? 6 : 10) * q.difficulty)} XP</span>
        </div>
        <h2 className="text-lg font-extrabold leading-8">{q.prompt}</h2>

        <div className="mt-5">
          {q.type === "mcq" && (
            <div className="grid gap-2.5">
              {q.options.map((opt, i) => {
                const isSel = selected === i;
                let cls = "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40";
                if (feedback) {
                  const correctIdx = q.options.indexOf(feedback.correctAnswer as string);
                  if (i === correctIdx) cls = "border-emerald-400 bg-emerald-50";
                  else if (isSel) cls = "border-rose-400 bg-rose-50";
                  else cls = "border-slate-200 bg-white opacity-60";
                } else if (isSel) cls = "border-brand-500 bg-brand-50 ring-2 ring-brand-100";
                return (
                  <button key={i} disabled={!!feedback} onClick={() => setSelected(i)} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-right text-sm font-medium transition ${cls}`}>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{["الف", "ب", "ج", "د", "ه", "و"][i]}</span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "tf" && (
            <div className="grid grid-cols-2 gap-3">
              {[true, false].map((v) => {
                const isSel = tfValue === v;
                let cls = "border-slate-200 bg-white hover:border-brand-300";
                if (feedback) {
                  const correctVal = feedback.correctAnswer === "صحیح";
                  if (v === correctVal) cls = "border-emerald-400 bg-emerald-50";
                  else if (isSel) cls = "border-rose-400 bg-rose-50";
                  else cls = "opacity-60";
                } else if (isSel) cls = "border-brand-500 bg-brand-50 ring-2 ring-brand-100";
                return (
                  <button key={String(v)} disabled={!!feedback} onClick={() => setTfValue(v)} className={`rounded-2xl border-2 py-6 text-lg font-extrabold transition ${cls}`}>
                    <span className="block text-3xl">{v ? "✅" : "❌"}</span>
                    {v ? "صحیح" : "غلط"}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "fill" && (
            <div>
              <input
                className={`input py-3 text-base ${feedback ? (feedback.correct ? "border-emerald-400 bg-emerald-50" : "border-rose-400 bg-rose-50") : ""}`}
                value={text}
                disabled={!!feedback}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="پاسخ خود را بنویسید…"
                autoFocus
              />
              <p className="mt-1.5 text-[11px] text-slate-400">پاسخ به فارسی یا انگلیسی پذیرفته می‌شود؛ حروف بزرگ/کوچک و فاصله‌ها مهم نیستند.</p>
            </div>
          )}

          {q.type === "reorder" && (
            <div>
              <p className="mb-2 text-xs text-slate-500">مراحل را با کشیدن یا دکمه‌های بالا/پایین به ترتیب صحیح مرتب کنید (اولین مرحله در بالا).</p>
              <ol className="space-y-2">
                {order.map((item, i) => {
                  let cls = "border-slate-200 bg-white";
                  if (feedback) {
                    const correctList = feedback.correctAnswer as string[];
                    cls = correctList[i] === item.text ? "border-emerald-400 bg-emerald-50" : "border-rose-300 bg-rose-50";
                  }
                  return (
                    <li
                      key={item.idx}
                      draggable={!feedback}
                      onDragStart={() => setDragFrom(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (dragFrom !== null) move(dragFrom, i);
                        setDragFrom(null);
                      }}
                      className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-sm transition ${cls} ${!feedback ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black text-white" style={{ background: color }}>{fa(i + 1)}</span>
                      <span className="flex-1">{item.text}</span>
                      {!feedback && (
                        <span className="flex flex-col">
                          <button onClick={() => move(i, i - 1)} disabled={i === 0} className="px-1 text-slate-400 hover:text-brand-600 disabled:opacity-30" aria-label="بالا">▲</button>
                          <button onClick={() => move(i, i + 1)} disabled={i === order.length - 1} className="px-1 text-slate-400 hover:text-brand-600 disabled:opacity-30" aria-label="پایین">▼</button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {feedback && !feedback.correct && (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                  <p className="mb-1 font-bold">ترتیب صحیح:</p>
                  <ol className="list-inside list-decimal space-y-0.5">
                    {(feedback.correctAnswer as string[]).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`mt-5 animate-fade-up rounded-2xl border-2 p-4 ${feedback.correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
            <p className={`text-base font-black ${feedback.correct ? "text-emerald-700" : "text-rose-700"}`}>
              {feedback.correct ? (streak >= 3 ? `🔥 عالی! ${fa(streak)} پاسخ صحیح پیاپی` : "✅ درست است!") : "❌ نادرست"}
            </p>
            {!feedback.correct && (q.type === "fill" || q.type === "mcq" || q.type === "tf") && (
              <p className="mt-1 text-sm text-slate-700">پاسخ صحیح: <span className="font-bold">{feedback.correctAnswer as string}</span></p>
            )}
            {feedback.explanation && <p className="mt-2 text-sm leading-7 text-slate-700">💡 {feedback.explanation}</p>}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end">
          {feedback ? (
            <button onClick={next} disabled={submitting} className="btn-primary px-8 py-3">
              {submitting ? "…" : idx + 1 < qs.length ? "سؤال بعدی ←" : "مشاهدهٔ نتیجه 🏁"}
            </button>
          ) : (
            <button onClick={submit} disabled={!canSubmit || submitting} className="btn-primary px-8 py-3">
              {submitting ? "در حال بررسی…" : "ثبت پاسخ"}
            </button>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">{title}</p>
    </div>
  );
}
