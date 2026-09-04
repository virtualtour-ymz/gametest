import AuthForm from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <div className="card p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-3xl animate-float">🚀</div>
        <h1 className="text-2xl font-extrabold">ساخت حساب جدید</h1>
        <p className="mt-1 text-sm text-slate-500">رایگان شروع کنید و اولین ایستگاه را همین حالا بگذرانید</p>
      </div>
      <AuthForm mode="register" />
    </div>
  );
}
