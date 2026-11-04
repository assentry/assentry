"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getDevToken } from "../../lib/devApi";
import { Logo } from "../Logo";

const LINKS = [
  { href: "/developers", label: "Overview" },
  { href: "/developers/docs", label: "Docs" },
  { href: "/developers/console", label: "Console" },
];

export function DevHeader() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(Boolean(getDevToken()));
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-navy-950/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-200 sm:inline-block">
            Developers
          </span>
        </div>

        <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
          {LINKS.map((link) => {
            const active = link.href === "/developers" ? pathname === link.href : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-2.5 py-1.5 transition-colors sm:px-3 ${
                  active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {!loggedIn && (
            <Link
              href="/developers/login"
              className="ml-1 hidden rounded-lg border border-white/15 px-3 py-1.5 text-slate-200 hover:bg-white/5 sm:inline-block"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
