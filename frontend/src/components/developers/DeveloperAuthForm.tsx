"use client";

import { Code2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "../../lib/api";
import { devApi, setDevToken, type Developer } from "../../lib/devApi";
import { Button, Input, Label } from "../ui";
import { DevHeader } from "./DevHeader";

export function DeveloperAuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
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
      const path = mode === "login" ? "/developer/auth/login" : "/developer/auth/signup";
      const body = mode === "login" ? { email, password } : { email, password, name: name || undefined };
      const data = await devApi.post<{ token: string; developer: Developer }>(path, body);
      setDevToken(data.token);
      router.push("/developers/console");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      <div className="grid-texture pointer-events-none absolute -inset-20 opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/15 blur-3xl" />
      <DevHeader />

      <div className="relative flex justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="glass rounded-2xl border-violet-400/20 p-7 shadow-2xl shadow-black/40">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/30 text-violet-200">
              <Code2 className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Developer console</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
              {mode === "login" ? "Log in to your developer account" : "Create a developer account"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {mode === "login"
                ? "Manage your apps and API keys."
                : "For building Assentry into your website. This is separate from a personal Assentry account."}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
                </div>
              )}
              <div>
                <Label>Work email</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
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

              {error && <p className="text-sm text-rose-400">{error}</p>}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create developer account"}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-400">
              {mode === "login" ? (
                <>
                  New to Assentry?{" "}
                  <Link href="/developers/signup" className="font-medium text-cyan-300 hover:text-cyan-200">
                    Create a developer account
                  </Link>
                </>
              ) : (
                <>
                  Already have one?{" "}
                  <Link href="/developers/login" className="font-medium text-cyan-300 hover:text-cyan-200">
                    Log in
                  </Link>
                </>
              )}
            </p>
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">
            Looking for your personal Assentry account?{" "}
            <Link href="/login" className="text-slate-300 hover:text-white">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
