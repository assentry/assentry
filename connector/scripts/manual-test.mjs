// Drives the built connector exactly as an MCP host (Claude, etc.) would:
// spawn it over stdio, list tools, call them. Proves the connector works
// as a real MCP server, not just that the underlying HTTP calls work.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const agentKey = process.env.HAPI_AGENT_KEY;
if (!agentKey) {
  console.error("Set HAPI_AGENT_KEY before running this script.");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
  env: { ...process.env, HAPI_AGENT_KEY: agentKey },
});

const client = new Client({ name: "manual-test-host", version: "0.0.0" });
await client.connect(transport);

console.log("== tools the connector exposes ==");
const { tools } = await client.listTools();
console.log(tools.map((t) => t.name));

console.log("\n== list_my_authorizations ==");
const listResult = await client.callTool({ name: "list_my_authorizations", arguments: {} });
console.log(listResult.content[0].text);

const grants = JSON.parse(listResult.content[0].text);
const grantId = grants[0].id;

console.log(`\n== get_credential(${grantId}) ==`);
const credResult = await client.callTool({ name: "get_credential", arguments: { grantId } });
console.log(credResult.content[0].text);

const { credential } = JSON.parse(credResult.content[0].text);

console.log("\n== presenting that credential to the real demo job board ==");
const res = await fetch("http://localhost:4100/apply", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-hapi-grant": credential },
  body: "{}",
});
console.log(await res.json());

await client.close();
