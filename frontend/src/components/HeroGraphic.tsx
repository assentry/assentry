import { ShieldCheck } from "lucide-react";

// An original composition, not a copied image: a verified-identity badge at
// the center, small nodes orbiting it (the agents it authorises), set
// against a horizontal dot-band glow — echoes the "big dramatic visual
// anchor behind a halo of dots" structure of the reference, built from
// scratch for HAPI's own subject (identity/verification, not a robot).
export function HeroGraphic() {
  const nodes = [
    { angle: -55, distance: 170, size: "h-10 w-10", delay: "0s" },
    { angle: -15, distance: 200, size: "h-7 w-7", delay: "0.6s" },
    { angle: 35, distance: 180, size: "h-8 w-8", delay: "1.2s" },
    { angle: 100, distance: 190, size: "h-6 w-6", delay: "0.3s" },
    { angle: 150, distance: 175, size: "h-9 w-9", delay: "0.9s" },
    { angle: -115, distance: 185, size: "h-7 w-7", delay: "1.5s" },
  ];

  return (
    <div className="relative mx-auto flex h-[420px] w-full max-w-xl items-center justify-center">
      {/* Horizontal dot-band halo behind the badge */}
      <div
        className="absolute left-1/2 top-1/2 h-40 w-[140%] -translate-x-1/2 -translate-y-1/2"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(165,180,252,0.5) 1.5px, transparent 1.5px)",
          backgroundSize: "16px 16px",
          maskImage:
            "radial-gradient(ellipse 60% 100% at center, black 0%, black 35%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 100% at center, black 0%, black 35%, transparent 75%)",
        }}
      />

      {/* Soft glow behind everything */}
      <div className="absolute h-72 w-72 rounded-full bg-indigo-400/30 blur-3xl" />

      {/* Orbiting nodes representing connected agents */}
      {nodes.map((node, i) => {
        const rad = (node.angle * Math.PI) / 180;
        const x = Math.cos(rad) * node.distance;
        const y = Math.sin(rad) * node.distance * 0.6;
        return (
          <div
            key={i}
            className={`absolute ${node.size} animate-pulse rounded-full border border-white/30 bg-white/10 backdrop-blur-sm`}
            style={{ transform: `translate(${x}px, ${y}px)`, animationDelay: node.delay, animationDuration: "3s" }}
          />
        );
      })}

      {/* Central verified-identity badge */}
      <div className="relative flex h-44 w-44 items-center justify-center rounded-[2.25rem] bg-gradient-to-br from-indigo-400 to-violet-600 shadow-2xl shadow-indigo-900/40 ring-1 ring-white/20">
        <div className="absolute inset-0 rounded-[2.25rem] bg-gradient-to-br from-white/20 to-transparent" />
        <ShieldCheck className="h-20 w-20 text-white drop-shadow-lg" strokeWidth={1.75} />
      </div>
    </div>
  );
}
