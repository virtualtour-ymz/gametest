import Link from "next/link";
import type { ReactNode } from "react";

export function RadialChart({
  percent,
  color = "#6366f1",
  size = 96,
  stroke = 10,
  label,
  sub,
}: {
  percent: number;
  color?: string;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sub?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  const dash = (p / 100) * c;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
        <span className="text-lg font-extrabold" style={{ color }}>
          {label ?? `${Math.round(p)}٪`}
        </span>
        {sub && <span className="text-[10px] text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const initial = name.trim().charAt(0);
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-bold text-white shadow-inner"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}

type LinkAction = { href: string; label: string };
function isLinkAction(a: unknown): a is LinkAction {
  return !!a && typeof a === "object" && "href" in a && "label" in a;
}

export function EmptyState({
  icon = "🗂️",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: { href: string; label: string } | ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-slate-100 text-3xl">{icon}</div>
      <h3 className="text-lg font-bold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {isLinkAction(action) ? (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      ) : (
        (action as ReactNode)
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon, label, value, hint, color = "#6366f1" }: { icon: string; label: string; value: ReactNode; hint?: string; color?: string }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: `${color}1a` }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-xl font-extrabold text-slate-900">{value}</p>
        {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  mcq: { label: "چهارگزینه‌ای", icon: "🔘", color: "#6366f1" },
  fill: { label: "جای خالی", icon: "✍️", color: "#0ea5e9" },
  tf: { label: "صحیح/غلط", icon: "⚖️", color: "#10b981" },
  reorder: { label: "مرتب‌سازی مراحل", icon: "🔀", color: "#f59e0b" },
};

export function fa(n: number | string) {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}
