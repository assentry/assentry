"use client";

import { AlertTriangle, Check, Play, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge, Card } from "../ui";

const STEPS = [
  "User grants permission through HAPI.",
  "AI assistant requests access.",
  "HAPI validates the identity and permission.",
  "AI agent visits a participating job website.",
  "Website requests verification.",
  "HAPI confirms the agent's authority.",
  "Application proceeds within the granted permissions.",
  "User receives an execution report.",
];

type PermKey = "cv" | "employmentHistory" | "jobSearch" | "submitApplications" | "legalDeclarations";

const PERMISSIONS: { key: PermKey; label: string }[] = [
  { key: "cv", label: "Access approved CV" },
  { key: "employmentHistory", label: "Access employment history" },
  { key: "jobSearch", label: "Search job listings" },
  { key: "submitApplications", label: "Submit applications" },
  { key: "legalDeclarations", label: "Sign legal declarations" },
];

const STEP_DELAY_MS = 1100;

export function InteractiveDemoSection() {
  const [permissions, setPermissions] = useState<Record<PermKey, boolean>>({
    cv: true,
    employmentHistory: true,
    jobSearch: true,
    submitApplications: true,
    legalDeclarations: true,
  });
  const [stepIndex, setStepIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [report, setReport] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function buildReport(outcome: "blocked-search" | "blocked-submit" | "completed"): { ok: boolean; lines: string[] } {
    if (outcome === "blocked-search") {
      return {
        ok: false,
        lines: [
          "Blocked at step 04 — job search was not authorised, so the agent never reached the job website.",
        ],
      };
    }
    if (outcome === "blocked-submit") {
      return {
        ok: false,
        lines: [
          "Agent found matching listings, but submitting applications was not authorised.",
          "No application was sent.",
        ],
      };
    }
    const lines = [
      permissions.cv ? "Resume attached from your approved CV." : "Resume omitted — CV access was not authorised.",
      permissions.employmentHistory
        ? "Employment history included in the application."
        : "Employment history omitted — not authorised.",
      permissions.legalDeclarations
        ? "Legal declaration signed after your explicit approval."
        : "Legal declaration skipped — signing was not authorised.",
      "Application submitted to the participating job website.",
    ];
    return { ok: true, lines };
  }

  function schedule(next: () => void, delay = STEP_DELAY_MS) {
    timer.current = setTimeout(() => {
      if (!cancelled.current) next();
    }, delay);
  }

  function runFrom(index: number) {
    setStepIndex(index);

    // Step 04 — reaching the job website at all requires job-search access.
    if (index === 3 && !permissions.jobSearch) {
      schedule(() => {
        setStepIndex(7);
        setReport(buildReport("blocked-search"));
        setRunning(false);
      });
      return;
    }

    // Step 07 — the action itself requires submit access, and signing a
    // legal declaration is a sensitive action gated on explicit human
    // approval, independent of whatever else was pre-authorised.
    if (index === 6) {
      if (!permissions.submitApplications) {
        schedule(() => {
          setStepIndex(7);
          setReport(buildReport("blocked-submit"));
          setRunning(false);
        });
        return;
      }
      if (permissions.legalDeclarations) {
        schedule(() => setWaitingApproval(true));
        return;
      }
      schedule(() => runFrom(7));
      return;
    }

    if (index === 7) {
      setReport(buildReport("completed"));
      setRunning(false);
      return;
    }

    schedule(() => runFrom(index + 1));
  }

  function start() {
    setReport(null);
    setWaitingApproval(false);
    setRunning(true);
    runFrom(0);
  }

  function approve() {
    setWaitingApproval(false);
    runFrom(7);
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setStepIndex(-1);
    setRunning(false);
    setWaitingApproval(false);
    setReport(null);
  }

  return (
    <section className="relative mx-auto max-w-6xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">See HAPI in Action</h2>
        <p className="mt-4 text-slate-400">
          "Find suitable jobs and apply using my approved CV." A simulated walkthrough of an agent
          acting on a HAPI-authorised task.
        </p>
        <Badge tone="warning">Demonstration only — not a live integration</Badge>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-white">Permission panel</h3>
          <div className="space-y-2.5">
            {PERMISSIONS.map((perm) => (
              <label
                key={perm.key}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5 text-sm text-slate-300"
              >
                {perm.label}
                <button
                  type="button"
                  disabled={running}
                  onClick={() => setPermissions((p) => ({ ...p, [perm.key]: !p[perm.key] }))}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
                    permissions[perm.key] ? "bg-cyan-400" : "bg-white/15"
                  }`}
                  aria-label={`Toggle ${perm.label}`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-navy-950 transition-transform ${
                      permissions[perm.key] ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={start}
              disabled={running}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 px-3.5 py-2 text-sm font-medium text-navy-950 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" /> Run simulation
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3.5 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <h3 className="mb-4 text-sm font-semibold text-white">Execution trace</h3>
          <ol className="space-y-3">
            {STEPS.map((label, i) => {
              const active = i === stepIndex;
              const complete = stepIndex > i || (stepIndex === 7 && i === 7);
              return (
                <li key={label} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      complete
                        ? "bg-cyan-400/20 text-cyan-300"
                        : active
                          ? "bg-violet-400/20 text-violet-300"
                          : "border border-white/15 text-slate-500"
                    }`}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={`text-sm ${active || complete ? "text-slate-200" : "text-slate-500"}`}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          {waitingApproval && (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                <p className="text-sm text-amber-200">
                  Sensitive action — signing a legal declaration requires your explicit approval.
                </p>
              </div>
              <button
                onClick={approve}
                className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-navy-950"
              >
                Approve
              </button>
            </div>
          )}

          {report && (
            <div
              className={`mt-5 rounded-xl border p-4 ${
                report.ok ? "border-cyan-400/25 bg-cyan-400/5" : "border-rose-400/25 bg-rose-400/5"
              }`}
            >
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                {report.ok ? (
                  <ShieldCheck className="h-4 w-4 text-cyan-300" />
                ) : (
                  <X className="h-4 w-4 text-rose-300" />
                )}
                <span className={report.ok ? "text-cyan-200" : "text-rose-200"}>Execution report</span>
              </p>
              <ul className="space-y-1 text-sm text-slate-300">
                {report.lines.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
