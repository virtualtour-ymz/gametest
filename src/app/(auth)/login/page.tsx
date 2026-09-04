import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="card p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-3xl animate-float">🩺</div>
        <h1 className="text-2xl font-extrabold">خوش آمدید!</h1>
        <p className="mt-1 text-sm text-slate-500">برای ادامهٔ مسیر یادگیری وارد شوید</p>
      </div>
      <AuthForm mode="login" />
    </div>
  );
}
