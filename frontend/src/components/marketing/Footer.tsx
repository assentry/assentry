import Link from "next/link";
import { Logo } from "../Logo";

export function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Logo />
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
          <a href="#platform" className="hover:text-white">
            Platform
          </a>
          <a href="#how-it-works" className="hover:text-white">
            How It Works
          </a>
          <a href="#for-people" className="hover:text-white">
            For People
          </a>
          <a href="/developers" className="hover:text-white">
            For Developers
          </a>
          <a href="#our-vision" className="hover:text-white">
            Our Vision
          </a>
          <Link href="/developers/docs" className="hover:text-white">
            Developer docs
          </Link>
        </nav>
        <Link href="/signup" className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
          Get Early Access →
        </Link>
      </div>
      <p className="mt-8 text-center text-xs text-slate-600">© {new Date().getFullYear()} HAPI. All rights reserved.</p>
    </footer>
  );
}
