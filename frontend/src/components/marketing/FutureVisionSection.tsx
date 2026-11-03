import Image from "next/image";

// A lightweight CSS/SVG network globe — deliberately simpler than the hero's
// WebGL scene, per the brief's distinction between the two visuals.
const DOTS = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2;
  const radius = 38 + ((i * 13) % 9);
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius * 0.5,
    delay: (i % 6) * 0.4,
  };
});

export function FutureVisionSection() {
  return (
    <section id="our-vision" className="relative overflow-hidden px-6 py-32 text-center">
      {/* "Digital Universe" — a human silhouette inside the agentic internet,
          as the atmospheric backdrop for HAPI's global-network ambition. */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/digital-universe.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080D19] via-[#080D19]/70 to-[#080D19]" />
      </div>

      <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
        The Internet Was Built for People. The Next Internet Must Work for Their AI.
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-slate-400">
        HAPI's ambition is to become a common identity and authorisation layer across AI
        assistants and participating websites — one trusted connection, wherever it's needed.
      </p>

      <div className="relative mx-auto mt-14 aspect-[2/1] w-full max-w-2xl">
        <div className="animate-breathe pointer-events-none absolute inset-0 rounded-full bg-cyan-500/10 blur-3xl" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 50" aria-hidden>
          <ellipse cx={50} cy={25} rx={42} ry={20} fill="none" stroke="rgba(34,211,238,0.25)" strokeWidth={0.3} />
          <ellipse cx={50} cy={25} rx={30} ry={20} fill="none" stroke="rgba(167,139,250,0.2)" strokeWidth={0.3} />
          {DOTS.map((dot, i) => (
            <line
              key={i}
              x1={50}
              y1={25}
              x2={dot.x}
              y2={dot.y * 0.5 + 12.5}
              stroke="rgba(148,163,184,0.15)"
              strokeWidth={0.2}
            />
          ))}
        </svg>
        {DOTS.map((dot, i) => (
          <div
            key={i}
            className="animate-breathe absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300"
            style={{ left: `${dot.x}%`, top: `${dot.y * 0.5 + 12.5}%`, animationDelay: `-${dot.delay}s` }}
          />
        ))}
        <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-cyan-400/40 bg-navy-900/80 text-xs font-semibold text-cyan-300 shadow-lg shadow-cyan-500/20">
          HAPI
        </div>
      </div>
    </section>
  );
}
