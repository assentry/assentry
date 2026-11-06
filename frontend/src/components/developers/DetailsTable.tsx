"use client";

import { TYPE_LABELS, useStandardFields } from "../../lib/profileFields";

/** The standard details and their formats, straight from Assentry's catalogue. */
export function DetailsTable() {
  const fields = useStandardFields();
  if (!fields) return <div className="mt-4 h-40 animate-pulse rounded-xl bg-white/5" />;
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-xs text-slate-400">
          <tr>
            <th className="px-3 py-2 font-medium">Key</th>
            <th className="px-3 py-2 font-medium">Detail</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Format you receive</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {fields.map((f) => (
            <tr key={f.key}>
              <td className="px-3 py-2 font-mono text-xs text-slate-200">{f.key}</td>
              <td className="px-3 py-2 text-slate-300">{f.label}</td>
              <td className="px-3 py-2 text-slate-400">{TYPE_LABELS[f.type]}</td>
              <td className="px-3 py-2 text-slate-400">{f.format}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
