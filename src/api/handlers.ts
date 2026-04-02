import type { IncomingMessage, ServerResponse } from "http";
import type { URL } from "url";
import type { PolicyConfig } from "../types.js";
import {
  queryAuditLogs,
  queryViolations,
  getStats,
} from "../audit/db.js";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../auth/api-keys.js";
import { sendJson } from "./server.js";

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  body: unknown,
  getPolicies: () => PolicyConfig
): Promise<void> {
  const { method } = req;
  const path = url.pathname;

  // GET /api/health
  if (method === "GET" && path === "/api/health") {
    sendJson(res, 200, { status: "ok", timestamp: Date.now() });
    return;
  }

  // GET /api/stats
  if (method === "GET" && path === "/api/stats") {
    try {
      sendJson(res, 200, getStats());
    } catch {
      sendJson(res, 200, { totalCalls: 0, allowedCalls: 0, deniedCalls: 0, violationCount: 0, callsLastHour: 0, avgLatencyMs: 0, topTools: [], topCallers: [] });
    }
    return;
  }

  // GET /api/policies
  if (method === "GET" && path === "/api/policies") {
    sendJson(res, 200, getPolicies());
    return;
  }

  // GET /api/audit
  if (method === "GET" && path === "/api/audit") {
    try {
      const auditOpts: Parameters<typeof queryAuditLogs>[0] = {
        limit: numParam(url, "limit") ?? 100,
        offset: numParam(url, "offset") ?? 0,
      };
      const auditFrom = numParam(url, "from");
      const auditTo = numParam(url, "to");
      const auditCaller = url.searchParams.get("caller");
      const auditTool = url.searchParams.get("tool");
      const auditDecision = url.searchParams.get("decision") as "allow" | "deny" | null;
      if (auditFrom !== undefined) auditOpts.from = auditFrom;
      if (auditTo !== undefined) auditOpts.to = auditTo;
      if (auditCaller) auditOpts.callerId = auditCaller;
      if (auditTool) auditOpts.toolName = auditTool;
      if (auditDecision) auditOpts.decision = auditDecision;
      const entries = queryAuditLogs(auditOpts);
      sendJson(res, 200, { entries, count: entries.length });
    } catch {
      sendJson(res, 200, { entries: [], count: 0 });
    }
    return;
  }

  // GET /api/audit/export
  if (method === "GET" && path === "/api/audit/export") {
    try {
      const format = url.searchParams.get("format") ?? "json";
      const exportOpts: Parameters<typeof queryAuditLogs>[0] = { limit: 10000, offset: 0 };
      const expFrom = numParam(url, "from"); if (expFrom !== undefined) exportOpts.from = expFrom;
      const expTo = numParam(url, "to"); if (expTo !== undefined) exportOpts.to = expTo;
      const entries = queryAuditLogs(exportOpts);

      if (format === "csv") {
        const header = "id,timestamp,server_id,caller_id,caller_role,method,tool_name,policy_decision,latency_ms\n";
        const rows = entries.map((e) =>
          [e.id, e.timestamp, e.serverId, e.callerId, e.callerRole, e.method, e.toolName ?? "", e.policyDecision, e.latencyMs].join(",")
        ).join("\n");
        res.writeHead(200, {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="sentinel-audit-${Date.now()}.csv"`,
        });
        res.end(header + rows);
      } else {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="sentinel-audit-${Date.now()}.json"`,
        });
        res.end(JSON.stringify(entries, null, 2));
      }
    } catch {
      sendJson(res, 500, { error: "Export failed" });
    }
    return;
  }

  // GET /api/violations
  if (method === "GET" && path === "/api/violations") {
    try {
      const violOpts: Parameters<typeof queryViolations>[0] = {
        limit: numParam(url, "limit") ?? 100,
        offset: numParam(url, "offset") ?? 0,
      };
      const violFrom = numParam(url, "from"); if (violFrom !== undefined) violOpts.from = violFrom;
      const violTo = numParam(url, "to"); if (violTo !== undefined) violOpts.to = violTo;
      const violSev = url.searchParams.get("severity"); if (violSev) violOpts.severity = violSev;
      const violType = url.searchParams.get("type"); if (violType) violOpts.type = violType;
      const violations = queryViolations(violOpts);
      sendJson(res, 200, { violations, count: violations.length });
    } catch {
      sendJson(res, 200, { violations: [], count: 0 });
    }
    return;
  }

  // GET /api/keys
  if (method === "GET" && path === "/api/keys") {
    try {
      sendJson(res, 200, { keys: listApiKeys() });
    } catch {
      sendJson(res, 200, { keys: [] });
    }
    return;
  }

  // POST /api/keys
  if (method === "POST" && path === "/api/keys") {
    const payload = body as { name?: string; role?: string } | null;
    if (!payload?.name || !payload?.role) {
      sendJson(res, 400, { error: "name and role are required" });
      return;
    }
    try {
      const result = createApiKey(payload.name, payload.role);
      sendJson(res, 201, result);
    } catch (err) {
      sendJson(res, 500, { error: "Failed to create API key" });
    }
    return;
  }

  // DELETE /api/keys/:id
  const keyDeleteMatch = path.match(/^\/api\/keys\/([^/]+)$/);
  if (method === "DELETE" && keyDeleteMatch) {
    const id = keyDeleteMatch[1];
    if (!id) { sendJson(res, 400, { error: "Missing key id" }); return; }
    try {
      const ok = revokeApiKey(id);
      sendJson(res, ok ? 200 : 404, ok ? { success: true } : { error: "Key not found" });
    } catch {
      sendJson(res, 500, { error: "Failed to revoke key" });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function numParam(url: URL, key: string): number | undefined {
  const val = url.searchParams.get(key);
  if (val === null) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}
