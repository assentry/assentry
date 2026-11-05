"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PROFILE_CATEGORIES, type ProfileField } from "../lib/profileFields";
import { Button, Card, Input, Label } from "./ui";

type Profile = Record<string, string>;

export function ProfilePanel({ accountEmail }: { accountEmail: string }) {
  const [profile, setProfile] = useState<Profile>({});
  const [saved, setSaved] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api
      .get<{ profile: Profile }>("/me/profile")
      .then(({ profile }) => {
        setSaved(profile);
        // Start the email box with the sign-up email; it's only stored once saved.
        setProfile(profile.email ? profile : { ...profile, email: accountEmail });
      })
      .catch(() => setStatus({ ok: false, text: "Couldn't load your profile." }))
      .finally(() => setLoading(false));
  }, [accountEmail]);

  const dirty = JSON.stringify(clean(profile)) !== JSON.stringify(clean(saved));

  function update(key: string, value: string) {
    setProfile((p) => ({ ...p, [key]: value }));
    setStatus(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const data = await api.put<{ profile: Profile }>("/me/profile", { profile: clean(profile) });
      setSaved(data.profile);
      setProfile(data.profile);
      setStatus({ ok: true, text: "Saved." });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Couldn't save." });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-white/5" />;

  return (
    <form onSubmit={save} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Your profile</h1>
        <p className="mt-1 text-sm text-slate-400">
          Fill in only what you want. Websites never see any of this unless you allow it when authorising an agent,
          and then only the details you pick.
        </p>
      </div>

      {PROFILE_CATEGORIES.map((category) => (
        <Card key={category.title}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">{category.title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {category.fields.map((field) => (
              <FieldInput key={field.key} field={field} value={profile[field.key] ?? ""} onChange={update} />
            ))}
          </div>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
        {status && <p className={`text-sm ${status.ok ? "text-slate-300" : "text-rose-300"}`}>{status.text}</p>}
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ProfileField;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const id = `profile-${field.key}`;
  const wide = field.type === "textarea";
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <Label htmlFor={id}>{field.label}</Label>
      {wide ? (
        <textarea
          id={id}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      ) : (
        <Input
          id={id}
          type={field.type ?? "text"}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
        />
      )}
    </div>
  );
}

function clean(profile: Profile): Profile {
  const out: Profile = {};
  for (const [k, v] of Object.entries(profile)) if (v.trim()) out[k] = v.trim();
  return out;
}
