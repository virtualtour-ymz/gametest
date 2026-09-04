import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
export { hashPassword, verifyPassword } from "./password";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { redirect } from "next/navigation";
import { cache } from "react";

const COOKIE = "nurse_session";
const SESSION_DAYS = 30;

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, token));
  store.delete(COOKIE);
}

export type SafeUser = Omit<User, "passwordHash">;

export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      avatarColor: users.avatarColor,
      xp: users.xp,
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      lastActiveDate: users.lastActiveDate,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
});

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

/** API-route helpers */
export async function apiUser() {
  return getCurrentUser();
}

export function unauthorized(message = "ابتدا وارد حساب کاربری شوید") {
  return Response.json({ error: message }, { status: 401 });
}

export function forbidden(message = "دسترسی غیرمجاز") {
  return Response.json({ error: message }, { status: 403 });
}
