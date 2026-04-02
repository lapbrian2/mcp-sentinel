# MCP Sentinel

> Open-source governance proxy for MCP servers. Self-hosted. Policy-as-code. Enterprise-ready.

MCP Sentinel is a transparent proxy that sits between MCP clients (AI agents, IDEs) and MCP servers. All MCP traffic flows through Sentinel, which enforces RBAC policies, logs every call, detects suspicious patterns, and exposes a real-time dashboard.

```
MCP Client → Sentinel (RBAC · Audit · Scan) → MCP Server
```

## Features

- **Transparent proxy** — stdio and Streamable HTTP transports, zero client/server changes
- **RBAC policy engine** — declarative YAML policies, deny-by-default, hot-reload without restart
- **Audit trail** — SQLite logging with structured JSON stdout, CSV/JSON export
- **Security scanning** — prompt injection, data exfiltration, path traversal detection
- **Dashboard** — real-time traffic view, violations feed, audit search at `http://localhost:4200`
- **API key management** — create/revoke keys mapped to roles via REST API or dashboard
- **Self-hosted** — no cloud, no account, runs in your infrastructure

## Quickstart

```bash
npm install -g mcp-sentinel
```

Create `sentinel.yaml` in your project directory:

```yaml
port: 4100
dashboardPort: 4200
logLevel: info

servers:
  - name: github
    transport: stdio
    command: npx -y @modelcontextprotocol/server-github
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}

audit:
  database: ./data/sentinel.db
  retention: 90d
  redactFields:
    - password
    - token
    - secret

security:
  rules: ./policies/*.yaml
  defaultAction: log

auth:
  type: api-key
  headerName: Authorization
```

Create your first policy in `policies/default.yaml`:

```yaml
roles:
  admin:
    description: Full access
    rules:
      - allow: "*"

  engineer:
    description: Full tool access, no admin ops
    rules:
      - allow: "tools/call"
        tools: ["*"]
      - allow: "resources/*"
      - deny: "admin/*"

  analyst:
    description: Read-only access
    rules:
      - allow: "resources/read"
      - allow: "tools/call"
        tools: ["query_*", "search_*", "get_*", "list_*"]
      - deny: "*"

defaultRole: analyst
```

Start Sentinel:

```bash
mcp-sentinel start
# Dashboard: http://localhost:4200
# Proxy: http://localhost:4100
```

Reconfigure your MCP clients to point to `http://localhost:4100` instead of your MCP servers directly.

## Transports

### stdio (Claude Desktop, local servers)

```yaml
servers:
  - name: my-server
    transport: stdio
    command: node ./my-mcp-server.js
    args: ["--port", "8080"]
```

Run via CLI:

```bash
mcp-sentinel stdio my-server --config sentinel.yaml
```

### Streamable HTTP (remote servers)

```yaml
servers:
  - name: remote-api
    transport: http
    url: http://your-mcp-server:8080/mcp
```

## API Keys

Create an API key for a specific role:

```bash
# Via REST API
curl -X POST http://localhost:4200/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name": "analytics-agent", "role": "analyst"}'

# Returns: { "id": "...", "key": "sk-..." }
```

Pass the key in requests to the proxy:

```
Authorization: Bearer sk-<your-key>
```

Manage keys via the dashboard at `http://localhost:4200`.

## Audit Log

Query and export via API:

```bash
# Last 50 denied calls
curl "http://localhost:4200/api/audit?decision=deny&limit=50"

# Export all as CSV
curl "http://localhost:4200/api/audit/export?format=csv" -o audit.csv

# Export as JSON
curl "http://localhost:4200/api/audit/export?format=json" -o audit.json
```

Query parameters: `from` (unix ms), `to` (unix ms), `caller`, `tool`, `decision` (allow|deny), `limit`, `offset`.

## Security Rules

Security scanning is configured via YAML rules in the directory set by `security.rules`:

```yaml
# rules/custom.yaml
rules:
  - id: custom-block-env
    type: privilege_escalation
    severity: high
    description: Block access to env files
    pattern: "\.env"
    action: block
```

Default `action` is set by `security.defaultAction` in `sentinel.yaml`: `log`, `warn`, or `block`.

## Full Config Reference

```yaml
port: 4100               # HTTP proxy port
dashboardPort: 4200      # Dashboard + management API port
logLevel: info           # debug | info | warn | error

servers:
  - name: string         # Unique server name
    transport: stdio     # stdio | http
    command: string      # (stdio) command to run
    args: []             # (stdio) command arguments
    env: {}              # (stdio) environment variables, ${VAR} interpolation supported
    url: string          # (http) upstream URL

audit:
  database: ./data/sentinel.db   # SQLite file path
  retention: 90d                 # Retention period (days)
  redactFields:                  # Fields to redact from logged params
    - password
    - token

security:
  rules: ./rules/*.yaml          # Glob path to security rule files
  defaultAction: log             # log | warn | block

auth:
  type: api-key                  # api-key | none
  headerName: Authorization      # Header to read token from
```

## Dashboard

The dashboard is served at `http://localhost:<dashboardPort>` (default: 4200).

**Pages:**
- **Overview** — traffic stats, top tools, top callers, recent activity
- **Audit Log** — filterable call log with CSV/JSON export
- **Violations** — security scan hits and policy denials
- **Policies** — current loaded policy state (read-only)
- **API Keys** — create and revoke API keys

## Docker

```bash
docker run -v $(pwd)/config:/config -p 4100:4100 -p 4200:4200 \
  ghcr.io/lapbrian2/mcp-sentinel:latest start --config /config/sentinel.yaml
```

## Development

```bash
git clone https://github.com/lapbrian2/mcp-sentinel
cd mcp-sentinel
pnpm install
pnpm dev       # watch mode
pnpm test      # run tests
pnpm build     # production build
pnpm typecheck # type check only
```

## License

MIT — see [LICENSE](./LICENSE)

---

**[Website](https://mcp-sentinel.com)** · **[GitHub](https://github.com/lapbrian2/mcp-sentinel)** · **[Issues](https://github.com/lapbrian2/mcp-sentinel/issues)**
