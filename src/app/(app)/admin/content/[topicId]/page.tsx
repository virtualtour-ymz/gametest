import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, questions, stations, topics } from "@/db/schema";
import TopicEditor from "@/components/admin/TopicEditor";

export const dynamic = "force-dynamic";

export default async function AdminTopicPage({ params, searchParams }: { params: Promise<{ topicId: string }>; searchParams: Promise<{ station?: string; q?: string }> }) {
  const { topicId } = await params;
  const sp = await searchParams;
  const id = Number(topicId);
  if (!Number.isFinite(id)) notFound();
  const [row] = await db.select({ topic: topics, category: categories }).from(topics).innerJoin(categories, eq(categories.id, topics.categoryId)).where(eq(topics.id, id));
  if (!row) notFound();
  const sts = await db.select().from(stations).where(eq(stations.topicId, id)).orderBy(asc(stations.sortOrder), asc(stations.id));
  const qs = sts.length ? await db.select().from(questions).where(inArray(questions.stationId, sts.map((s) => s.id))).orderBy(asc(questions.sortOrder), asc(questions.id)) : [];

  return (
    <div className="animate-fade-up">
      <nav className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/content" className="hover:text-brand-600">مدیریت محتوا</Link>
        <span>›</span>
        <span>{row.category.icon} {row.category.name}</span>
        <span>›</span>
        <span className="font-semibold text-slate-800">{row.topic.title}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{row.topic.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{row.topic.description}</p>
        </div>
        <Link href={`/learn/${id}`} className="btn-secondary text-xs">پیش‌نمایش دانشجو ↗</Link>
      </div>
      <TopicEditor topicId={id} color={row.category.color} stations={sts} questions={qs} initialStation={sp.station ? Number(sp.station) : undefined} initialQuestion={sp.q ? Number(sp.q) : undefined} />
    </div>
  );
}
