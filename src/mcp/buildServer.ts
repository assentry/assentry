import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { issueCredentialForAgentGrant, listGrantsForAgent } from "../lib/agentActions";

// The hosted equivalent of connector/ — same two capabilities, reached over
// the OAuth-authenticated remote transport instead of a locally-run process
// with a manually configured key. One McpServer instance per request
// (stateless mode), scoped to whichever agent the bearer token resolved to.
export function buildMcpServerForAgent(agentId: string): McpServer {
  const server = new McpServer({ name: "hapi", version: "0.1.0" });

  server.registerTool(
    "list_my_authorizations",
    {
      description:
        "List what this agent is currently authorised to do for the person who connected it, " +
        "including scope, what data it may disclose, and when each authorisation expires.",
    },
    async () => {
      const grants = await listGrantsForAgent(agentId);
      if (grants.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No active authorisations. Ask the person to authorise this agent for something in the HAPI personal app first.",
            },
          ],
        };
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(grants, null, 2) }] };
    }
  );

  server.registerTool(
    "get_credential",
    {
      description:
        "Fetch a fresh, short-lived credential for one specific authorisation (by its grant id from " +
        "list_my_authorizations), to present to a participating site right before acting. Always call " +
        "this immediately before acting rather than reusing a credential from earlier in the conversation.",
      inputSchema: { grantId: z.string().describe("The grant id from list_my_authorizations") },
    },
    async ({ grantId }) => {
      const outcome = await issueCredentialForAgentGrant(agentId, grantId);
      if (!outcome.ok) {
        return { isError: true, content: [{ type: "text" as const, text: outcome.error.replace(/_/g, " ") }] };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { credential: outcome.credential, scope: outcome.scope, expiresAt: outcome.expiresAt },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
