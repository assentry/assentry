import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { issueCredentialForAgentGrant, listGrantsForAgent } from "../lib/agentActions";
import { approveSignIn } from "../lib/signIn";

// The MCP server an AI agent talks to once it's OAuth-connected: two tools,
// reached over the authenticated remote transport. One McpServer instance
// per request (stateless mode), scoped to whichever agent the bearer token
// resolved to.
export function buildMcpServerForAgent(agentId: string): McpServer {
  const server = new McpServer(
    { name: "assentry", version: "0.1.0" },
    {
      instructions:
        "Assentry lets you act on participating websites for the person who connected you, with their permission. " +
        "When a website you're browsing shows an Assentry sign-in code (it starts with asq_), " +
        "sign in by calling approve_sign_in with that code and the domain from the address bar of the page you're on. " +
        "Assentry only approves it if the code belongs to that verified domain. The site then signs you in by itself. " +
        "Never type a credential, password or token into a website; with Assentry you never need to.",
    }
  );

  server.registerTool(
    "list_my_authorizations",
    {
      description:
        "List what this agent is currently authorised to do for the person who connected it, " +
        "including what data it may disclose and when each authorisation expires.",
    },
    async () => {
      const grants = await listGrantsForAgent(agentId);
      if (grants.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No active authorisations. Ask the person to authorise this agent for something in the Assentry personal app first.",
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
              { credential: outcome.credential, expiresAt: outcome.expiresAt },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "approve_sign_in",
    {
      description:
        "Sign in to a participating website you're browsing. The site shows an Assentry sign-in code " +
        "(a long code starting with asq_). Copy it exactly and pass it here; the site then signs you in for the " +
        "person who connected you, without you typing anything into the site. Pass the domain from the address bar too: Assentry checks the code was " +
        "issued to that verified domain and refuses otherwise. If the person has more than one active " +
        "authorisation, pass grantId (from list_my_authorizations).",
      inputSchema: {
        code: z.string().describe("The full sign-in code shown on the website, starting with asq_"),
        siteDomain: z
          .string()
          .describe("The domain in the address bar of the page showing the code, e.g. shop.example.com"),
        grantId: z.string().optional().describe("Which authorisation to use, if there is more than one"),
      },
    },
    async ({ code, siteDomain, grantId }) => {
      const outcome = await approveSignIn(agentId, code, siteDomain, grantId);
      if (!outcome.ok && outcome.error === "domain_mismatch") {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text:
                `Not approved: this code was issued to ${outcome.codeDomain}, not ${siteDomain}. ` +
                "The page may be showing another site's code. Don't sign in here; tell the person.",
            },
          ],
        };
      }
      if (!outcome.ok) {
        const messages: Record<string, string> = {
          code_not_found: "No such sign-in code. Check it against the page, or reload the page for a new one.",
          code_expired: "That code has expired. Reload the page to get a new one.",
          code_already_used: "That code has already been used. Reload the page to get a new one.",
          grant_not_found:
            "No active authorisation to use. Ask the person to authorise this agent in the Assentry app first.",
          grant_revoked: "That authorisation has been withdrawn by the person.",
          grant_expired: "That authorisation has expired. Ask the person to renew it.",
          choose_grant:
            "There is more than one active authorisation. Call list_my_authorizations and pass the grantId to use.",
        };
        return { isError: true, content: [{ type: "text" as const, text: messages[outcome.error] }] };
      }
      return {
        content: [
          {
            type: "text" as const,
            text:
              `Approved for "${outcome.siteName}" (${outcome.siteDomain}, verified). ` +
              "The page signs you in within a few seconds by itself.",
          },
        ],
      };
    }
  );

  return server;
}
