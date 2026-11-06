import { Router } from "express";

// Lets an MCP client (Claude, etc.) discover how to connect without a human
// ever typing a key anywhere, it reads these on first contact with /mcp.
export const oauthMetaRouter = Router();

function issuer(req: { protocol: string; get(name: string): string | undefined }): string {
  return process.env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
}

oauthMetaRouter.get("/.well-known/oauth-authorization-server", (req, res) => {
  const base = issuer(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});

oauthMetaRouter.get("/.well-known/oauth-protected-resource", (req, res) => {
  const base = issuer(req);
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
  });
});
