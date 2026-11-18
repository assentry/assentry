"use client";

import { Bot, Download, FileUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, API_BASE_URL, getToken } from "../lib/api";
import {
  countryList,
  FIELD_TYPES,
  TYPE_LABELS,
  type AddressValue,
  type FieldDescription,
  type FieldType,
  type FileValue,
} from "../lib/profileFields";
import { Badge, Button, Card, Input, Label, Select } from "./ui";

interface Entry {
  value: unknown;
  source: "person" | "agent";
  status: "confirmed" | "suggested";
  updatedAt: string;
}

interface Site {
  id: string;
  name: string;
  domain: string | null;
}

interface RequestNotice {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  site: Site;
  action: "fill" | "share";
}

interface ProfileData {
  standard: FieldDescription[];
  custom: FieldDescription[];
  siteDetails: (FieldDescription & { site: Site; required: boolean })[];
  requests: RequestNotice[];
  values: Record<string, Entry>;
  settings: { agentAutoFill: boolean };
  emailVerification: { email: string; verified: boolean } | null;
}

const enc = encodeURIComponent;

export function ProfilePanel({ accountEmail, onNoticesChanged }: { accountEmail: string; onNoticesChanged?: () => void }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.get<ProfileData>("/me/profile"));
      onNoticesChanged?.();
    } catch {
      setError("Couldn't load your profile.");
    }
  }, [onNoticesChanged]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!data) return <div className="h-64 animate-pulse rounded-2xl bg-white/5" />;

  const groups = Array.from(new Set(data.standard.map((f) => f.group ?? "Other")));
  const suggestions = Object.entries(data.values).filter(([, e]) => e.status === "suggested");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Your profile</h1>
        <p className="mt-1 text-sm text-slate-400">
          Fill in only what you want. Websites never see any of this unless you allow it, and then only the details they
          asked for.
        </p>
      </div>

      {(data.requests.length > 0 || suggestions.length > 0) && (
        <Card className="border-white/30">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-300">Needs your attention</h2>
          <p className="mb-4 text-sm text-slate-400">
            Sites your agent signed in to asked for these, and your agent may have suggested some answers.
          </p>
          <ul className="space-y-3">
            {suggestions.map(([key]) => (
              <li key={key} className="text-sm text-slate-200">
                <Bot className="mr-1.5 inline h-4 w-4" />
                Your agent suggested a value for <b>{labelFor(data, key)}</b>. Check it below and confirm.
              </li>
            ))}
            {data.requests.map((r) => (
              <RequestRow key={r.id} request={r} onChanged={load} />
            ))}
          </ul>
        </Card>
      )}

      {groups.map((group) => (
        <Card key={group}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">{group}</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {data.standard
              .filter((f) => (f.group ?? "Other") === group)
              .map((f) =>
                f.key === "email" ? (
                  <div key={f.key} className="space-y-2">
                    <FieldEditor
                      field={f}
                      entry={data.values[f.key]}
                      initial={!data.values.email ? accountEmail : undefined}
                      onChanged={load}
                    />
                    {data.emailVerification && <EmailVerifier status={data.emailVerification} onChanged={load} />}
                  </div>
                ) : (
                  <FieldEditor key={f.key} field={f} entry={data.values[f.key]} onChanged={load} />
                )
              )}
          </div>
        </Card>
      ))}

      {data.siteDetails.length > 0 && (
        <Card>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-300">Requested by sites</h2>
          <p className="mb-4 text-sm text-slate-400">Details a site asked for. Each is only ever shared with the site that asked.</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {data.siteDetails.map((f) => (
              <FieldEditor
                key={f.key}
                field={{ ...f, label: `${f.label} · ${f.site.name}${f.required ? " (required)" : ""}` }}
                entry={data.values[f.key]}
                onChanged={load}
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-300">Your own details</h2>
        <p className="mb-4 text-sm text-slate-400">Anything else about you. These are for you; sites don&apos;t receive them.</p>
        {data.custom.length > 0 && (
          <div className="mb-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {data.custom.map((f) => (
              <FieldEditor
                key={f.key}
                field={f}
                entry={data.values[f.key]}
                onChanged={load}
                onRemoveField={async () => {
                  await api.del(`/me/fields/${enc(f.key)}`);
                  await load();
                }}
              />
            ))}
          </div>
        )}
        <AddDetail onAdded={load} />
      </Card>

      <Card>
        <label className="flex items-start gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-white"
            checked={data.settings.agentAutoFill}
            onChange={async (e) => {
              await api.put("/me/settings", { agentAutoFill: e.target.checked });
              await load();
            }}
          />
          <span>
            <b className="text-white">Let my agent fill in missing details without asking</b>
            <span className="block text-slate-400">
              When a site asks for something you haven&apos;t filled in, your agent can supply it if it knows. Off: its
              answers wait here for you to confirm.
            </span>
          </span>
        </label>
      </Card>
    </div>
  );
}

