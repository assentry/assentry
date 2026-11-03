import { ShieldCheck } from "lucide-react";

// An original composition, not a copied image: a verified-identity badge at
// the center, agent-nodes actually orbiting it with animated connection
// lines (not just floating), set against a drifting dot-field glow — built
// from scratch for HAPI's own subject (identity/verification), with real
// motion to read as an active, "agentic" system rather than a static mark.
//
// Positions are expressed as percentages of the container (a 500-unit
// reference space) rather than raw pixels, so the whole composition scales
// correctly on any screen size instead of nodes drifting out of alignment
// with their connection lines on mobile.
const REF = 500;
const NODES = [
  { angle: -55, distance: 170, size: 40, orbitClass: "animate-orbit", dashDelay: "0s" },
  { angle: -15, distance: 200, size: 28, orbitClass: "animate-orbit-reverse", dashDelay: "0.5s" },
  { angle: 35, distance: 180, size: 32, orbitClass: "animate-orbit", dashDelay: "1s" },
  { angle: 100, distance: 190, size: 24, orbitClass: "animate-orbit-reverse", dashDelay: "1.5s" },
  { angle: 150, distance: 175, size: 36, orbitClass: "animate-orbit", dashDelay: "2s" },
  { angle: -115, distance: 185, size: 28, orbitClass: "animate-orbit-reverse", dashDelay: "0.3s" },
];

function nodePosition(angle: number, distance: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * distance;
  const dy = Math.sin(rad) * distance * 0.6;
  return { leftPct: 50 + (dx / REF) * 100, topPct: 50 + (dy / REF) * 100 };
}

export function HeroGraphic() {
  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[500px] items-center justify-center">
      {/* Drifting dot-field halo behind the badge */}
      <div
        className="animate-drift absolute left-1/2 top-1/2 h-[45%] w-[140%] -translate-x-1/2 -translate-y-1/2"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(165,180,252,0.5) 1.5px, transparent 1.5px)",
          backgroundSize: "20px 20px",
          maskImage: "radial-gradient(ellipse 60% 100% at center, black 0%, black 35%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 100% at center, black 0%, black 35%, transparent 75%)",
        }}
      />

      {/* Breathing glow behind everything */}
      <div className="animate-breathe absolute h-[55%] w-[55%] rounded-full bg-indigo-400/30 blur-3xl" />

      {/* Connection lines from center to each node, with a flowing pulse.
          viewBox is 0-100 so it maps 1:1 to percentage-based node positions. */}
      <svg className="absolute h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {NODES.map((node, i) => {
          const { leftPct, topPct } = nodePosition(node.angle, node.distance);
          return (
            <line
              key={i}
              x1={50}
              y1={50}
              x2={leftPct}
              y2={topPct}
              stroke="rgba(199,210,254,0.45)"
              strokeWidth={0.3}
              vectorEffect="non-scaling-stroke"
              className="animate-dash"
              style={{ animationDelay: node.dashDelay }}
            />
          );
        })}
      </svg>

      {/* Orbiting nodes — each wrapped in its own rotating container so the
          orbit is real motion around the center, not just a fixed float */}
      {NODES.map((node, i) => {
        const { leftPct, topPct } = nodePosition(node.angle, node.distance);
        return (
          <div key={i} className={`absolute inset-0 ${node.orbitClass}`} style={{ animationDelay: `-${i * 4}s` }}>
            <div
              className="absolute rounded-full border border-white/30 bg-white/10 backdrop-blur-sm"
              style={{
                width: `${(node.size / REF) * 100}%`,
                aspectRatio: "1 / 1",
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
        );
      })}

      {/* Central verified-identity badge */}
      <div className="relative flex h-[35%] w-[35%] items-center justify-center rounded-[2.25rem] bg-gradient-to-br from-indigo-400 to-violet-600 shadow-2xl shadow-indigo-900/40 ring-1 ring-white/20">
        <div className="absolute inset-0 rounded-[2.25rem] bg-gradient-to-br from-white/20 to-transparent" />
        <ShieldCheck className="h-[55%] w-[55%] text-white drop-shadow-lg" strokeWidth={1.75} />
      </div>
    </div>
  );
}
