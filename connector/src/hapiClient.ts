export interface AgentGrant {
  id: string;
  scope: string;
  consentedFields: string[];
  expiresAt: string;
  createdAt: string;
}

export interface CredentialResponse {
  credential: string;
  scope: string;
  expiresAt: string;
}

export class HapiAgentClient {
  constructor(
    private readonly agentKey: string,
    private readonly baseUrl: string
  ) {}

  async listGrants(): Promise<AgentGrant[]> {
    const res = await this.request("/agent/grants", { method: "GET" });
    const data = (await res.json()) as { grants: AgentGrant[] };
    return data.grants;
  }

  async getCredential(grantId: string): Promise<CredentialResponse> {
    const res = await this.request(`/agent/grants/${grantId}/credential`, { method: "POST" });
    return (await res.json()) as CredentialResponse;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "x-hapi-agent-key": this.agentKey },
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      throw new Error(typeof data.error === "string" ? data.error : `HAPI request failed (${res.status})`);
    }
    return res;
  }
}
