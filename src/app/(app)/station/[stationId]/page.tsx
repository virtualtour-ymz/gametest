import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, stations, topics } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import QuizPlayer from "@/components/QuizPlayer";

export const dynamic = "force-dynamic";

export default async function StationPage({ params }: { params: Promise<{ stationId: string }> }) {
  await requireUser();
  const { stationId } = await params;
  const id = Number(stationId);
  if (!Number.isFinite(id)) notFound();
  const [row] = await db
    .select({ station: stations, topic: topics, category: categories })
    .from(stations)
    .innerJoin(topics, eq(topics.id, stations.topicId))
    .innerJoin(categories, eq(categories.id, topics.categoryId))
    .where(eq(stations.id, id));
  if (!row) notFound();
  return (
    <div className="animate-fade-up">
      <div className="mb-4 text-center">
        <p className="text-xs font-semibold text-slate-500">{row.category.icon} {row.category.name} › {row.topic.title}</p>
        <h1 className="text-xl font-extrabold">{row.station.title}</h1>
      </div>
      <QuizPlayer mode="station" stationId={id} title={row.station.title} scenario={row.station.scenario} color={row.category.color} backHref={`/learn/${row.topic.id}`} />
    </div>
  );
}
