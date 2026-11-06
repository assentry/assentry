// Shared shell for every server-rendered, human-facing page in the OAuth
// and account-linking flows — these have to survive a plain browser
// redirect/form-post, so they're not part of the React app.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function page(title: string, body: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 420px; margin: 80px auto; padding: 0 16px; color: #1a1a1a; }
  .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
  .brand .mark { width: 28px; height: 28px; border-radius: 6px; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
  .brand .name { font-size: 1.1rem; font-weight: 600; }
  .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  label { display: block; font-size: 0.8rem; color: #64748b; margin-top: 12px; }
  input, select { width: 100%; padding: 8px; margin-top: 4px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 0.9rem; }
  button { margin-top: 16px; padding: 9px 16px; border-radius: 6px; border: none; font-size: 0.9rem; font-weight: 500; cursor: pointer; }
  .approve { background: #4f46e5; color: #fff; }
  .deny { background: #fff; color: #475569; border: 1px solid #cbd5e1; margin-left: 8px; }
  .error { color: #dc2626; font-size: 0.85rem; margin-top: 8px; }
  p.hint { color: #64748b; font-size: 0.85rem; }
  label.choice { display: flex; gap: 8px; align-items: flex-start; color: #0f172a; font-size: 0.85rem; margin-top: 8px; }
  label.choice input { width: auto; margin-top: 3px; }
  .muted { color: #64748b; }
</style></head>
<body>
  <div class="brand"><div class="mark">H</div><div class="name">Assentry</div></div>
  <div class="card">${body}</div>
</body></html>`;
}
