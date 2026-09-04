import { deleteResource, guardAdmin, isResource, updateResource } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ resource: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const g = await guardAdmin();
  if ("error" in g) return g.error;
  const { resource, id } = await params;
  if (!isResource(resource)) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await updateResource(resource, Number(id), body);
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  if (!result.row) return Response.json({ error: "یافت نشد" }, { status: 404 });
  return Response.json({ row: result.row });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const g = await guardAdmin();
  if ("error" in g) return g.error;
  const { resource, id } = await params;
  if (!isResource(resource)) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteResource(resource, Number(id));
  return Response.json({ ok: true });
}
