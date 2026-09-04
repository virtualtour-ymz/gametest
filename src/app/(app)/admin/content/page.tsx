import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, questions, stations, topics } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import ContentManager from "@/components/admin/ContentManager";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const cats = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
  const ts = await db
    .select({
      topic: topics,
      stationCount: sql<number>`(select count(*) from ${stations} where ${stations.topicId} = ${topics.id})`,
      questionCount: sql<number>`(select count(*) from ${questions} q join ${stations} s on s.id = q.station_id where s.topic_id = ${topics.id})`,
    })
    .from(topics)
    .orderBy(asc(topics.sortOrder), asc(topics.id));
  void count;
  void eq;
  return (
    <div className="animate-fade-up">
      <PageHeader title="مدیریت محتوا" subtitle="دسته‌ها و مبحث‌ها را بسازید؛ سپس در هر مبحث ایستگاه‌های بالینی و سؤال‌ها را ویرایش کنید." />
      <ContentManager categories={cats} topics={ts.map((t) => ({ ...t.topic, stationCount: Number(t.stationCount), questionCount: Number(t.questionCount) }))} />
    </div>
  );
}
