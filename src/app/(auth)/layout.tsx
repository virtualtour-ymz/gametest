import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { seed } from "@/db/seed";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  await seed().catch(() => null);
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-violet-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -right-16 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <Link href="/" className="relative z-10 flex items-center gap-2 text-xl font-extrabold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-2xl">🩺</span>
          نِرس‌آرنا
        </Link>
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-black leading-tight">آزمون بالینی را مثل یک بازی تمرین کنید</h1>
          <p className="max-w-md text-lg text-white/80">
            ایستگاه‌های بالینی واقعی، چهار نوع سؤال، امتیاز و سطح، نشان‌ها و مرور هوشمند سؤال‌های ضعیف — همه در یک جا.
          </p>
          <ul className="grid gap-3 text-sm text-white/90">
            {["🎯 مسیرهای یادگیری مرحله‌به‌مرحله", "🔥 استریک روزانه و امتیاز تجربه", "🔁 مرور فاصله‌دار سؤال‌های اشتباه", "🏆 جدول رتبه‌بندی عمومی"].map((t) => (
              <li key={t} className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur">{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/60">ویژهٔ دانشجویان پرستاری در آستانهٔ آزمون صلاحیت حرفه‌ای و کارآموزی بالینی</p>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </section>
    </main>
  );
}
