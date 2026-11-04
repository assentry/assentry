"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "../Logo";

const LINKS = [
  { href: "#platform", label: "Platform" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "/signup", label: "For People" },
  { href: "/developers", label: "For Developers" },
  { href: "/developers/docs", label: "Docs" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-navy-950/70 backdrop-blur-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Logo />

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 lg:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 px-5 py-2 text-sm font-semibold text-navy-950 shadow-lg shadow-cyan-500/20 transition-transform hover:scale-105"
          >
            Get Early Access
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1.5 text-slate-300 hover:bg-white/5 lg:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="space-y-1 border-t border-white/5 px-6 py-4 lg:hidden">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 flex items-center gap-3 px-2">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 px-4 py-1.5 text-sm font-semibold text-navy-950"
            >
              Get Early Access
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