function labelFor(data: ProfileData, key: string): string {
  return (
    [...data.standard, ...data.custom, ...data.siteDetails].find((f) => f.key === key)?.label ?? key
  );
}

function RequestRow({ request, onChanged }: { request: RequestNotice; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function act(path: string) {
    setBusy(true);
    try {
      await api.post(path);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
      <span className="text-slate-200">
        <b className="text-white">{request.site.name}</b> asks for your <b className="text-white">{request.label}</b>
        {request.required && (
          <span className="ml-2 align-middle">
            <Badge tone="warning">required</Badge>
          </span>
        )}
        <span className="block text-xs text-slate-400">
          {request.action === "share"
            ? "You've filled this in, but your permission doesn't include it. Share it with this site?"
            : "Fill it in below; doing so shares it with this site."}
        </span>
      </span>
      <span className="flex gap-2">
        {request.action === "share" && (
          <Button onClick={() => act(`/me/requests/${request.id}/share`)} disabled={busy}>
            Share with {request.site.name}
          </Button>
        )}
        <Button variant="ghost" onClick={() => act(`/me/requests/${request.id}/dismiss`)} disabled={busy}>
          Dismiss
        </Button>
      </span>
    </li>
  );
}

// ---- One detail ----

const VERIFY_ERRORS: Record<string, string> = {
  wrong_code: "That code isn't right. Check the email and try again.",
  code_expired: "That code has expired. Send a new one.",
  too_many_attempts: "Too many wrong tries. Send a new code.",
  too_many_requests: "Too many codes sent. Try again in an hour.",
  email_changed: "Your email changed since that code was sent. Send a new one.",
  no_pending_code: "Send a code first.",
};

/** Proving the email shared with sites is the person's own: sites never receive it until then. */
function EmailVerifier({ status, onChanged }: { status: { email: string; verified: boolean }; onChanged: () => Promise<void> }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setSent(false);
    setCode("");
    setMessage(null);
  }, [status.email]);

  if (status.verified) return <Badge tone="success">Verified</Badge>;

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (done) setMessage({ ok: true, text: done });
    } catch (err) {
      const key = err instanceof Error ? err.message : "";
      setMessage({ ok: false, text: VERIFY_ERRORS[key] ?? "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-white/5 p-3 text-sm">
      <p className="text-slate-300">
        <Badge tone="warning">Not verified</Badge>{" "}
        <span className="text-slate-400">Sites won&apos;t receive this email until you confirm it&apos;s yours.</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api.post("/me/email-verification/start");
              setSent(true);
            }, `We sent a 6-digit code to ${status.email}.`)
          }
        >
          {sent ? "Send a new code" : "Send code"}
        </Button>
        {sent && (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await api.post("/me/email-verification/confirm", { code });
                await onChanged();
              });
            }}
          >
            <Input
              aria-label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-28"
            />
            <Button type="submit" disabled={busy || code.length !== 6}>
              Verify
            </Button>
          </form>
        )}
      </div>
      {message && <p className={`mt-2 ${message.ok ? "text-slate-300" : "text-rose-300"}`}>{message.text}</p>}
    </div>
  );
}

