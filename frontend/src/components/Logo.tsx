import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Assentry home"
      className={`text-2xl font-bold tracking-tight text-white transition-opacity hover:opacity-80 ${className}`}
    >
      Assentry
    </Link>
  );
}
