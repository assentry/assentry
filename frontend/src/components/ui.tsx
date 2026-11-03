import { Check, ChevronDown, Plus, X } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.03] transition-shadow duration-200 hover:shadow-md hover:shadow-slate-900/[0.06] ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-600/20 hover:shadow-md hover:shadow-indigo-600/25 hover:brightness-105 focus-visible:outline-indigo-600",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400",
  danger: "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 focus-visible:outline-rose-500",
  ghost: "text-slate-600 hover:bg-slate-100",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${props.className ?? ""}`}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-500">{children}</label>;
}

type BadgeTone = "success" | "danger" | "warning" | "neutral";

const badgeTones: Record<BadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

type StatTone = "indigo" | "emerald" | "slate";

const statTones: Record<StatTone, { icon: string; ring: string }> = {
  indigo: { icon: "bg-indigo-50 text-indigo-600", ring: "ring-indigo-600/10" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", ring: "ring-emerald-600/10" },
  slate: { icon: "bg-slate-100 text-slate-600", ring: "ring-slate-500/10" },
};

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select fields…",
  allowCustom = true,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  function remove(value: string) {
    onChange(selected.filter((v) => v !== value));
  }

  function addCustom() {
    const value = customValue.trim();
    if (value && !selected.includes(value)) onChange([...selected, value]);
    setCustomValue("");
  }

  function labelFor(value: string): string {
    return options.find((o) => o.value === value)?.label ?? value;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-left text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {selected.length === 0 ? (
          <span className="text-slate-400">{placeholder}</span>
        ) : (
          selected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700"
            >
              {labelFor(value)}
              <X
                className="h-3 w-3 cursor-pointer hover:text-indigo-900"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(value);
                }}
              />
            </span>
          ))
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-slate-50"
              >
                <span className="text-slate-700">{option.label}</span>
                {checked && <Check className="h-4 w-4 text-indigo-600" />}
              </button>
            );
          })}

          {allowCustom && (
            <div className="mt-1 flex items-center gap-1.5 border-t border-slate-100 p-1.5 pt-2">
              <input
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="Custom field…"
                className="w-full min-w-0 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addCustom}
                className="flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "indigo",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  tone?: StatTone;
}) {
  return (
    <Card className="flex items-start gap-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${statTones[tone].icon} ${statTones[tone].ring}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-400">{hint}</p>}
      </div>
    </Card>
  );
}
