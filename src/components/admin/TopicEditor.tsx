"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Question, Station, QuestionAnswer } from "@/db/schema";
import { EmptyState, TYPE_LABELS, fa } from "@/components/ui";
import { Modal } from "@/components/admin/ContentManager";

type Props = { topicId: number; color: string; stations: Station[]; questions: Question[]; initialStation?: number; initialQuestion?: number };

type QForm = {
  id?: number;
  type: "mcq" | "fill" | "tf" | "reorder";
  prompt: string;
  options: string[];
  index: number;
  accepted: string;
  value: boolean;
  explanation: string;
  difficulty: number;
};

const emptyQ = (): QForm => ({ type: "mcq", prompt: "", options: ["", "", "", ""], index: 0, accepted: "", value: true, explanation: "", difficulty: 1 });

function toForm(q: Question): QForm {
  const a = q.answer as QuestionAnswer;
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options.length ? q.options : ["", "", "", ""],
    index: "index" in a ? a.index : 0,
    accepted: "accepted" in a ? a.accepted.join("، ") : "",
    value: "value" in a ? a.value : true,
    explanation: q.explanation,
    difficulty: q.difficulty,
  };
}

function toPayload(f: QForm) {
  const options = f.options.map((o) => o.trim()).filter(Boolean);
  const answer = f.type === "mcq" ? { index: f.index } : f.type === "tf" ? { value: f.value } : f.type === "fill" ? { accepted: f.accepted.split(/[،,\n]/).map((s) => s.trim()).filter(Boolean) } : { order: options.map((_, i) => i) };
  return { type: f.type, prompt: f.prompt, options, answer, explanation: f.explanation, difficulty: f.difficulty };
}

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "خطا");
  return data;
}

