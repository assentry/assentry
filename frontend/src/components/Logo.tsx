export function Logo({
  className = "",
  variant = "light",
}: {
  className?: string;
  variant?: "light" | "dark";
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-sm shadow-indigo-900/20">
        H
      </div>
      <span
        className={`text-lg font-semibold tracking-tight ${
          variant === "dark" ? "text-white" : "text-slate-900"
        }`}
      >
        HAPI
      </span>
    </div>
  );
}
