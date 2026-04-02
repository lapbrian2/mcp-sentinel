import { insertAuditEntry } from "./db.js";
import type { AuditEntry, AuditConfig, JsonRpcRequest, JsonRpcResponse, ProxyContext, ScanFlag } from "../types.js";
import { generateId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

const REDACT_PLACEHOLDER = "[REDACTED]";

export function redactParams(
  params: unknown,
  redactFields: string[]
): unknown {
  if (params === null || params === undefined) return params;
  if (typeof params !== "object") return params;
  if (Array.isArray(params)) {
    return params.map((item) => redactParams(item, redactFields));
  }

  const record = params as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (redactFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      result[key] = REDACT_PLACEHOLDER;
    } else if (typeof value === "object") {
      result[key] = redactParams(value, redactFields);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function extractToolInfo(request: JsonRpcRequest): {
  toolName: string | null;
  resourceUri: string | null;
} {
  if (request.method === "tools/call") {
    const params = request.params as { name?: string } | undefined;
    return { toolName: params?.name ?? null, resourceUri: null };
  }
  if (request.method === "resources/read") {
    const params = request.params as { uri?: string } | undefined;
    return { toolName: null, resourceUri: params?.uri ?? null };
  }
  return { toolName: null, resourceUri: null };
}

export function logAuditEntry(opts: {
  request: JsonRpcRequest;
  response: JsonRpcResponse;
  context: ProxyContext;
  policyDecision: "allow" | "deny";
  matchedRule: string | null;
  scanFlags: ScanFlag[];
  auditConfig: AuditConfig;
}): void {
  const { request, response, context, policyDecision, matchedRule, scanFlags, auditConfig } = opts;
  const now = Date.now();
  const { toolName, resourceUri } = extractToolInfo(request);

  const redactedParams =
    request.params !== undefined
      ? redactParams(request.params, auditConfig.redactFields)
      : null;

  const entry: AuditEntry = {
    id: generateId(),
    timestamp: context.startedAt,
    serverId: context.serverId,
    callerId: context.callerId,
    callerRole: context.callerRole,
    method: request.method,
    toolName,
    resourceUri,
    params: redactedParams !== null ? JSON.stringify(redactedParams) : null,
    responseStatus: response.error ? "error" : "success",
    policyDecision,
    matchedRule,
    latencyMs: now - context.startedAt,
    scanFlags: JSON.stringify(scanFlags.map((f) => f.type)),
  };

  try {
    insertAuditEntry(entry);
  } catch (err) {
    logger.error("Failed to write audit log", err);
  }

  // Structured stdout log for pipeline integration
  const structuredLog = {
    ...entry,
    scanFlags: scanFlags,
  };
  process.stdout.write(JSON.stringify(structuredLog) + "\n");
}
