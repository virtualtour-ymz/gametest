import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { seed } from "@/db/seed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await seed().catch(() => null);
  const user = await getCurrentUser();
  redirect(user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/login");
}
