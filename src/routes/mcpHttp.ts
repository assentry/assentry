import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Router } from "express";
import { AgentApiRequest, requireAgentKey } from "../lib/agentAuth";
import { buildMcpServerForAgent } from "../mcp/buildServer";

// The remote connector: an MCP client (Claude, etc.) that completed the
// OAuth flow talks to this over HTTP using its bearer access token, instead
// of running connector/ as a local process. Stateless — a fresh
// server+transport pair per request, scoped to whichever agent the token
// resolved to.
export const mcpHttpRouter = Router();
mcpHttpRouter.use(requireAgentKey);

mcpHttpRouter.all("/", async (req: AgentApiRequest, res) => {
  const server = buildMcpServerForAgent(req.agent!.id);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
