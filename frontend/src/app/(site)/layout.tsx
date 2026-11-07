import type { ReactNode } from "react";
import { Nav } from "../../components/marketing/Nav";

// The public site's pages (home, How it works, log in, sign up) share one top
// nav. It lives here, in a layout, so it stays in place while moving between
// them instead of being rebuilt on every page.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-950">
      <Nav />
      {children}
    </div>
  );
}
