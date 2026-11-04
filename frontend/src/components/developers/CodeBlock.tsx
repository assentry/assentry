"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-white/10 bg-navy-900">
      {label && (
        <div className="border-b border-white/5 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </div>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-navy-950/80 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-neutral-300" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto px-4 py-4 pr-20 text-[13px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}
