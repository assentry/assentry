import { Activity, Plug, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button, Input, Label } from "../components/ui";
import { Logo } from "../components/Logo";
import { api, ApiError, setToken } from "../lib/api";
import type { User } from "../lib/types";

const FEATURES = [
  {
    icon: Plug,
    title: "Connect once",
    body: "One connection to your AI — not a separate one for every site it acts on.",
  },
  {
    icon: ShieldCheck,
    title: "Scoped, revocable permission",
    body: "Authorise exactly what's needed, for exactly how long, and pull it back anytime.",
  },
  {
    icon: Activity,
    title: "A record of everything",
    body: "See every time your identity was used, and by whom, in one place.",
  },
];

export function AuthPage({
  onAuthenticated,
  initialMode = "login",
  onBack,
}: {
  onAuthenticated: (user: User) => void;
  initialMode?: "login" | "signup";
  onBack?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/signup";
      const body = mode === "login" ? { email, password } : { email, password, name: name || undefined };
      const data = await api.post<{ token: string; user: User }>(path, body);
      setToken(data.token);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-12 lg:flex">
        <div
          className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-600/20 blur-3xl"
          aria-hidden
        />
        {onBack ? (
          <button onClick={onBack} className="w-fit">
            <Logo variant="dark" />
          </button>
        ) : (
          <Logo variant="dark" />
        )}

        <div className="relative">
          <h1 className="max-w-md text-3xl font-semibold tracking-tight text-white">
            The identity layer between you, your AI agents, and the sites they act on.
          </h1>
          <div className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-slate-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-500">Human API</p>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            {onBack ? (
              <button onClick={onBack}>
                <Logo />
              </button>
            ) : (
              <Logo />
            )}
          </div>

          <div className="mb-6 flex rounded-lg bg-slate-100 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md py-1.5 font-medium transition-colors ${mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Sign up
            </button>
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "login"
              ? "Log in to manage your connected agents and permissions."
              : "Set up your identity before connecting an agent."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
            )}
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
