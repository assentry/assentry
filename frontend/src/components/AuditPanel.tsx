import type { AuditLog } from "../lib/types";
import { Badge, Card, EmptyState } from "./ui";

export function AuditPanel({ logs }: { logs: AuditLog[] }) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-white">Activity</h2>
      {logs.length === 0 ? (
        <EmptyState>No activity recorded yet.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="pb-2 font-medium">When</th>
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Result</th>
                <th className="pb-2 font-medium">Reason</th>
                <th className="pb-2 font-medium">Partner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 pr-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4 font-medium text-slate-100">{log.action}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={log.result === "allowed" ? "success" : "danger"}>{log.result}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-slate-500">{log.reason ?? "—"}</td>
                  <td className="py-2 text-slate-500">{log.partner?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
