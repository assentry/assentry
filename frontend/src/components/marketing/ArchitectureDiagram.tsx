"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../lib/useReducedMotion";

type NodeId = "person" | "app" | "agent" | "website" | "grants" | "oauth" | "mcp" | "verify" | "audit";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  key: string;
  width: number;
  height: number;
  hapi: Rect;
  nodes: Record<NodeId, Rect>;
  titleSize: number;
  subSize: number;
}

const NODE_TEXT: Record<NodeId, { title: string; sub: string }> = {
  person: { title: "Person", sub: "Owns the identity" },
  app: { title: "Personal app", sub: "Consent & control" },
  agent: { title: "AI agent", sub: "Claude · ChatGPT · Grok" },
  website: { title: "Website", sub: "@hapi-id/sdk installed" },
  grants: { title: "Grants", sub: "Which agent · which fields · until when" },
  oauth: { title: "OAuth 2.1 server", sub: "Connects the agent, no secrets shown" },
  mcp: { title: "MCP server", sub: "Issues short-lived credentials" },
  verify: { title: "/verify · /profile", sub: "Checks credentials, discloses consented fields" },
  audit: { title: "Audit log", sub: "Every decision, visible to the person" },
};

const OUTSIDE: NodeId[] = ["person", "app", "agent", "website"];
const INSIDE: NodeId[] = ["grants", "oauth", "mcp", "verify", "audit"];

const DESKTOP: Layout = {
  key: "d",
  width: 1000,
  height: 540,
  hapi: { x: 320, y: 20, w: 360, h: 500 },
  nodes: {
    person: { x: 30, y: 70, w: 190, h: 66 },
    app: { x: 30, y: 300, w: 190, h: 66 },
    agent: { x: 780, y: 70, w: 190, h: 66 },
    website: { x: 780, y: 300, w: 190, h: 66 },
    grants: { x: 350, y: 70, w: 300, h: 60 },
    oauth: { x: 350, y: 150, w: 300, h: 60 },
    mcp: { x: 350, y: 230, w: 300, h: 60 },
    verify: { x: 350, y: 310, w: 300, h: 60 },
    audit: { x: 350, y: 430, w: 300, h: 60 },
  },
  titleSize: 15,
  subSize: 11,
};

const MOBILE: Layout = {
  key: "m",
  width: 400,
  height: 690,
  hapi: { x: 12, y: 200, w: 376, h: 470 },
  nodes: {
    person: { x: 12, y: 12, w: 182, h: 60 },
    agent: { x: 206, y: 12, w: 182, h: 60 },
    app: { x: 12, y: 108, w: 182, h: 60 },
    website: { x: 206, y: 108, w: 182, h: 60 },
    grants: { x: 32, y: 244, w: 336, h: 56 },
    oauth: { x: 32, y: 316, w: 336, h: 56 },
    mcp: { x: 32, y: 388, w: 336, h: 56 },
    verify: { x: 32, y: 460, w: 336, h: 56 },
    audit: { x: 32, y: 596, w: 336, h: 56 },
  },
  titleSize: 14,
  subSize: 10,
};

// One colour per step, so every part of the flow keeps its own highlight
// once its step has played.
const STEP_COLORS = [
  "#22d3ee", // cyan
  "#38bdf8", // sky
  "#2dd4bf", // teal
  "#818cf8", // indigo
  "#a78bfa", // violet
  "#e879f9", // fuchsia
  "#f472b6", // pink
  "#fbbf24", // amber
  "#34d399", // emerald
];

interface Step {
  from: NodeId;
  to: NodeId;
  offset?: number;
  // Force a horizontal or vertical route in a given layout where the
  // automatic nearest-side choice would cut through another box.
  axis?: Partial<Record<"d" | "m", "h" | "v">>;
  color: string;
  title: string;
  detail: string;
}

