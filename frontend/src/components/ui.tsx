"use client";

import { Check, ChevronDown, Plus, X } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl p-6 transition-colors duration-200 hover:bg-white/[0.06] ${className}`}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-br from-white to-neutral-400 text-navy-950 shadow-sm shadow-black/40 hover:shadow-md hover:shadow-black/40 hover:brightness-105 focus-visible:outline-neutral-400",
  secondary:
    "border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 focus-visible:outline-white/40",
  danger: "border border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 focus-visible:outline-rose-400",
  ghost: "text-slate-300 hover:bg-white/5",
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
      className={`w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-white/15 bg-navy-900 px-3 py-2 text-sm text-slate-100 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 ${props.className ?? ""}`}
    />
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-slate-400">
      {children}
    </label>
  );
}

type BadgeTone = "success" | "danger" | "warning" | "neutral";

const badgeTones: Record<BadgeTone, string> = {
  success: "bg-white/10 text-neutral-300 ring-white/25",
  danger: "bg-rose-500/10 text-rose-300 ring-rose-400/25",
  warning: "bg-white/10 text-neutral-300 ring-white/25",
  neutral: "bg-white/5 text-slate-400 ring-white/10",
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
    <p className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-400">
      {children}
    </p>
  );
}

type StatTone = "cyan" | "violet" | "slate";

const statTones: Record<StatTone, { icon: string; ring: string }> = {
  cyan: { icon: "bg-white/10 text-neutral-300", ring: "ring-white/20" },
  violet: { icon: "bg-white/10 text-neutral-300", ring: "ring-white/20" },
  slate: { icon: "bg-white/5 text-slate-300", ring: "ring-white/10" },
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
        className="flex w-full min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-left text-sm focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
      >
        {selected.length === 0 ? (
          <span className="text-slate-500">{placeholder}</span>
        ) : (
          selected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-medium text-neutral-300"
            >
              {labelFor(value)}
              <X
                className="h-3 w-3 cursor-pointer hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(value);
                }}
              />
            </span>
          ))
        )}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-slate-500" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-navy-900 p-1.5 shadow-xl shadow-black/40">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-white/5"
              >
                <span className="text-slate-300">{option.label}</span>
                {checked && <Check className="h-4 w-4 text-neutral-300" />}
              </button>
            );
          })}

          {allowCustom && (
            <div className="mt-1 flex items-center gap-1.5 border-t border-white/10 p-1.5 pt-2">
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
                className="w-full min-w-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 focus:border-neutral-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={addCustom}
                className="flex shrink-0 items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/10"
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
  tone = "cyan",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  tone?: StatTone;
}) {
  return (
    <Card className="flex items-start gap-4">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${statTones[tone].icon} ${statTones[tone].ring}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </Card>
  );
}
