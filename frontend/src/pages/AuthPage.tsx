import { useState } from "react";
import { Button, Card, Input, Label } from "../components/ui";
import { Logo } from "../components/Logo";
import { api, ApiError, setToken } from "../lib/api";
import type { User } from "../lib/types";

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-indigo-50/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="text-sm text-slate-500">
            The identity layer between you, your AI agents, and the sites they act on.
          </p>
        </div>

        <Card>
          <div className="mb-5 flex rounded-lg bg-slate-100 p-1 text-sm">
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

          <form onSubmit={submit} className="space-y-4">
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
        </Card>
      </div>
    </div>
  );
}
