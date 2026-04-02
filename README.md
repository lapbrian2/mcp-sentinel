# MCP Sentinel

> Open-source governance proxy for MCP servers. Self-hosted. Policy-as-code. Enterprise-ready.

MCP Sentinel is a transparent proxy that sits between MCP clients (AI agents, IDEs) and MCP servers. All MCP traffic flows through Sentinel, which enforces RBAC policies, logs every call, and detects suspicious patterns.

## Features (MVP)

- **Transparent proxy** — stdio and Streamable HTTP transports
- **RBAC policy engine** — declarative YAML policies, deny-by-default, hot-reload
- **Audit trail** — SQLite logging with structured JSON stdout
- **Security scanning** — prompt injection, data exfiltration, path traversal detection
- **Zero-config forwarding** — drop Sentinel between client and server

## Quickstart

```bash
npm install -g mcp-sentinel

# Create sentinel.yaml
mcp-sentinel start
```

## Configuration

```yaml
# sentinel.yaml
port: 4100
logLevel: info

servers:
  - name: github
    transport: stdio
    command: npx -y @modelcontextprotocol/server-github
    env:
      GITHUB_TOKEN: ${GITHUB_TOKEN}

  - name: database
    transport: http
    url: http://localhost:8080/mcp

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
```

## Policy Example

```yaml
# policies/default.yaml
roles:
  admin:
    rules:
      - allow: "*"

  analyst:
    rules:
      - allow: "resources/read"
      - allow: "tools/call"
        tools: ["query_*", "search_*", "get_*"]
      - deny: "*"

defaultRole: analyst
```

## License

MIT
