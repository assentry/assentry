const API = "";
let token = localStorage.getItem("hapi_token") || "";

function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const res = await fetch(`${API}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  await handleAuthResponse(res);
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  await handleAuthResponse(res);
}

async function handleAuthResponse(res) {
  const data = await res.json();
  const statusEl = document.getElementById("auth-status");
  if (!res.ok) {
    statusEl.textContent = `Error: ${JSON.stringify(data.error)}`;
    return;
  }
  token = data.token;
  localStorage.setItem("hapi_token", token);
  statusEl.textContent = `Signed in as ${data.user.email}`;
  document.getElementById("app").classList.remove("hidden");
  await Promise.all([loadAgents(), loadGrants(), loadAudit()]);
}

async function connectAgent() {
  const platform = document.getElementById("platform").value;
  const label = document.getElementById("agent-label").value;
  await fetch(`${API}/agents`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ platform, label }),
  });
  await loadAgents();
}

async function loadAgents() {
  const res = await fetch(`${API}/agents`, { headers: authHeaders() });
  const { agents } = await res.json();

  const tbody = document.querySelector("#agents-table tbody");
  tbody.innerHTML = "";
  const select = document.getElementById("grant-agent");
  select.innerHTML = "";

  for (const agent of agents) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${agent.platform}</td><td>${agent.label ?? ""}</td>
      <td>${agent.revokedAt ? "revoked" : "active"}</td>
      <td>${agent.revokedAt ? "" : `<button onclick="revokeAgent('${agent.id}')">Revoke</button>`}</td>`;
    tbody.appendChild(tr);

    if (!agent.revokedAt) {
      const opt = document.createElement("option");
      opt.value = agent.id;
      opt.textContent = `${agent.platform} — ${agent.label ?? agent.id}`;
      select.appendChild(opt);
    }
  }
}

async function revokeAgent(id) {
  await fetch(`${API}/agents/${id}/revoke`, { method: "POST", headers: authHeaders() });
  await Promise.all([loadAgents(), loadGrants()]);
}

async function createGrant() {
  const agentId = document.getElementById("grant-agent").value;
  const scope = document.getElementById("grant-scope").value;
  const consentedFields = document
    .getElementById("grant-fields")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const expiresInMinutes = Number(document.getElementById("grant-minutes").value);

  const res = await fetch(`${API}/grants`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ agentId, scope, consentedFields, expiresInMinutes }),
  });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById("credential-output").textContent = JSON.stringify(data.error);
    return;
  }
  document.getElementById("credential-output").innerHTML =
    `<p>Credential issued — this is what the agent would carry:</p><pre>${data.credential}</pre>`;
  await loadGrants();
}

async function loadGrants() {
  const res = await fetch(`${API}/grants`, { headers: authHeaders() });
  const { grants } = await res.json();
  const tbody = document.querySelector("#grants-table tbody");
  tbody.innerHTML = "";
  for (const grant of grants) {
    const expired = new Date(grant.expiresAt) < new Date();
    const status = grant.revokedAt ? "revoked" : expired ? "expired" : "active";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${grant.scope}</td><td>${new Date(grant.expiresAt).toLocaleString()}</td>
      <td>${status}</td>
      <td>${status === "active" ? `<button onclick="revokeGrant('${grant.id}')">Revoke</button>` : ""}</td>`;
    tbody.appendChild(tr);
  }
}

async function revokeGrant(id) {
  await fetch(`${API}/grants/${id}/revoke`, { method: "POST", headers: authHeaders() });
  await loadGrants();
}

async function loadAudit() {
  const res = await fetch(`${API}/audit`, { headers: authHeaders() });
  const { logs } = await res.json();
  const tbody = document.querySelector("#audit-table tbody");
  tbody.innerHTML = "";
  for (const log of logs) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${new Date(log.createdAt).toLocaleString()}</td><td>${log.action}</td>
      <td><span class="pill ${log.result}">${log.result}</span></td>
      <td>${log.reason ?? ""}</td><td>${log.partner?.name ?? ""}</td>`;
    tbody.appendChild(tr);
  }
}

// Resume session if a token is already stored.
if (token) {
  document.getElementById("auth-status").textContent = "Restoring session…";
  fetch(`${API}/agents`, { headers: authHeaders() }).then((res) => {
    if (res.ok) {
      document.getElementById("app").classList.remove("hidden");
      document.getElementById("auth-status").textContent = "Signed in";
      loadAgents();
      loadGrants();
      loadAudit();
    } else {
      token = "";
      localStorage.removeItem("hapi_token");
    }
  });
}
