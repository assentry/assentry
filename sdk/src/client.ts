import type { ProfileResult, VerifyResult } from "./types";

export class HAPIRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface HAPIOptions {
  apiKey: string;
  /** HAPI API origin. Defaults to the local dev server. */
  baseUrl?: string;
}

/**
 * Server-side client for the HAPI partner handshake. Never put the API key
 * in frontend code — this talks to HAPI from your backend, the same way
 * you'd use a Stripe secret key.
 */
export class HAPI {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(options: HAPIOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "http://localhost:4000").replace(/\/$/, "");
  }

  /**
   * Verifies a credential an agent presented, for a specific action/scope.
   * Always re-checks HAPI's authorisation service — never trust the agent's
   * claim alone.
   */
  async verify(credential: string, action: string): Promise<VerifyResult> {
    return this.request<VerifyResult>("/verify", { credential, action });
  }

  /**
   * Pulls only the profile fields the user actually consented to disclose
   * for this grant. Requesting a field the user didn't consent to simply
   * omits it from the response rather than erroring.
   */
  async getProfile(credential: string, fields: string[]): Promise<ProfileResult> {
    return this.request<ProfileResult>("/profile", { credential, fields });
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hapi-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      throw new HAPIRequestError("invalid HAPI api key", 401);
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      throw new HAPIRequestError(
        typeof data?.error === "string" ? data.error : `HAPI request failed (${res.status})`,
        res.status
      );
    }

    return (await res.json()) as T;
  }
}
