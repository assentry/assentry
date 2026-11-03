"use client";

import { motion } from "framer-motion";
import { Check, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { Card } from "../ui";

const PERMISSIONS = [
  { label: "Read my CV", status: "allowed" as const },
  { label: "Search for jobs", status: "allowed" as const },
  { label: "Submit applications", status: "allowed" as const },
  { label: "Make purchases", status: "denied" as const },
  { label: "Sign contracts", status: "approval" as const },
];

export function PermissionsSection() {
  const [revoked, setRevoked] = useState(false);

  return (
    <section id="for-people" className="relative mx-auto max-w-6xl px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Delegate Tasks. Never Surrender Control.
          </h2>
          <p className="mt-4 text-slate-400">
            Every permission is specific, limited and revocable. An agent only ever holds the
            exact authorisations you've granted — nothing more — and you can see and withdraw any
            of them at any time.
          </p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">career-agent · Claude</p>
              <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                {revoked ? "Revoked" : "Connected"}
              </span>
            </div>

            <ul className="space-y-2.5">
              {PERMISSIONS.map((perm) => (
                <li
                  key={perm.label}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm ${
                    revoked ? "bg-white/[0.02] text-slate-600" : "bg-white/5 text-slate-300"
                  }`}
                >
                  {perm.label}
                  {perm.status === "allowed" && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-cyan-300">
                      <Check className="h-3.5 w-3.5" /> Allowed
                    </span>
                  )}
                  {perm.status === "denied" && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-300">
                      <X className="h-3.5 w-3.5" /> Not allowed
                    </span>
                  )}
                  {perm.status === "approval" && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                      <ShieldAlert className="h-3.5 w-3.5" /> Human approval required
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setRevoked((v) => !v)}
              className="mt-5 w-full rounded-lg border border-rose-400/30 bg-rose-500/10 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/20"
            >
              {revoked ? "Restore access (demo)" : "Revoke access"}
            </button>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
