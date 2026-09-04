"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category, Topic } from "@/db/schema";
import { EmptyState, fa } from "@/components/ui";

type TopicWithCounts = Topic & { stationCount: number; questionCount: number };
type Props = { categories: Category[]; topics: TopicWithCounts[] };

const PALETTE = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#14b8a6", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"];
const ICONS = ["🩺", "🚑", "💊", "🏥", "👶", "🧠", "🫀", "🫁", "🦴", "🧪", "🩸", "🧬"];

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "خطا");
  return data;
}

export default function ContentManager({ categories: initialCats, topics: initialTopics }: Props) {
  const router = useRouter();
  const [cats, setCats] = useState(initialCats);
  const [topics, setTopics] = useState(initialTopics);
  const [selected, setSelected] = useState<number | null>(initialCats[0]?.id ?? null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [catModal, setCatModal] = useState<Partial<Category> | null>(null);
  const [topicModal, setTopicModal] = useState<Partial<Topic> | null>(null);
  const [busy, setBusy] = useState(false);

  function notify(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2500);
  }

  const current = cats.find((c) => c.id === selected) ?? null;
  const currentTopics = topics.filter((t) => t.categoryId === selected).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  /* ---------- categories ---------- */
  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catModal) return;
    setBusy(true);
    try {
      if (catModal.id) {
        const prev = cats;
        setCats((c) => c.map((x) => (x.id === catModal.id ? { ...x, ...catModal } as Category : x)));
        setCatModal(null);
        try {
          const { row } = await api("PATCH", `/api/admin/categories/${catModal.id}`, catModal);
          setCats((c) => c.map((x) => (x.id === row.id ? row : x)));
          notify("ok", "دسته به‌روزرسانی شد");
        } catch (err) {
          setCats(prev);
          throw err;
        }
      } else {
        const { row } = await api("POST", "/api/admin/categories", { ...catModal, sortOrder: cats.length });
        setCats((c) => [...c, row]);
        setSelected(row.id);
        setCatModal(null);
        notify("ok", "دسته ایجاد شد");
      }
      router.refresh();
    } catch (err) {
      notify("err", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(id: number) {
    if (!confirm("حذف این دسته تمام مبحث‌ها، ایستگاه‌ها و سؤال‌های آن را نیز حذف می‌کند. ادامه می‌دهید؟")) return;
    const prev = cats;
    setCats((c) => c.filter((x) => x.id !== id));
    if (selected === id) setSelected(cats.find((c) => c.id !== id)?.id ?? null);
    try {
      await api("DELETE", `/api/admin/categories/${id}`);
      notify("ok", "دسته حذف شد");
      router.refresh();
    } catch (err) {
      setCats(prev);
      notify("err", (err as Error).message);
    }
  }

  /* ---------- topics ---------- */
  async function saveTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!topicModal || !selected) return;
    setBusy(true);
    try {
      if (topicModal.id) {
        const prev = topics;
        setTopics((t) => t.map((x) => (x.id === topicModal.id ? ({ ...x, ...topicModal } as TopicWithCounts) : x)));
        setTopicModal(null);
        try {
          const { row } = await api("PATCH", `/api/admin/topics/${topicModal.id}`, topicModal);
          setTopics((t) => t.map((x) => (x.id === row.id ? { ...x, ...row } : x)));
          notify("ok", "مبحث به‌روزرسانی شد");
        } catch (err) {
          setTopics(prev);
          throw err;
        }
      } else {
        const { row } = await api("POST", "/api/admin/topics", { ...topicModal, categoryId: selected, sortOrder: currentTopics.length });
        setTopics((t) => [...t, { ...row, stationCount: 0, questionCount: 0 }]);
        setTopicModal(null);
        notify("ok", "مبحث ایجاد شد");
      }
      router.refresh();
    } catch (err) {
      notify("err", (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(t: TopicWithCounts) {
    const prev = topics;
    setTopics((ts) => ts.map((x) => (x.id === t.id ? { ...x, isPublished: !x.isPublished } : x)));
    try {
      await api("PATCH", `/api/admin/topics/${t.id}`, { isPublished: !t.isPublished });
      router.refresh();
    } catch (err) {
      setTopics(prev);
      notify("err", (err as Error).message);
    }
  }

  async function deleteTopic(id: number) {
    if (!confirm("حذف مبحث، ایستگاه‌ها و سؤال‌های آن را نیز حذف می‌کند. ادامه می‌دهید؟")) return;
    const prev = topics;
    setTopics((t) => t.filter((x) => x.id !== id));
    try {
      await api("DELETE", `/api/admin/topics/${id}`);
      notify("ok", "مبحث حذف شد");
      router.refresh();
    } catch (err) {
      setTopics(prev);
      notify("err", (err as Error).message);
    }
  }

  async function moveTopic(t: TopicWithCounts, dir: -1 | 1) {
    const idx = currentTopics.findIndex((x) => x.id === t.id);
    const other = currentTopics[idx + dir];
    if (!other) return;
    const a = { ...t, sortOrder: idx + dir };
    const b = { ...other, sortOrder: idx };
    const prev = topics;
    setTopics((ts) => ts.map((x) => (x.id === a.id ? a : x.id === b.id ? b : x)));
    try {
      await Promise.all([api("PATCH", `/api/admin/topics/${a.id}`, { sortOrder: a.sortOrder }), api("PATCH", `/api/admin/topics/${b.id}`, { sortOrder: b.sortOrder })]);
      router.refresh();
    } catch (err) {
      setTopics(prev);
      notify("err", (err as Error).message);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {toast && (
        <div className={`fixed bottom-4 left-4 z-50 animate-pop rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${toast.kind === "ok" ? "bg-emerald-600" : "bg-rose-600"}`}>{toast.text}</div>
      )}

      {/* categories column */}
      <aside className="card h-fit p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-sm font-extrabold">دسته‌ها ({fa(cats.length)})</h2>
          <button onClick={() => setCatModal({ name: "", description: "", color: PALETTE[cats.length % PALETTE.length], icon: ICONS[cats.length % ICONS.length] })} className="btn-primary px-3 py-1.5 text-xs">+ جدید</button>
        </div>
        {cats.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500">هنوز دسته‌ای نیست.</p>
        ) : (
          <ul className="space-y-1">
            {cats.map((c) => {
              const n = topics.filter((t) => t.categoryId === c.id).length;
              return (
                <li key={c.id}>
                  <button onClick={() => setSelected(c.id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-right text-sm transition ${selected === c.id ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base" style={{ background: `${c.color}33` }}>{c.icon}</span>
                    <span className="flex-1 truncate font-semibold">{c.name}</span>
                    <span className={`text-[11px] ${selected === c.id ? "text-white/70" : "text-slate-400"}`}>{fa(n)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* topics column */}
      <section className="space-y-4">
        {current ? (
          <>
            <div className="card flex flex-wrap items-center gap-3 p-4" style={{ borderTop: `4px solid ${current.color}` }}>
              <span className="grid h-12 w-12 place-items-center rounded-xl text-2xl" style={{ background: `${current.color}22` }}>{current.icon}</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold">{current.name}</h2>
                <p className="truncate text-xs text-slate-500">{current.description || "بدون توضیح"} · slug: <span dir="ltr">{current.slug}</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCatModal(current)} className="btn-secondary px-3 py-1.5 text-xs">ویرایش</button>
                <button onClick={() => deleteCategory(current.id)} className="btn-danger px-3 py-1.5 text-xs">حذف</button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-extrabold">مبحث‌ها ({fa(currentTopics.length)})</h3>
              <button onClick={() => setTopicModal({ title: "", description: "", isPublished: true })} className="btn-primary px-3 py-1.5 text-xs">+ مبحث جدید</button>
            </div>

            {currentTopics.length === 0 ? (
              <EmptyState icon="📚" title="این دسته هنوز مبحثی ندارد" description="اولین مبحث را بسازید و سپس ایستگاه و سؤال اضافه کنید." action={<button onClick={() => setTopicModal({ title: "", description: "", isPublished: true })} className="btn-primary mt-2">ساخت مبحث</button>} />
            ) : (
              <ul className="space-y-2">
                {currentTopics.map((t, i) => (
                  <li key={t.id} className="card flex flex-wrap items-center gap-3 p-4">
                    <div className="flex flex-col">
                      <button onClick={() => moveTopic(t, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-800 disabled:opacity-20">▲</button>
                      <button onClick={() => moveTopic(t, 1)} disabled={i === currentTopics.length - 1} className="text-slate-400 hover:text-slate-800 disabled:opacity-20">▼</button>
                    </div>
                    <span className="grid h-9 w-9 place-items-center rounded-lg text-sm font-black text-white" style={{ background: current.color }}>{fa(i + 1)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{t.title} {!t.isPublished && <span className="chip bg-slate-100 text-slate-500">پیش‌نویس</span>}</p>
                      <p className="truncate text-xs text-slate-500">{t.description}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{fa(t.stationCount)} ایستگاه · {fa(t.questionCount)} سؤال</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Link href={`/admin/content/${t.id}`} className="btn-primary px-3 py-1.5 text-xs">ایستگاه‌ها و سؤال‌ها</Link>
                      <button onClick={() => togglePublish(t)} className="btn-secondary px-3 py-1.5 text-xs">{t.isPublished ? "پنهان کردن" : "انتشار"}</button>
                      <button onClick={() => setTopicModal(t)} className="btn-secondary px-3 py-1.5 text-xs">ویرایش</button>
                      <button onClick={() => deleteTopic(t.id)} className="btn-danger px-3 py-1.5 text-xs">حذف</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <EmptyState icon="🗂️" title="دسته‌ای انتخاب نشده" description="یک دسته بسازید تا مبحث‌ها را مدیریت کنید." action={<button onClick={() => setCatModal({ name: "", color: PALETTE[0], icon: ICONS[0] })} className="btn-primary mt-2">ساخت اولین دسته</button>} />
        )}
      </section>

      {/* category modal */}
      {catModal && (
        <Modal title={catModal.id ? "ویرایش دسته" : "دستهٔ جدید"} onClose={() => setCatModal(null)}>
          <form onSubmit={saveCategory} className="space-y-3">
            <div><label className="label">نام</label><input className="input" required value={catModal.name ?? ""} onChange={(e) => setCatModal({ ...catModal, name: e.target.value })} /></div>
            <div><label className="label">توضیح</label><textarea className="input" rows={2} value={catModal.description ?? ""} onChange={(e) => setCatModal({ ...catModal, description: e.target.value })} /></div>
            <div>
              <label className="label">آیکون</label>
              <div className="flex flex-wrap gap-1.5">{ICONS.map((ic) => <button type="button" key={ic} onClick={() => setCatModal({ ...catModal, icon: ic })} className={`grid h-9 w-9 place-items-center rounded-lg text-lg ${catModal.icon === ic ? "bg-slate-900" : "bg-slate-100 hover:bg-slate-200"}`}>{ic}</button>)}</div>
            </div>
            <div>
              <label className="label">رنگ</label>
              <div className="flex flex-wrap gap-1.5">{PALETTE.map((p) => <button type="button" key={p} onClick={() => setCatModal({ ...catModal, color: p })} className={`h-8 w-8 rounded-full ring-offset-2 ${catModal.color === p ? "ring-2 ring-slate-900" : ""}`} style={{ background: p }} />)}</div>
            </div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setCatModal(null)} className="btn-secondary">انصراف</button><button className="btn-primary" disabled={busy}>ذخیره</button></div>
          </form>
        </Modal>
      )}

      {/* topic modal */}
      {topicModal && (
        <Modal title={topicModal.id ? "ویرایش مبحث" : "مبحث جدید"} onClose={() => setTopicModal(null)}>
          <form onSubmit={saveTopic} className="space-y-3">
            <div><label className="label">عنوان</label><input className="input" required value={topicModal.title ?? ""} onChange={(e) => setTopicModal({ ...topicModal, title: e.target.value })} /></div>
            <div><label className="label">توضیح</label><textarea className="input" rows={2} value={topicModal.description ?? ""} onChange={(e) => setTopicModal({ ...topicModal, description: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={topicModal.isPublished !== false} onChange={(e) => setTopicModal({ ...topicModal, isPublished: e.target.checked })} /> منتشر شود (برای دانشجویان قابل مشاهده)</label>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setTopicModal(null)} className="btn-secondary">انصراف</button><button className="btn-primary" disabled={busy}>ذخیره</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg animate-pop p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button onClick={onClose} className="btn-ghost px-2">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
