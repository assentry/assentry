import { HeroGraphic } from "../components/HeroGraphic";

export function LandingPage({ onGetStarted, onLogIn }: { onGetStarted: () => void; onLogIn: () => void }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden text-white"
      style={{ background: "linear-gradient(180deg, #3b4766 0%, #4f5d80 55%, #5a6890 100%)" }}
    >
      {/* Ambient dot-grid texture, slowly drifting — reads as a live, active
          surface rather than a static background. */}
      <div
        className="animate-drift pointer-events-none absolute -inset-20 opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Two slow, breathing ambient glows */}
      <div
        className="animate-breathe pointer-events-none absolute -left-20 top-20 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl"
        style={{ animationDelay: "-2s" }}
      />
      <div
        className="animate-breathe pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl"
        style={{ animationDelay: "-4s" }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold">
              H
            </div>
            <span className="text-lg font-semibold tracking-tight">HAPI</span>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-white/80 md:flex">
            <a href="#how-it-works" className="hover:text-white">
              How it works
            </a>
            <a href="#for-developers" className="hover:text-white">
              For developers
            </a>
            <a href="https://github.com/bioku-QR/hapi" className="hover:text-white">
              Docs
            </a>
          </nav>

          <button
            onClick={onLogIn}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900 transition-transform hover:scale-105"
          >
            Log in
          </button>
        </header>

        <main className="mt-20 flex flex-col items-center text-center">
          <p className="mb-5 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-medium tracking-wide text-white/80 backdrop-blur-sm">
            Built on OAuth 2.1 — not a proprietary protocol
          </p>

          <h1 className="max-w-3xl text-5xl leading-[1.1] tracking-tight sm:text-6xl">
            <span className="font-bold">The identity layer</span>
            <br />
            <span className="font-light text-white/90">for your AI agents</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg text-white/70">
            Connect your AI once. Authorise exactly what it can do, for exactly how long. See every
            time it acts on your behalf — and pull it back anytime.
          </p>

          <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
            <button
              onClick={onGetStarted}
              className="rounded-full bg-gradient-to-br from-amber-100 to-orange-200 px-8 py-3.5 text-sm font-semibold text-slate-900 shadow-lg shadow-orange-900/20 transition-transform hover:scale-105"
            >
              Get started
            </button>
            <button onClick={onLogIn} className="text-sm font-medium text-white/80 hover:text-white">
              Already have an account? Log in →
            </button>
          </div>

          <div className="mt-8 w-full">
            <HeroGraphic />
          </div>
        </main>
      </div>
    </div>
  );
}
