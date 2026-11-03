"use client";

import { Activity, Bot, LayoutGrid, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";

export type Tab = "overview" | "agents" | "grants" | "audit";

const NAV: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "grants", label: "Authorisations", icon: ShieldCheck },
  { id: "audit", label: "Activity", icon: Activity },
];

export function Sidebar({
  tab,
  onTabChange,
  email,
  onSignOut,
}: {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  email: string;
  onSignOut: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function selectTab(id: Tab) {
    onTabChange(id);
    setMobileOpen(false);
  }

  const content = (
    <>
      <div>
        <div className="mb-8 flex items-center justify-between px-2">
          <Logo />
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => selectTab(id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-white/10 pt-4">
        <p className="truncate px-2 text-xs text-slate-500">{email}</p>
        <button
          onClick={onSignOut}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-white/10 bg-navy-900 px-4 py-3 lg:hidden">
        <Logo />
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-white/5"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer + backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col justify-between bg-navy-900 px-4 py-6 shadow-xl">
            {content}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-white/10 bg-navy-900 px-4 py-6 lg:flex">
        {content}
      </aside>
    </>
  );
}
