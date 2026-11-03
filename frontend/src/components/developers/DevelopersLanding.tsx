import { BookOpen, KeyRound, Radar, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CodeBlock } from "./CodeBlock";
import { DevHeader } from "./DevHeader";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Verify who an agent acts for",
    body: "One call tells you whether a credential is valid right now, and which consenting person the agent represents.",
  },
  {
    icon: KeyRound,
    title: "Only the data people agreed to share",
    body: "Pull profile fields per request. Anything the person didn't consent to is simply left out.",
  },
  {
    icon: Radar,
    title: "Discoverable from any page",
    body: "Agents find your HAPI-enabled routes automatically — no human login wall to get stuck behind.",
  },
];

export function DevelopersLanding() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      <div className="grid-texture animate-drift pointer-events-none absolute -inset-20 opacity-40" />
      <div className="animate-breathe pointer-events-none absolute left-1/2 top-24 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      <DevHeader />

      <main className="relative mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <p className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-cyan-200">
          For developers
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Let AI agents into your website — with the person&apos;s permission.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
          HAPI is identity and authorisation infrastructure connecting people, their AI agents and your
          website. Install the SDK, protect a route, and your site can verify who an agent represents and
          what it&apos;s been authorised to share — without ever handling a user&apos;s password.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/developers/signup"
            className="rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 px-7 py-3 text-center text-sm font-semibold text-navy-950 shadow-lg shadow-cyan-500/20 transition-transform hover:scale-105"
          >
            Create a developer account
          </Link>
          <Link
            href="/developers/docs"
            className="rounded-full border border-white/15 px-7 py-3 text-center text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
          >
            Read the docs
          </Link>
          <Link href="/developers/login" className="px-2 py-3 text-center text-sm font-medium text-slate-400 hover:text-white">
            Already have one? Log in →
          </Link>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-2xl p-6">
              <Icon className="h-5 w-5 text-cyan-300" />
              <h2 className="mt-3 text-sm font-semibold text-white">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-xl font-semibold text-white">Up and running in minutes</h2>
            <ol className="mt-4 space-y-3 text-sm text-slate-300">
              <li>
                <span className="mr-2 font-mono text-cyan-300">1</span>Create a developer account and an app in
                the console.
              </li>
              <li>
                <span className="mr-2 font-mono text-cyan-300">2</span>Copy your API key — store it as a server
                secret.
              </li>
              <li>
                <span className="mr-2 font-mono text-cyan-300">3</span>Install the SDK and protect a route.
              </li>
            </ol>
            <Link
              href="/developers/docs#quickstart"
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200"
            >
              <BookOpen className="h-4 w-4" /> Full quickstart
            </Link>
          </div>
          <div>
            <CodeBlock code="npm install @hapi-id/sdk" label="Terminal" />
            <CodeBlock
              label="server.ts"
              code={`app.use(hapiDiscovery({ partnerName: "Your Site" }));

app.get("/account", requireGrant(hapi), (req: HAPIRequest, res) => {
  res.json({ actingFor: req.hapiGrant!.userId });
});`}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
