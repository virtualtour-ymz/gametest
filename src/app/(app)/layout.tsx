import type { ReactNode } from "react";
import { and, count, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { reviewItems } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  let reviewDue = 0;
  if (user) {
    const [{ c }] = await db
      .select({ c: count() })
      .from(reviewItems)
      .where(and(eq(reviewItems.userId, user.id), lte(reviewItems.dueAt, new Date())));
    reviewDue = Number(c);
  }
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar user={user} reviewDue={reviewDue} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
