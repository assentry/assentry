import { Router } from "express";
import { issueCredentialForAgentGrant, listGrantsForAgent } from "../lib/agentActions";
import { AgentApiRequest, requireAgentKey } from "../lib/agentAuth";

// Endpoints the connector (running inside the user's own AI) calls on its
// own behalf, authenticated by its agent key — not the user's login session,
// and not a partner's API key. This is Option A from the design discussion:
// the connector can only use permissions the user already granted through
// the personal app; it cannot create new ones.
//
// Used by the local stdio connector (connector/). The hosted OAuth-connected
// remote MCP server (/mcp) exposes the same two capabilities in-process via
// lib/agentActions instead of calling these routes over HTTP.
export const agentApiRouter = Router();
agentApiRouter.use(requireAgentKey);

agentApiRouter.get("/grants", async (req: AgentApiRequest, res) => {
  const grants = await listGrantsForAgent(req.agent!.id);
  res.json({ grants });
});

agentApiRouter.post("/grants/:id/credential", async (req: AgentApiRequest, res) => {
  const outcome = await issueCredentialForAgentGrant(req.agent!.id, req.params.id);
  if (!outcome.ok) {
    const status = outcome.error === "grant_not_found" ? 404 : 403;
    return res.status(status).json({ error: outcome.error.replace(/_/g, " ") });
  }
  res.json({ credential: outcome.credential, scope: outcome.scope, expiresAt: outcome.expiresAt });
});
