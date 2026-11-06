"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "./api";

// Profile details and their types. The catalogue lives in the Assentry
// backend (GET /fields) so the apps, docs and API never disagree.

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

export const TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  long_text: "Long text",
  email: "Email",
  phone: "Phone number",
  date: "Date",
  url: "Web address",
  integer: "Whole number",
  decimal: "Number",
  boolean: "Yes / no",
  choice: "Choice from a list",
  country: "Country",
  address: "Address",
  file: "File",
};

export interface FieldDescription {
  key: string;
  label: string;
  type: FieldType;
  group?: string;
  options?: string[];
  format: string;
  file?: { contentTypes: string[]; maxBytes: number };
}

export interface AddressValue {
  street_address?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  formatted?: string;
}

export interface FileValue {
  fileId: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
}

let cached: Promise<FieldDescription[]> | null = null;

export function loadStandardFields(): Promise<FieldDescription[]> {
  if (!cached) {
    cached = fetch(`${API_BASE_URL}/fields`)
      .then((r) => r.json())
      .then((d: { fields: FieldDescription[] }) => d.fields);
    cached.catch(() => (cached = null));
  }
  return cached;
}

export function useStandardFields(): FieldDescription[] | null {
  const [fields, setFields] = useState<FieldDescription[] | null>(null);
  useEffect(() => {
    loadStandardFields().then(setFields, () => setFields([]));
  }, []);
  return fields;
}

const COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT " +
  "MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG " +
  "UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ");

/** Countries as [code, name], sorted by name in the visitor's language. */
export function countryList(): [string, string][] {
  const names = new Intl.DisplayNames(undefined, { type: "region" });
  return COUNTRY_CODES.map((c) => [c, names.of(c) ?? c] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
}
