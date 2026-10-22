#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { HapiAgentClient } from "./hapiClient.js";

const agentKey = process.env.HAPI_AGENT_KEY;
if (!agentKey) {
  console.error("HAPI_AGENT_KEY is required — get one by connecting an agent in the HAPI personal app.");
  process.exit(1);
}

const baseUrl = (process.env.HAPI_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const hapi = new HapiAgentClient(agentKey, baseUrl);

const server = new McpServer({ name: "hapi-connector", version: "0.1.0" });

// This connector deliberately cannot create new permissions — it can only
// use what the person already authorised through the HAPI personal app
// (Option A from the design discussion). If nothing shows up here, the
// person needs to go authorise this agent for something first.
server.registerTool(
  "list_my_authorizations",
  {
    description:
      "List what this agent is currently authorised to do for the person who connected it, " +
      "including scope, what data it may disclose, and when each authorisation expires.",
  },
  async () => {
    const grants = await hapi.listGrants();
    if (grants.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No active authorisations. Ask the person to authorise this agent for something in the HAPI personal app first.",
          },
        ],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(grants, null, 2) }],
    };
  }
);

server.registerTool(
  "get_credential",
  {
    description:
      "Fetch a fresh, short-lived credential for one specific authorisation (by its grant id from " +
      "list_my_authorizations), to present to a participating site right before acting. Always call " +
      "this immediately before acting rather than reusing a credential from earlier in the conversation " +
      "— if the person revoked the authorisation since, this will fail instead of handing out stale access.",
    inputSchema: {
      grantId: z.string().describe("The grant id from list_my_authorizations"),
    },
  },
  async ({ grantId }) => {
    try {
      const result = await hapi.getCredential(grantId);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: err instanceof Error ? err.message : "credential request failed" }],
      };
    }
  }
);

await server.connect(new StdioServerTransport());
