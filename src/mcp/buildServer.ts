import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { issueCredentialForAgentGrant, listGrantsForAgent } from "../lib/agentActions";
import { approveSignIn } from "../lib/signIn";
import type { MissingDetail } from "../lib/profile";
import { listOpenRequests, suggestDetail } from "../lib/agentDetails";

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
        "For sites you reach over HTTP rather than in a browser: fetch a credential for one specific " +
        "authorisation (grant id from list_my_authorizations) and one participating site (its domain), to send " +
        "as 'Authorization: Bearer <credential>'. It only works on that site. Fetch it right before acting. " +
        "If you're in a browser, use approve_sign_in instead and never type a credential into a page.",
      inputSchema: {
        grantId: z.string().describe("The grant id from list_my_authorizations"),
        siteDomain: z.string().describe("The domain of the site you'll present it to, e.g. shop.example.com"),
      },
    },
    async ({ grantId, siteDomain }) => {
      const outcome = await issueCredentialForAgentGrant(agentId, grantId, siteDomain);
      if (!outcome.ok) {
        const text =
          outcome.error === "unknown_site"
            ? `${siteDomain} isn't a participating site with a verified domain, so there's no credential for it.`
            : outcome.error.replace(/_/g, " ");
        return { isError: true, content: [{ type: "text" as const, text }] };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                credential: outcome.credential,
                site: `${outcome.siteName} (${outcome.site})`,
                expiresAt: outcome.expiresAt,
              },
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
              "The page signs you in within a few seconds by itself. " +
              (outcome.sharedFields.length
                ? `This site can receive: ${outcome.sharedFields.join(", ")}. `
                : "This site receives none of the person's details. ") +
              describeMissing(outcome.missing),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_requested_details",
    {
      description:
        "List details that participating sites have asked the person for and that aren't available yet: each " +
        "with the site, key, label, type and whether it's required. The person has been notified in the Assentry app. " +
        "If you already know an answer for certain from your conversations with the person, you may suggest it " +
        "with suggest_detail; the person confirms it before any site sees it.",
    },
    async () => {
      const requests = await listOpenRequests(agentId);
      return {
        content: [
          {
            type: "text" as const,
            text: requests.length ? JSON.stringify(requests, null, 2) : "No sites are waiting on any details.",
          },
        ],
      };
    }
  );

  server.registerTool(
    "suggest_detail",
    {
      description:
        "Suggest a value for one of the person's details that a site asked for (see list_requested_details). " +
        "Only suggest what you know for certain from the person; never guess or invent. The suggestion is saved as " +
        "'suggested by your agent' and isn't shared with any site until the person confirms it (unless they've " +
        "chosen to let their agent fill in details without asking). Values must match the detail's type, e.g. " +
        "dates as YYYY-MM-DD, phone numbers with country code, addresses as an object with street_address, " +
        "locality, region, postal_code and country (ISO code). Files can't be suggested.",
      inputSchema: {
        key: z.string().describe("The detail's key, as listed by list_requested_details"),
        value: z.unknown().describe("The value, in the detail's type"),
        siteDomain: z
          .string()
          .optional()
          .describe("For a site's own custom detail: that site's domain, as listed by list_requested_details"),
      },
    },
    async ({ key, value, siteDomain }) => {
      const outcome = await suggestDetail(agentId, key, value, siteDomain);
      return outcome.ok
        ? { content: [{ type: "text" as const, text: outcome.message }] }
        : { isError: true, content: [{ type: "text" as const, text: outcome.error }] };
    }
  );

  return server;
}

function describeMissing(missing: MissingDetail[]): string {
  if (!missing.length) return "";
  const list = missing
    .map((m) => `${m.label} (${m.key}, ${m.type}${m.required ? ", required" : ""}${m.reason === "not_allowed" ? ", filled in but not yet allowed for this site" : ""})`)
    .join("; ");
  return (
    `Not available to this site yet: ${list}. The person has been asked in the Assentry app. ` +
    "If you know any of these for certain, you can suggest them with suggest_detail for the person to confirm."
  );
}
