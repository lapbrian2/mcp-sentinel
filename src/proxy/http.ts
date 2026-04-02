import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type {
  SentinelConfig,
  PolicyConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  ProxyContext,
  ServerConfig,
} from "../types.js";
import { evaluatePolicy } from "../policy/engine.js";
import { SecurityScanner } from "../security/scanner.js";
import { logAuditEntry } from "../audit/logger.js";
import { logger } from "../utils/logger.js";

const JSONRPC_ERROR_CODES = {
  POLICY_DENIED: -32001,
  SCAN_BLOCKED: -32002,
  INTERNAL_ERROR: -32603,
} as const;

export class HttpProxy {
  private scanner = new SecurityScanner();

  constructor(
    private serverConfig: ServerConfig,
    private sentinelConfig: SentinelConfig,
    private getPolicies: () => PolicyConfig
  ) {}

  /**
   * Process a single JSON-RPC request through the sentinel pipeline.
   * Used by the HTTP server handler.
   */
  async processRequest(
    request: JsonRpcRequest,
    callerId: string,
    callerRole: string
  ): Promise<JsonRpcResponse> {
    const context: ProxyContext = {
      serverId: this.serverConfig.name,
      callerId,
      callerRole,
      startedAt: Date.now(),
    };

    const policies = this.getPolicies();
    const policyResult = evaluatePolicy(request, callerRole, policies);

    if (policyResult.decision === "deny") {
      const response: JsonRpcResponse = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: JSONRPC_ERROR_CODES.POLICY_DENIED,
          message: `Access denied: ${policyResult.reason}`,
        },
      };

      logAuditEntry({
        request,
        response,
        context,
        policyDecision: "deny",
        matchedRule: policyResult.matchedRule,
        scanFlags: [],
        auditConfig: this.sentinelConfig.audit,
      });

      return response;
    }

    // Security scan
    const scanResult = this.scanner.scan(request.params);
    const defaultAction = this.sentinelConfig.security.defaultAction;

    if (scanResult.flagged && defaultAction === "block") {
      const response: JsonRpcResponse = {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: JSONRPC_ERROR_CODES.SCAN_BLOCKED,
          message: "Request blocked by security scanner",
        },
      };

      logAuditEntry({
        request,
        response,
        context,
        policyDecision: "allow",
        matchedRule: policyResult.matchedRule,
        scanFlags: scanResult.flags,
        auditConfig: this.sentinelConfig.audit,
      });

      return response;
    }

    // Forward to upstream
    const upstreamResponse = await this.forwardToUpstream(request);

    logAuditEntry({
      request,
      response: upstreamResponse,
      context,
      policyDecision: "allow",
      matchedRule: policyResult.matchedRule,
      scanFlags: scanResult.flags,
      auditConfig: this.sentinelConfig.audit,
    });

    return upstreamResponse;
  }

  private async forwardToUpstream(
    request: JsonRpcRequest
  ): Promise<JsonRpcResponse> {
    if (!this.serverConfig.url) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: JSONRPC_ERROR_CODES.INTERNAL_ERROR,
          message: "Server URL not configured",
        },
      };
    }

    try {
      const resp = await fetch(this.serverConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!resp.ok) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: JSONRPC_ERROR_CODES.INTERNAL_ERROR,
            message: `Upstream error: ${resp.status} ${resp.statusText}`,
          },
        };
      }

      return (await resp.json()) as JsonRpcResponse;
    } catch (err) {
      logger.error("Upstream request failed", { err });
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: JSONRPC_ERROR_CODES.INTERNAL_ERROR,
          message: "Upstream connection failed",
        },
      };
    }
  }

  resolveCallerIdentity(req: IncomingMessage): {
    callerId: string;
    callerRole: string;
  } {
    const authHeader = req.headers.authorization;
    const policies = this.getPolicies();

    if (!authHeader) {
      return { callerId: "anonymous", callerRole: policies.defaultRole };
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    // In MVP, we do a simple lookup against api_keys table
    // For now, return a role based on token prefix (placeholder)
    // Full API key → role mapping is in the auth module
    return { callerId: token.slice(0, 8), callerRole: policies.defaultRole };
  }
}

export function createHttpHandler(
  proxy: HttpProxy,
  sentinelConfig: SentinelConfig
) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    // Read body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks).toString("utf-8");

    let request: JsonRpcRequest;
    try {
      request = JSON.parse(body) as JsonRpcRequest;
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        })
      );
      return;
    }

    const { callerId, callerRole } = proxy.resolveCallerIdentity(req);
    const response = await proxy.processRequest(request, callerId, callerRole);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  };
}
