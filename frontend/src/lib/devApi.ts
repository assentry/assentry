import { API_BASE_URL, ApiError } from "./api";

// Developer console session — stored under its own key, separate from the
// end-user `assentry_token`, so a person can be logged into both the personal
// app and the developer console in one browser without either clobbering
// the other. The backend rejects each token type on the other's routes.
const DEV_TOKEN_KEY = "assentry_dev_token";

export function getDevToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEV_TOKEN_KEY);
}

export function setDevToken(token: string) {
  window.localStorage.setItem(DEV_TOKEN_KEY, token);
}

export function clearDevToken() {
  window.localStorage.removeItem(DEV_TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getDevToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.error === "string" ? data.error : data?.error ? JSON.stringify(data.error) : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const devApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
};

export interface Developer {
  id: string;
  email: string;
  name: string | null;
}

export interface DeveloperApp {
  id: string;
  name: string;
  publicId: string;
  apiKeyPreview: string | null;
  linkRedirectUris: string[];
  domain: string | null;
  domainVerificationToken: string | null;
  domainVerifiedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}