// One request, end to end, exactly as the real system handles it.
const STEPS: Step[] = [
  {
    from: "person",
    to: "app",
    color: STEP_COLORS[0],
    title: "A person signs in",
    detail: "They create their HAPI identity in the personal app.",
  },
  {
    from: "agent",
    to: "oauth",
    color: STEP_COLORS[1],
    title: "Their AI agent connects",
    detail:
      "The agent connects through HAPI's OAuth 2.1 flow. The person approves it on a HAPI screen. No keys or secrets are ever copied by hand.",
  },
  {
    from: "app",
    to: "grants",
    axis: { d: "h" },
    color: STEP_COLORS[2],
    title: "The person grants permission",
    detail:
      "They choose which agent, which personal fields it may share, and for how long. Connecting an agent grants nothing on its own.",
  },
  {
    from: "mcp",
    to: "agent",
    offset: 14,
    color: STEP_COLORS[3],
    title: "The agent fetches a credential",
    detail:
      "Right before acting, the agent asks HAPI's MCP server for a fresh, short-lived signed credential. It holds IDs and an expiry, never personal data.",
  },
  {
    from: "agent",
    to: "website",
    color: STEP_COLORS[4],
    title: "The agent presents it",
    detail:
      "It sends the credential to the website as a standard Authorization: Bearer header. No password, no form filling.",
  },
  {
    from: "website",
    to: "verify",
    color: STEP_COLORS[5],
    title: "The website checks with HAPI",
    detail:
      "The website's SDK calls /verify. HAPI re-checks the grant live: not revoked, not expired, agent still connected.",
  },
  {
    from: "verify",
    to: "website",
    offset: 14,
    color: STEP_COLORS[6],
    title: "HAPI answers",
    detail:
      "Valid or not, plus (via /profile) only the fields the person consented to share. What happens next is the website's own decision.",
  },
  {
    from: "verify",
    to: "audit",
    color: STEP_COLORS[7],
    title: "Everything is recorded",
    detail: "Every verification and every disclosure is written to the audit log.",
  },
  {
    from: "audit",
    to: "app",
    color: STEP_COLORS[8],
    title: "The person stays in control",
    detail:
      "They see every action in their personal app, and can revoke the agent or the grant at any time. It stops working immediately.",
  },
];

const STEP_MS = 3400;

function center(r: Rect) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

// Connects the nearest sides of two boxes with a smooth curve. `offset`
// shifts both ends sideways so a reply can run alongside its request.
function edgePath(a: Rect, b: Rect, offset = 0, axis?: "h" | "v"): string {
  const ac = center(a);
  const bc = center(b);
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  const horizontal = axis
    ? axis === "h"
    : Math.abs(dx) - (a.w + b.w) / 2 > Math.abs(dy) - (a.h + b.h) / 2;

  if (horizontal) {
    const x1 = dx > 0 ? a.x + a.w : a.x;
    const x2 = dx > 0 ? b.x : b.x + b.w;
    const y1 = ac.y + offset;
    const y2 = bc.y + offset;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }

  const y1 = dy > 0 ? a.y + a.h : a.y;
  const y2 = dy > 0 ? b.y : b.y + b.h;
  const x1 = ac.x + offset;
  const x2 = bc.x + offset;
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}

function Packet({ d, color, filterId }: { d: string; color: string; filterId: string }) {
  const motion = useRef<SVGAnimationElement>(null);

  // Animation elements inserted after page load have already "missed" a
  // begin="0s" start, so start each one explicitly, before first paint.
  useLayoutEffect(() => {
    motion.current?.beginElement();
  }, [d]);

  return (
    <circle r={6} fill={color} filter={`url(#${filterId})`}>
      <animateMotion
        ref={motion as unknown as React.Ref<SVGAnimateMotionElement>}
        dur="1.5s"
        begin="indefinite"
        fill="freeze"
        calcMode="spline"
        keyTimes="0;1"
        keySplines="0.4 0 0.2 1"
        path={d}
      />
    </circle>
  );
}

