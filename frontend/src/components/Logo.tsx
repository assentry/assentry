export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 text-sm font-bold text-navy-950 shadow-sm shadow-cyan-500/30">
        H
      </div>
      <span className="text-lg font-semibold tracking-tight text-white">HAPI</span>
    </div>
  );
}
