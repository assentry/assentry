// Non-animated fallback for prefers-reduced-motion and for the instant
// before the WebGL scene mounts — same hub-and-spoke composition, same
// Human / AI Agent / Website labeling, as plain CSS.
const NODES = [
  { label: "Human", sublabel: "Owns the identity", color: "#a78bfa", left: "12%", top: "22%" },
  { label: "AI Agent", sublabel: "Claude · ChatGPT · Grok", color: "#22d3ee", left: "50%", top: "82%" },
  { label: "Website", sublabel: "Verifies authority", color: "#38bdf8", left: "88%", top: "22%" },
];

export function StaticTrustNetwork() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden>
        {NODES.map((node, i) => (
          <line
            key={i}
            x1={50}
            y1={50}
            x2={parseFloat(node.left)}
            y2={parseFloat(node.top)}
            stroke={node.color}
            strokeOpacity={0.35}
            strokeWidth={0.3}
            strokeDasharray="1.5 1.5"
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-cyan-400/40 bg-navy-900/80 text-sm font-semibold text-cyan-300 shadow-lg shadow-cyan-500/20">
        HAPI
      </div>

      {NODES.map((node) => (
        <div
          key={node.label}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
          style={{ left: node.left, top: node.top }}
        >
          <div
            className="h-10 w-10 rounded-full"
            style={{ backgroundColor: node.color, boxShadow: `0 0 24px ${node.color}` }}
          />
          <div className="text-center">
            <p className="text-xs font-medium text-slate-200">{node.label}</p>
            <p className="text-[10px] text-slate-500">{node.sublabel}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
