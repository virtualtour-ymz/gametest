import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories, questions, stations, topics } from "@/db/schema";
import { createResource, guardAdmin, isResource } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ resource: string }> }) {
  const g = await guardAdmin();
  if ("error" in g) return g.error;
  const { resource } = await params;
  if (!isResource(resource)) return Response.json({ error: "Not found" }, { status: 404 });
  const rows =
    resource === "categories"
      ? await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id))
      : resource === "topics"
        ? await db.select().from(topics).orderBy(asc(topics.sortOrder), asc(topics.id))
        : resource === "stations"
          ? await db.select().from(stations).orderBy(asc(stations.sortOrder), asc(stations.id))
          : await db.select().from(questions).orderBy(asc(questions.sortOrder), asc(questions.id));
  return Response.json({ rows });
}

export async function POST(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  const g = await guardAdmin();
  if ("error" in g) return g.error;
  const { resource } = await params;
  if (!isResource(resource)) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await createResource(resource, body);
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ row: result.row }, { status: 201 });
}
