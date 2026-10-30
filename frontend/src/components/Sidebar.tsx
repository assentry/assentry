import { Activity, Bot, LayoutGrid, LogOut, ShieldCheck } from "lucide-react";
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
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col justify-between bg-slate-900 px-4 py-6">
      <div>
        <Logo variant="dark" className="mb-8 px-2" />
        <nav className="space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
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
    </aside>
  );
}