function Diagram({
  layout,
  step,
  reduced,
  className,
}: {
  layout: Layout;
  step: number;
  reduced: boolean;
  className: string;
}) {
  const active = STEPS[step];
  const activeNodes = new Set<NodeId>([active.from, active.to]);
  // A box keeps the colour of the most recent step that reached it.
  const nodeColor: Partial<Record<NodeId, string>> = {};
  STEPS.slice(0, step + 1).forEach((s) => {
    nodeColor[s.from] = s.color;
    nodeColor[s.to] = s.color;
  });
  const glow = `glow-${layout.key}`;
  const paths = STEPS.map((s) =>
    edgePath(layout.nodes[s.from], layout.nodes[s.to], s.offset, s.axis?.[layout.key as "d" | "m"]),
  );

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className={`h-auto w-full ${className}`}
      role="img"
      aria-label="HAPI architecture: a person, their AI agent and a website, connected through HAPI's grants, OAuth server, MCP server, verification API and audit log."
    >
      <defs>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {[
          ...STEPS.map((s, i) => ({ id: `arrow-${i}-${layout.key}`, color: s.color })),
          { id: `arrow-dim-${layout.key}`, color: "rgba(148,163,184,0.35)" },
        ].map((m) => (
          <marker key={m.id} id={m.id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={m.color} />
          </marker>
        ))}
      </defs>

      {/* HAPI boundary */}
      <rect
        x={layout.hapi.x}
        y={layout.hapi.y}
        width={layout.hapi.w}
        height={layout.hapi.h}
        rx={24}
        fill="rgba(34,211,238,0.035)"
        stroke="rgba(34,211,238,0.3)"
        strokeDasharray="6 6"
      />
      <text
        x={layout.hapi.x + 20}
        y={layout.hapi.y + 30}
        fill="#67e8f9"
        fontSize={layout.titleSize + 1}
        fontWeight={700}
        letterSpacing="0.08em"
      >
        HAPI
      </text>

      {/* Connections */}
      {STEPS.map((s, i) => {
        const isActive = i === step;
        const isLit = i <= step;
        return (
          <path
            key={i}
            d={paths[i]}
            fill="none"
            stroke={isLit ? s.color : "rgba(148,163,184,0.22)"}
            strokeWidth={isLit ? 2.2 : 1.2}
            strokeDasharray={isLit ? "6 10" : "4 6"}
            className={isLit && !reduced ? "animate-dash" : undefined}
            markerEnd={`url(#arrow-${isLit ? i : "dim"}-${layout.key})`}
          />
        );
      })}

      {/* Boxes */}
      {[...OUTSIDE, ...INSIDE].map((id) => {
        const r = layout.nodes[id];
        const c = center(r);
        const isActive = activeNodes.has(id);
        const color = nodeColor[id];
        const inside = INSIDE.includes(id);
        return (
          <g key={id}>
            <rect
              x={r.x}
              y={r.y}
              width={r.w}
              height={r.h}
              rx={14}
              fill={inside ? "#0a1430" : "#0b1226"}
              stroke={color ?? "rgba(255,255,255,0.12)"}
              strokeWidth={color ? 2 : 1}
              filter={isActive ? `url(#${glow})` : undefined}
              style={{ transition: "stroke 300ms ease" }}
            />
            <text
              x={c.x}
              y={c.y - 3}
              textAnchor="middle"
              fill={color ? "#ffffff" : "#e2e8f0"}
              fontSize={layout.titleSize}
              fontWeight={600}
            >
              {NODE_TEXT[id].title}
            </text>
            <text x={c.x} y={c.y + layout.subSize + 5} textAnchor="middle" fill="#94a3b8" fontSize={layout.subSize}>
              {NODE_TEXT[id].sub}
            </text>
          </g>
        );
      })}

      {!reduced && <Packet key={step} d={paths[step]} color={active.color} filterId={glow} />}
    </svg>
  );
}

export function ArchitectureDiagram() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (reduced || !playing) return;
    const timer = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(timer);
  }, [step, playing, reduced]);

  const current = STEPS[step];
  const autoplay = playing && !reduced;

  return (
    <section id="how-it-works" className="relative px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">How HAPI works</h2>
        </div>

        <div className="glass rounded-3xl p-3 sm:p-6">
          <Diagram layout={DESKTOP} step={step} reduced={reduced} className="hidden md:block" />
          <Diagram layout={MOBILE} step={step} reduced={reduced} className="md:hidden" />

          <div className="mt-5 border-t border-white/10 pt-5 sm:px-2" aria-live="polite">
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: current.color }}>
              Step {step + 1} of {STEPS.length}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">{current.title}</h3>
            <p className="mt-1 min-h-[3rem] text-sm leading-relaxed text-slate-300">{current.detail}</p>
          </div>

          <div className="mt-4 flex items-center gap-3 sm:px-2">
            {!reduced && (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-slate-200 transition-colors hover:bg-white/10"
                aria-label={autoplay ? "Pause the walkthrough" : "Play the walkthrough"}
              >
                {autoplay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
            )}
            <div className="flex flex-1 flex-wrap gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setStep(i);
                    setPlaying(false);
                  }}
                  aria-label={`Step ${i + 1}: ${s.title}`}
                  aria-current={i === step ? "step" : undefined}
                  className={`h-2 flex-1 rounded-full transition-colors ${i <= step ? "" : "bg-white/10 hover:bg-white/20"}`}
                  style={i <= step ? { backgroundColor: s.color, opacity: i === step ? 1 : 0.7 } : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
