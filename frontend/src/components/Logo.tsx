export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">
        H
      </div>
      <span className="text-lg font-semibold tracking-tight text-slate-900">HAPI</span>
    </div>
  );
}
