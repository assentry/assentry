import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Every profile detail has exactly one type, and every type one published
// format. Values are normalised here when entered, so sites always receive
// the same shape. (Details are self-declared: the format is guaranteed, the
// content isn't.)

export const FIELD_TYPES = [
  "text",
  "long_text",
  "email",
  "phone",
  "date",
  "url",
  "integer",
  "decimal",
  "boolean",
  "choice",
  "country",
  "address",
  "file",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FileRules {
  contentTypes: string[];
  maxBytes: number;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  group?: string;
  options?: string[];
  file?: FileRules;
}

const MB = 1024 * 1024;
// Serverless hosts (Vercel) accept request bodies of about 4.5 MB, and files
// are uploaded through Assentry unless S3-compatible storage is configured.
export const MAX_FILE_BYTES = process.env.S3_BUCKET ? 10 * MB : 4 * MB;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
/** For people's own file details and sites' custom ones. */
export const GENERIC_FILE_RULES: FileRules = {
  contentTypes: [...IMAGE_TYPES, ...DOCUMENT_TYPES, "text/plain"],
  maxBytes: MAX_FILE_BYTES,
};

// Standard keys follow OpenID Connect claim names where one exists.
export const STANDARD_FIELDS: FieldDef[] = [
  { key: "name", label: "Full name", type: "text", group: "Basics" },
  { key: "preferred_name", label: "Preferred name", type: "text", group: "Basics" },
  { key: "birthdate", label: "Date of birth", type: "date", group: "Basics" },
  { key: "photo", label: "Photo", type: "file", group: "Basics", file: { contentTypes: IMAGE_TYPES, maxBytes: MAX_FILE_BYTES } },
  { key: "nationality", label: "Nationality", type: "country", group: "Basics" },
  { key: "email", label: "Email", type: "email", group: "Contact" },
  { key: "phone_number", label: "Phone number", type: "phone", group: "Contact" },
  { key: "address", label: "Address", type: "address", group: "Contact" },
  { key: "website", label: "Website", type: "url", group: "Contact" },
  { key: "job_title", label: "Job title", type: "text", group: "Work" },
  { key: "employer", label: "Employer", type: "text", group: "Work" },
  { key: "years_experience", label: "Years of experience", type: "integer", group: "Work" },
  { key: "resume", label: "CV / resume", type: "file", group: "Work", file: { contentTypes: DOCUMENT_TYPES, maxBytes: MAX_FILE_BYTES } },
  { key: "linkedin", label: "LinkedIn profile", type: "url", group: "Work" },
];

const STANDARD_BY_KEY = new Map(STANDARD_FIELDS.map((f) => [f.key, f]));
export function standardField(key: string): FieldDef | undefined {
  return STANDARD_BY_KEY.get(key);
}

/** Key rule for custom details (both people's and sites'). */
export const CUSTOM_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
export const personKey = (slug: string) => `my:${slug}`;
export const siteKey = (partnerId: string, key: string) => `site:${partnerId}:${key}`;

// ISO 3166-1 alpha-2. Names come from Intl.DisplayNames wherever they're shown.
export const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ");
const COUNTRIES = new Set(COUNTRY_CODES);

export interface AddressValue {
  street_address?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  formatted: string;
}

export interface FileValue {
  fileId: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
}

export type NormaliseResult = { ok: true; value: unknown } | { ok: false; error: string };

function str(v: unknown): string | null {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : null;
}

/**
 * Checks and normalises a value for a detail. Returns the stored form.
 * `context.country` helps read national phone numbers (from the address).
 */
export function normaliseValue(def: Pick<FieldDef, "type" | "options">, raw: unknown, context: { country?: string } = {}): NormaliseResult {
  const fail = (error: string): NormaliseResult => ({ ok: false, error });
  switch (def.type) {
    case "text": {
      const s = str(raw);
      if (!s) return fail("enter some text");
      return s.length > 500 ? fail("keep it under 500 characters") : { ok: true, value: s };
    }
    case "long_text": {
      const s = str(raw);
      if (!s) return fail("enter some text");
      return s.length > 20000 ? fail("keep it under 20,000 characters") : { ok: true, value: s };
    }
    case "email": {
      const s = str(raw)?.toLowerCase();
      return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254 ? { ok: true, value: s } : fail("enter a valid email address");
    }
    case "phone": {
      const s = str(raw);
      if (!s) return fail("enter a phone number");
      const phone = parsePhoneNumberFromString(s, (context.country as CountryCode) || undefined);
      return phone?.isValid()
        ? { ok: true, value: phone.number } // E.164, e.g. +447700900123
        : fail("enter a valid phone number, with its country code (e.g. +44…)");
    }
    case "date": {
      const s = str(raw);
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fail("use the format YYYY-MM-DD");
      const d = new Date(`${s}T00:00:00Z`);
      return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? fail("that date doesn't exist") : { ok: true, value: s };
    }
    case "url": {
      const s = str(raw);
      if (!s) return fail("enter a web address");
      try {
        const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
        if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return fail("enter a full web address");
        return { ok: true, value: u.toString() };
      } catch {
        return fail("enter a full web address");
      }
    }
    case "integer": {
      const n = typeof raw === "number" ? raw : Number(str(raw));
      return Number.isInteger(n) && Math.abs(n) <= 1e12 ? { ok: true, value: n } : fail("enter a whole number");
    }
    case "decimal": {
      const n = typeof raw === "number" ? raw : Number(str(raw));
      return Number.isFinite(n) && str(raw) !== "" ? { ok: true, value: n } : fail("enter a number");
    }
    case "boolean": {
      if (typeof raw === "boolean") return { ok: true, value: raw };
      const s = str(raw)?.toLowerCase();
      if (s === "true" || s === "yes") return { ok: true, value: true };
      if (s === "false" || s === "no") return { ok: true, value: false };
      return fail("answer yes or no");
    }
    case "choice": {
      const s = str(raw);
      return s && def.options?.includes(s) ? { ok: true, value: s } : fail(`choose one of: ${(def.options ?? []).join(", ")}`);
    }
    case "country": {
      const s = str(raw)?.toUpperCase();
      return s && COUNTRIES.has(s) ? { ok: true, value: s } : fail("choose a country");
    }
    case "address": {
      if (!raw || typeof raw !== "object") return fail("fill in the address");
      const r = raw as Record<string, unknown>;
      const part = (k: string, max = 200) => {
        const v = str(r[k]);
        return v ? v.slice(0, max) : undefined;
      };
      const country = part("country")?.toUpperCase();
      if (country && !COUNTRIES.has(country)) return fail("choose a country");
      const value: AddressValue = {
        street_address: part("street_address", 500),
        locality: part("locality"),
        region: part("region"),
        postal_code: part("postal_code", 20),
        country,
        formatted: "",
      };
      const lines = [value.street_address, value.locality, value.region, value.postal_code, value.country].filter(Boolean);
      // Keep an old free-text address (carried over from before) if no parts are set.
      value.formatted = lines.length ? lines.join(", ") : (part("formatted", 1000) ?? "");
      if (!value.formatted) return fail("fill in the address");
      for (const k of Object.keys(value) as (keyof AddressValue)[]) if (value[k] === undefined) delete value[k];
      return { ok: true, value };
    }
    case "file":
      return fail("upload a file instead");
  }
}

/** A plain-language description of a type's format, for the console and docs. */
export const TYPE_FORMATS: Record<FieldType, string> = {
  text: "text, up to 500 characters",
  long_text: "text, up to 20,000 characters",
  email: "email address, lowercase",
  phone: "international format (E.164), e.g. +447700900123",
  date: "date, YYYY-MM-DD",
  url: "full https:// web address",
  integer: "whole number",
  decimal: "number",
  boolean: "true or false",
  choice: "one of the listed options",
  country: "country code (ISO 3166-1), e.g. GB",
  address: "object: street_address, locality, region, postal_code, country, formatted",
  file: "file, with a single-use download link",
};
