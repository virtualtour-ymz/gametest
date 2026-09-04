import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { ensureBadges } from "@/lib/gamification";

export const dynamic = "force-dynamic";

const COLORS = ["#6366f1", "#10b981", "#ec4899", "#3b82f6", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444"];

export async function GET(_: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action === "me") {
    const user = await getCurrentUser();
    return Response.json({ user });
  }
  return Response.json({ error: "Not found" }, { status: 404 });
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;

  if (action === "logout") {
    await destroySession();
    return Response.json({ ok: true });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; name?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return Response.json({ error: "ایمیل و رمز عبور الزامی است" }, { status: 400 });
  }

  if (action === "login") {
    const [u] = await db.select().from(users).where(eq(users.email, email));
    if (!u || !verifyPassword(password, u.passwordHash)) {
      return Response.json({ error: "ایمیل یا رمز عبور اشتباه است" }, { status: 401 });
    }
    await createSession(u.id);
    return Response.json({ ok: true, role: u.role });
  }

  if (action === "register") {
    const name = body.name?.trim() ?? "";
    if (name.length < 2) return Response.json({ error: "نام باید حداقل ۲ حرف باشد" }, { status: 400 });
    if (password.length < 6) return Response.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (exists) return Response.json({ error: "این ایمیل قبلاً ثبت شده است" }, { status: 409 });
    await ensureBadges();
    const [u] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash: hashPassword(password),
        avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
      })
      .returning({ id: users.id });
    await createSession(u.id);
    return Response.json({ ok: true, role: "student" });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
