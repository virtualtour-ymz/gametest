"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fa } from "@/components/ui";

type StationOpt = { id: number; title: string; topic: string; category: string };

const EXAMPLE = [
  { type: "mcq", prompt: "نسبت ماساژ به تنفس در احیای نوزاد چند است؟", options: ["۳ به ۱", "۱۵ به ۲", "۳۰ به ۲", "۵ به ۱"], answer: { index: 0 }, explanation: "در احیای نوزاد نسبت ۳ به ۱ است.", difficulty: 2 },
  { type: "tf", prompt: "اکسیژن با غلظت ۱۰۰٪ برای شروع احیای نوزاد ترم توصیه می‌شود.", answer: { value: false }, explanation: "برای نوزاد ترم با هوای اتاق (۲۱٪) شروع می‌شود.", difficulty: 2 },
  { type: "fill", prompt: "دمای طبیعی محیط اتاق زایمان حداقل چند درجه سانتی‌گراد است؟", answer: { accepted: ["23", "۲۳"] }, explanation: "۲۳ تا ۲۵ درجه.", difficulty: 1 },
  { type: "reorder", prompt: "مراحل تهویه با فشار مثبت را مرتب کنید.", options: ["انتخاب ماسک مناسب", "قرار دادن ماسک روی صورت", "شروع تهویه با سرعت ۴۰–۶۰ در دقیقه", "ارزیابی بالا آمدن قفسهٔ سینه"], explanation: "ترتیب استاندارد NRP.", difficulty: 2 },
];

export default function ImportForm({ stations }: { stations: StationOpt[] }) {
  const router = useRouter();
  const [stationId, setStationId] = useState<number>(stations[0]?.id ?? 0);
  const [text, setText] = useState(JSON.stringify(EXAMPLE, null, 2));
  const [partial, setPartial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: { index: number; error: string }[]; error?: string } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  let preview: unknown[] | null = null;
  try {
    const parsed = JSON.parse(text);
    preview = Array.isArray(parsed) ? parsed : null;
  } catch {
    preview = null;
  }

  async function submit() {
    setParseError(null);
    setResult(null);
    let items: unknown;
    try {
      items = JSON.parse(text);
    } catch {
      setParseError("JSON نامعتبر است؛ ساختار را بررسی کنید.");
      return;
    }
    if (!Array.isArray(items)) {
      setParseError("ورودی باید یک آرایه از سؤال‌ها باشد.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stationId, items, partial }) });
    const data = await res.json();
    setBusy(false);
    setResult(data);
    if (data.imported > 0) router.refresh();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(setText);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-bold">JSON سؤال‌ها {preview && <span className="chip bg-slate-100 text-slate-600">{fa(preview.length)} مورد</span>}</label>
          <div className="flex gap-2">
            <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
              بارگذاری فایل
              <input type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
            </label>
            <button onClick={() => setText(JSON.stringify(EXAMPLE, null, 2))} className="btn-ghost px-3 py-1.5 text-xs">نمونه</button>
          </div>
        </div>
        <textarea dir="ltr" className="input min-h-[420px] font-mono text-xs leading-5" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        {parseError && <p className="mt-2 text-sm text-rose-600">{parseError}</p>}
      </div>

      <div className="space-y-4">
        <div className="card space-y-3 p-5">
          <div>
            <label className="label">ایستگاه مقصد (پیش‌فرض)</label>
            <select className="input" value={stationId} onChange={(e) => setStationId(Number(e.target.value))}>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.id} · {s.category} › {s.topic} › {s.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">هر سؤال می‌تواند با فیلد <code dir="ltr">stationId</code> ایستگاه دیگری را مشخص کند.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
            ورود جزئی (ردیف‌های معتبر وارد شوند حتی اگر برخی خطا دارند)
          </label>
          <button onClick={submit} disabled={busy || !stations.length} className="btn-primary w-full py-3">
            {busy ? "در حال ورود…" : "ورود سؤال‌ها"}
          </button>
        </div>

        {result && (
          <div className={`card animate-pop p-5 ${result.imported > 0 ? "border-emerald-200" : "border-rose-200"}`}>
            <p className="font-extrabold">{result.imported > 0 ? `✅ ${fa(result.imported)} سؤال وارد شد` : "❌ هیچ سؤالی وارد نشد"}</p>
            {result.error && <p className="mt-1 text-sm text-rose-600">{result.error}</p>}
            {result.errors?.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-rose-700">
                {result.errors.map((e, i) => (
                  <li key={i}>ردیف {fa(e.index + 1)}: {e.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="card p-5 text-xs leading-6 text-slate-600">
          <p className="mb-2 font-bold text-slate-800">راهنمای فرمت</p>
          <ul className="list-inside list-disc space-y-1">
            <li><b>mcq</b>: <code dir="ltr">options[]</code> و <code dir="ltr">answer.index</code></li>
            <li><b>tf</b>: <code dir="ltr">answer.value</code> (true/false)</li>
            <li><b>fill</b>: <code dir="ltr">answer.accepted[]</code></li>
            <li><b>reorder</b>: <code dir="ltr">options[]</code> به ترتیب صحیح</li>
            <li>اختیاری: <code dir="ltr">explanation</code>، <code dir="ltr">difficulty</code> (۱ تا ۳)، <code dir="ltr">stationId</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