function FieldEditor({
  field,
  entry,
  initial,
  onChanged,
  onRemoveField,
}: {
  field: FieldDescription;
  entry?: Entry;
  initial?: unknown;
  onChanged: () => Promise<void>;
  onRemoveField?: () => Promise<void>;
}) {
  const saved = entry?.value;
  const [draft, setDraft] = useState<unknown>(saved ?? initial ?? emptyFor(field.type));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setDraft(entry?.value ?? initial ?? emptyFor(field.type));
  }, [entry?.value, entry?.updatedAt, initial, field.type]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? emptyFor(field.type));
  const suggested = entry?.status === "suggested";
  const id = `field-${field.key.replace(/[^a-z0-9]/gi, "-")}`;
  const wide = field.type === "address" || field.type === "long_text" || field.type === "file";

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      setStatus({ ok: true, text: done });
      await onChanged();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(() => api.put(`/me/profile/values/${enc(field.key)}`, { value: draft }), "Saved.");
  const clear = () => run(() => api.del(`/me/profile/values/${enc(field.key)}`), "Removed.");
  const confirm = () =>
    run(async () => {
      if (dirty) await api.put(`/me/profile/values/${enc(field.key)}`, { value: draft });
      else await api.post(`/me/profile/values/${enc(field.key)}/confirm`);
    }, "Confirmed.");

  return (
    <div className={`${wide ? "sm:col-span-2" : ""} ${suggested ? "rounded-lg ring-1 ring-white/30 p-3" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{field.label}</Label>
        <span className="flex items-center gap-2">
          {entry?.source === "agent" && !suggested && <span className="text-xs text-slate-500">from your agent</span>}
          {onRemoveField && (
            <button
              type="button"
              aria-label={`Remove ${field.label}`}
              onClick={() => run(onRemoveField, "Removed.")}
              className="text-slate-500 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </div>
      {suggested && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-neutral-200">
          <Bot className="h-3.5 w-3.5" /> Suggested by your agent. Not shared until you confirm.
        </p>
      )}

      {field.type === "file" ? (
        <FileInput field={field} value={saved as FileValue | undefined} busy={busy} run={run} />
      ) : (
        <ValueInput id={id} field={field} value={draft} onChange={setDraft} />
      )}

      {field.type !== "file" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {suggested ? (
            <>
              <Button onClick={confirm} disabled={busy}>
                Confirm
              </Button>
              <Button variant="ghost" onClick={clear} disabled={busy}>
                Discard
              </Button>
            </>
          ) : (
            <>
              {(dirty || (initial !== undefined && saved === undefined)) && (
                <Button variant="secondary" onClick={save} disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </Button>
              )}
              {saved !== undefined && !dirty && (
                <button type="button" onClick={clear} disabled={busy} className="text-xs text-slate-500 hover:text-rose-300">
                  Remove
                </button>
              )}
            </>
          )}
          {status && <span className={`text-xs ${status.ok ? "text-slate-300" : "text-rose-300"}`}>{status.text}</span>}
        </div>
      )}
      {field.type === "file" && status && (
        <p className={`mt-1 text-xs ${status.ok ? "text-slate-300" : "text-rose-300"}`}>{status.text}</p>
      )}
    </div>
  );
}

function emptyFor(type: FieldType): unknown {
  if (type === "address") return {};
  if (type === "boolean") return undefined;
  return undefined;
}

const inputClass =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400";

function ValueInput({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: FieldDescription;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const countries = useMemo(() => (field.type === "country" || field.type === "address" ? countryList() : []), [field.type]);
  const text = value === undefined || value === null ? "" : String(value);

  switch (field.type) {
    case "long_text":
      return <textarea id={id} rows={4} className={inputClass} value={text} onChange={(e) => onChange(e.target.value)} />;
    case "boolean":
      return (
        <Select id={id} value={value === true ? "yes" : value === false ? "no" : ""} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "yes")}>
          <option value="">Not set</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </Select>
      );
    case "choice":
      return (
        <Select id={id} value={text} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Choose…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    case "country":
      return (
        <Select id={id} value={text} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Choose a country…</option>
          {countries.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </Select>
      );
    case "address": {
      const a = (value ?? {}) as AddressValue;
      const set = (k: keyof AddressValue, v: string) => onChange({ ...a, [k]: v || undefined, formatted: undefined });
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {a.formatted && !a.street_address && !a.locality && (
            <p className="text-xs text-slate-400 sm:col-span-2">
              Previously saved as: <span className="text-slate-300">{a.formatted}</span>. Fill in the parts below to update it.
            </p>
          )}
          <Input id={id} className="sm:col-span-2" placeholder="Street and number" value={a.street_address ?? ""} onChange={(e) => set("street_address", e.target.value)} />
          <Input placeholder="Town or city" value={a.locality ?? ""} onChange={(e) => set("locality", e.target.value)} />
          <Input placeholder="County, state or region" value={a.region ?? ""} onChange={(e) => set("region", e.target.value)} />
          <Input placeholder="Postcode" value={a.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} />
          <Select value={a.country ?? ""} onChange={(e) => set("country", e.target.value)}>
            <option value="">Country…</option>
            {countries.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </Select>
        </div>
      );
    }
    default: {
      const inputType: Record<string, string> = {
        email: "email",
        phone: "tel",
        date: "date",
        url: "url",
        integer: "number",
        decimal: "number",
      };
      const placeholder: Record<string, string> = {
        phone: "+44 7700 900123",
        url: "https://",
        email: "you@example.com",
      };
      return (
        <Input
          id={id}
          type={inputType[field.type] ?? "text"}
          step={field.type === "decimal" ? "any" : field.type === "integer" ? "1" : undefined}
          placeholder={placeholder[field.type]}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (field.type === "integer" || field.type === "decimal") onChange(v === "" ? undefined : Number(v));
            else onChange(v === "" ? undefined : v);
          }}
        />
      );
    }
  }
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileInput({
  field,
  value,
  busy,
  run,
}: {
  field: FieldDescription;
  value?: FileValue;
  busy: boolean;
  run: (fn: () => Promise<unknown>, done: string) => Promise<void>;
}) {
  const accept = field.file?.contentTypes.join(",");

  async function upload(file: File) {
    await run(async () => {
      const start = await api.post<{ fileId: string; upload: { url: string; method: string; headers: Record<string, string> } }>(
        "/me/files",
        { fieldKey: field.key, filename: file.name, contentType: file.type, size: file.size }
      );
      const put = await fetch(start.upload.url, { method: start.upload.method, headers: start.upload.headers, body: file });
      if (!put.ok) throw new Error("Upload failed. Try again.");
      await api.post(`/me/files/${start.fileId}/complete`);
    }, "Uploaded.");
  }

  async function download() {
    if (!value) return;
    const res = await fetch(`${API_BASE_URL}/me/files/${value.fileId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = value.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {value ? (
        <>
          <span className="text-sm text-slate-200">
            {value.filename} <span className="text-slate-500">· {formatSize(value.size)}</span>
          </span>
          <Button variant="ghost" onClick={download} type="button">
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => run(() => api.del(`/me/profile/values/${enc(field.key)}`), "Removed.")}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        </>
      ) : (
        <span className="text-sm text-slate-500">No file yet</span>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">
        <FileUp className="h-4 w-4" /> {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        <input
          type="file"
          className="hidden"
          accept={accept}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload(f);
          }}
        />
      </label>
      <span className="w-full text-xs text-slate-500">
        {(field.file?.contentTypes ?? []).map(shortType).join(", ")} · up to {formatSize(field.file?.maxBytes ?? 10 * 1024 * 1024)}
      </span>
    </div>
  );
}

function shortType(t: string): string {
  return (
    {
      "image/jpeg": "JPEG",
      "image/png": "PNG",
      "image/webp": "WebP",
      "application/pdf": "PDF",
      "application/msword": "Word",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
      "text/plain": "text",
    }[t] ?? t
  );
}

function AddDetail({ onAdded }: { onAdded: () => Promise<void> }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/me/fields", {
        label,
        type,
        options: type === "choice" ? options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
      });
      setLabel("");
      setOptions("");
      setType("text");
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="new-detail-label">Add a detail</Label>
        <Input id="new-detail-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Driving licence category" required />
      </div>
      <div>
        <Label htmlFor="new-detail-type">Type</Label>
        <Select id="new-detail-type" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      {type === "choice" && (
        <div className="flex-1">
          <Label htmlFor="new-detail-options">Options (comma-separated)</Label>
          <Input id="new-detail-options" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="A, B, C1" required />
        </div>
      )}
      <Button type="submit" disabled={busy}>
        <Plus className="h-4 w-4" /> Add
      </Button>
      {error && <p className="text-sm text-rose-300">{error}</p>}
    </form>
  );
}