export default function TopicEditor({ topicId, color, stations: initialStations, questions: initialQuestions, initialStation, initialQuestion }: Props) {
  const router = useRouter();
  const [stations, setStations] = useState(initialStations);
  const [questions, setQuestions] = useState(initialQuestions);
  const [selected, setSelected] = useState<number | null>(initialStation ?? initialStations[0]?.id ?? null);
  const [stationModal, setStationModal] = useState<Partial<Station> | null>(null);
  const [qModal, setQModal] = useState<QForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (initialQuestion) {
      const q = initialQuestions.find((x) => x.id === initialQuestion);
      if (q) setQModal(toForm(q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function notify(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2500);
  }

  const current = stations.find((s) => s.id === selected) ?? null;
  const currentQs = questions.filter((q) => q.stationId === selected).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  /* ---------- stations ---------- */
  async function saveStation(e: React.FormEvent) {
    e.preventDefault();
    if (!stationModal) return;
    setBusy(true);
    try {
      if (stationModal.id) {
        const prev = stations;
        setStations((s) => s.map((x) => (x.id === stationModal.id ? ({ ...x, ...stationModal } as Station) : x)));
        setStationModal(null);
        try {
          const { row } = await api("PATCH", `/api/admin/stations/${stationModal.id}`, stationModal);
          setStations((s) => s.map((x) => (x.id === row.id ? row : x)));
          notify("ok", "ایستگاه ذخیره شد");
        } catch (err) {
          setStations(prev);
          throw err;
        }
      } else {
        const { row } = await api("POST", "/api/admin/stations", { ...stationModal, topicId, sortOrder: stations.length });
        setStations((s) => [...s, row]);
        setSelected(row.id);
        setStationModal(null);
        notify("ok", "ایستگاه ایجاد شد");
      }
      router.refresh();
    } catch (err) {
      notify("err", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteStation(id: number) {
    if (!confirm("حذف ایستگاه، سؤال‌های آن را نیز حذف می‌کند. ادامه می‌دهید؟")) return;
    const prev = stations;
    setStations((s) => s.filter((x) => x.id !== id));
    if (selected === id) setSelected(stations.find((s) => s.id !== id)?.id ?? null);
    try {
      await api("DELETE", `/api/admin/stations/${id}`);
      notify("ok", "ایستگاه حذف شد");
      router.refresh();
    } catch (err) {
      setStations(prev);
      notify("err", (err as Error).message);
    }
  }

  async function moveStation(st: Station, dir: -1 | 1) {
    const idx = stations.findIndex((x) => x.id === st.id);
    const other = stations[idx + dir];
    if (!other) return;
    const prev = stations;
    const next = [...stations];
    next[idx] = { ...other, sortOrder: idx };
    next[idx + dir] = { ...st, sortOrder: idx + dir };
    setStations(next);
    try {
      await Promise.all([api("PATCH", `/api/admin/stations/${st.id}`, { sortOrder: idx + dir }), api("PATCH", `/api/admin/stations/${other.id}`, { sortOrder: idx })]);
      router.refresh();
    } catch (err) {
      setStations(prev);
      notify("err", (err as Error).message);
    }
  }

  /* ---------- questions ---------- */
  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!qModal || !selected) return;
    setBusy(true);
    try {
      const payload = toPayload(qModal);
      if (qModal.id) {
        const { row } = await api("PATCH", `/api/admin/questions/${qModal.id}`, payload);
        setQuestions((qs) => qs.map((x) => (x.id === row.id ? row : x)));
        notify("ok", "سؤال ذخیره شد");
      } else {
        const { row } = await api("POST", "/api/admin/questions", { ...payload, stationId: selected, sortOrder: currentQs.length });
        setQuestions((qs) => [...qs, row]);
        notify("ok", "سؤال اضافه شد");
      }
      setQModal(null);
      router.refresh();
    } catch (err) {
      notify("err", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(id: number) {
    if (!confirm("این سؤال حذف شود؟")) return;
    const prev = questions;
    setQuestions((qs) => qs.filter((x) => x.id !== id));
    try {
      await api("DELETE", `/api/admin/questions/${id}`);
      notify("ok", "سؤال حذف شد");
      router.refresh();
    } catch (err) {
      setQuestions(prev);
      notify("err", (err as Error).message);
    }
  }

  function answerPreview(q: Question) {
    const a = q.answer as QuestionAnswer;
    if ("index" in a) return q.options[a.index];
    if ("value" in a) return a.value ? "صحیح" : "غلط";
    if ("accepted" in a) return a.accepted.join(" / ");
    if ("order" in a) return `${q.options.length} مرحله`;
    return "";
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {toast && <div className={`fixed bottom-4 left-4 z-50 animate-pop rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${toast.kind === "ok" ? "bg-emerald-600" : "bg-rose-600"}`}>{toast.text}</div>}

      {/* stations */}
      <aside className="card h-fit p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-extrabold">ایستگاه‌ها ({fa(stations.length)})</h2>
          <button onClick={() => setStationModal({ title: "", scenario: "", xpReward: 50, passPercent: 70 })} className="btn-primary px-3 py-1.5 text-xs">+ جدید</button>
        </div>
        {stations.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500">هنوز ایستگاهی نیست.</p>
        ) : (
          <ul className="space-y-1">
            {stations.map((s, i) => (
              <li key={s.id} className="flex items-center gap-1">
                <div className="flex flex-col text-[10px]">
                  <button onClick={() => moveStation(s, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-800 disabled:opacity-20">▲</button>
                  <button onClick={() => moveStation(s, 1)} disabled={i === stations.length - 1} className="text-slate-400 hover:text-slate-800 disabled:opacity-20">▼</button>
                </div>
                <button onClick={() => setSelected(s.id)} className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-right text-sm transition ${selected === s.id ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black text-white" style={{ background: selected === s.id ? color : "#94a3b8" }}>{fa(i + 1)}</span>
                  <span className="flex-1 truncate font-semibold">{s.title}</span>
                  <span className={`text-[11px] ${selected === s.id ? "text-white/70" : "text-slate-400"}`}>{fa(questions.filter((q) => q.stationId === s.id).length)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* questions */}
      <section className="space-y-4">
        {current ? (
          <>
            <div className="card p-4" style={{ borderTop: `4px solid ${color}` }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-extrabold">{current.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{current.scenario || <span className="text-slate-400">بدون سناریو</span>}</p>
                  <div className="mt-2 flex gap-2 text-[11px]">
                    <span className="chip bg-amber-50 text-amber-700">⚡ {fa(current.xpReward)} XP</span>
                    <span className="chip bg-slate-100 text-slate-600">🎯 حد قبولی {fa(current.passPercent)}٪</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStationModal(current)} className="btn-secondary px-3 py-1.5 text-xs">ویرایش سناریو</button>
                  <button onClick={() => deleteStation(current.id)} className="btn-danger px-3 py-1.5 text-xs">حذف</button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-extrabold">سؤال‌ها ({fa(currentQs.length)})</h3>
              <button onClick={() => setQModal(emptyQ())} className="btn-primary px-3 py-1.5 text-xs">+ سؤال جدید</button>
            </div>

            {currentQs.length === 0 ? (
              <EmptyState icon="❓" title="این ایستگاه هنوز سؤالی ندارد" description="حداقل یک سؤال اضافه کنید تا دانشجویان بتوانند ایستگاه را شروع کنند." action={<button onClick={() => setQModal(emptyQ())} className="btn-primary mt-2">افزودن سؤال</button>} />
            ) : (
              <ul className="space-y-2">
                {currentQs.map((q, i) => {
                  const m = TYPE_LABELS[q.type];
                  return (
                    <li key={q.id} className="card flex items-start gap-3 p-4">
                      <span className="mt-0.5 text-sm font-black text-slate-400">{fa(i + 1)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap gap-1.5">
                          <span className="chip" style={{ background: `${m.color}1a`, color: m.color }}>{m.icon} {m.label}</span>
                          <span className="chip bg-slate-100 text-slate-500">{"★".repeat(q.difficulty)}</span>
                        </div>
                        <p className="text-sm font-semibold">{q.prompt}</p>
                        <p className="mt-1 truncate text-xs text-emerald-700">✓ {answerPreview(q)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button onClick={() => setQModal(toForm(q))} className="btn-secondary px-3 py-1.5 text-xs">ویرایش</button>
                        <button onClick={() => deleteQuestion(q.id)} className="btn-danger px-3 py-1.5 text-xs">حذف</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <EmptyState icon="🏗️" title="ایستگاهی انتخاب نشده" description="ابتدا یک ایستگاه بالینی با سناریو بسازید." action={<button onClick={() => setStationModal({ title: "", scenario: "", xpReward: 50, passPercent: 70 })} className="btn-primary mt-2">ساخت ایستگاه</button>} />
        )}
      </section>

      {stationModal && (
        <Modal title={stationModal.id ? "ویرایش ایستگاه" : "ایستگاه جدید"} onClose={() => setStationModal(null)}>
          <form onSubmit={saveStation} className="space-y-3">
            <div><label className="label">عنوان</label><input className="input" required value={stationModal.title ?? ""} onChange={(e) => setStationModal({ ...stationModal, title: e.target.value })} /></div>
            <div><label className="label">سناریوی بالینی</label><textarea className="input" rows={4} value={stationModal.scenario ?? ""} onChange={(e) => setStationModal({ ...stationModal, scenario: e.target.value })} placeholder="شرح موقعیت بالینی که دانشجو با آن روبه‌رو می‌شود…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">پاداش XP</label><input className="input" type="number" min={0} value={stationModal.xpReward ?? 50} onChange={(e) => setStationModal({ ...stationModal, xpReward: Number(e.target.value) })} /></div>
              <div><label className="label">حد قبولی (٪)</label><input className="input" type="number" min={1} max={100} value={stationModal.passPercent ?? 70} onChange={(e) => setStationModal({ ...stationModal, passPercent: Number(e.target.value) })} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setStationModal(null)} className="btn-secondary">انصراف</button><button className="btn-primary" disabled={busy}>ذخیره</button></div>
          </form>
        </Modal>
      )}

      {qModal && (
        <Modal title={qModal.id ? "ویرایش سؤال" : "سؤال جدید"} onClose={() => setQModal(null)}>
          <form onSubmit={saveQuestion} className="max-h-[75vh] space-y-3 overflow-y-auto px-0.5">
            <div>
              <label className="label">نوع سؤال</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(TYPE_LABELS) as QForm["type"][]).map((t) => (
                  <button type="button" key={t} onClick={() => setQModal({ ...qModal, type: t })} className={`rounded-xl border-2 px-2 py-2 text-xs font-semibold transition ${qModal.type === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:bg-slate-50"}`}>
                    {TYPE_LABELS[t].icon} {TYPE_LABELS[t].label}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="label">متن سؤال</label><textarea className="input" rows={3} required value={qModal.prompt} onChange={(e) => setQModal({ ...qModal, prompt: e.target.value })} /></div>

            {qModal.type === "mcq" && (
              <div>
                <label className="label">گزینه‌ها (گزینهٔ صحیح را علامت بزنید)</label>
                <div className="space-y-1.5">
                  {qModal.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="radio" name="correct" checked={qModal.index === i} onChange={() => setQModal({ ...qModal, index: i })} />
                      <input className="input" value={o} placeholder={`گزینهٔ ${fa(i + 1)}`} onChange={(e) => setQModal({ ...qModal, options: qModal.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                      <button type="button" onClick={() => setQModal({ ...qModal, options: qModal.options.filter((_, j) => j !== i), index: Math.min(qModal.index, qModal.options.length - 2) })} disabled={qModal.options.length <= 2} className="btn-ghost px-2 text-rose-500 disabled:opacity-30">✕</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setQModal({ ...qModal, options: [...qModal.options, ""] })} className="btn-ghost mt-1 text-xs">+ گزینه</button>
              </div>
            )}

            {qModal.type === "tf" && (
              <div>
                <label className="label">پاسخ صحیح</label>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button type="button" key={String(v)} onClick={() => setQModal({ ...qModal, value: v })} className={`rounded-xl border-2 py-3 font-bold ${qModal.value === v ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>{v ? "✅ صحیح" : "❌ غلط"}</button>
                  ))}
                </div>
              </div>
            )}

            {qModal.type === "fill" && (
              <div>
                <label className="label">پاسخ‌های قابل‌قبول (با «،» جدا کنید)</label>
                <input className="input" required value={qModal.accepted} onChange={(e) => setQModal({ ...qModal, accepted: e.target.value })} placeholder="مثلاً: ۶۵، 65" />
                <p className="mt-1 text-[11px] text-slate-400">مقایسه بدون حساسیت به حروف بزرگ/کوچک، فاصله و اعداد فارسی/انگلیسی انجام می‌شود.</p>
              </div>
            )}

            {qModal.type === "reorder" && (
              <div>
                <label className="label">مراحل به ترتیب صحیح (برای دانشجو به‌هم‌ریخته نمایش داده می‌شود)</label>
                <div className="space-y-1.5">
                  {qModal.options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 text-center text-xs font-black text-slate-400">{fa(i + 1)}</span>
                      <input className="input" value={o} placeholder={`مرحلهٔ ${fa(i + 1)}`} onChange={(e) => setQModal({ ...qModal, options: qModal.options.map((x, j) => (j === i ? e.target.value : x)) })} />
                      <button type="button" onClick={() => setQModal({ ...qModal, options: qModal.options.filter((_, j) => j !== i) })} disabled={qModal.options.length <= 2} className="btn-ghost px-2 text-rose-500 disabled:opacity-30">✕</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setQModal({ ...qModal, options: [...qModal.options, ""] })} className="btn-ghost mt-1 text-xs">+ مرحله</button>
              </div>
            )}

            <div><label className="label">توضیح پاسخ (پس از پاسخ نمایش داده می‌شود)</label><textarea className="input" rows={2} value={qModal.explanation} onChange={(e) => setQModal({ ...qModal, explanation: e.target.value })} /></div>
            <div>
              <label className="label">سختی</label>
              <div className="flex gap-2">{[1, 2, 3].map((d) => <button type="button" key={d} onClick={() => setQModal({ ...qModal, difficulty: d })} className={`rounded-xl border-2 px-4 py-1.5 text-sm ${qModal.difficulty === d ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}>{"★".repeat(d)}</button>)}</div>
            </div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setQModal(null)} className="btn-secondary">انصراف</button><button className="btn-primary" disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیره"}</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
