import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import type {
  ServerConfig,
  SentinelConfig,
  PolicyConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  ProxyContext,
} from "../types.js";
import { evaluatePolicy } from "../policy/engine.js";
import { SecurityScanner } from "../security/scanner.js";
import { logAuditEntry } from "../audit/logger.js";
import { logger } from "../utils/logger.js";

const JSONRPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  POLICY_DENIED: -32001,
  SCAN_BLOCKED: -32002,
} as const;

export class StdioProxy {
  private child: ChildProcess | null = null;
  private scanner = new SecurityScanner();

  constructor(
    private serverConfig: ServerConfig,
    private sentinelConfig: SentinelConfig,
    private getPolicies: () => PolicyConfig
  ) {}

  start(): void {
    if (!this.serverConfig.command) {
      throw new Error(`Server ${this.serverConfig.name} missing 'command'`);
    }

    const args = this.serverConfig.args ?? [];
    const env = {
      ...process.env,
      ...this.interpolateEnv(this.serverConfig.env ?? {}),
    };

    logger.info("Starting stdio MCP server", {
      name: this.serverConfig.name,
      command: this.serverConfig.command,
      args,
    });

    this.child = spawn(this.serverConfig.command, args, {
      env,
      stdio: ["pipe", "pipe", "inherit"],
    });

    this.child.on("error", (err) => {
      logger.error("Child process error", { name: this.serverConfig.name, err });
    });

    this.child.on("exit", (code) => {
      logger.info("Child process exited", { name: this.serverConfig.name, code });
      this.child = null;
    });

    // Pipe child stdout back to our stdout (after interception)
    // We intercept on the read side — child's stdout → readline → process → our stdout
    const childStdout = this.child.stdout;
    if (childStdout) {
      const rl = createInterface({ input: childStdout });
      rl.on("line", (line) => {
        // Pass upstream responses straight through to our stdout
        process.stdout.write(line + "\n");
      });
    }

    // Intercept our stdin → parse → policy check → forward to child stdin
    const stdinRl = createInterface({ input: process.stdin });
    stdinRl.on("line", (line) => {
      this.handleLine(line);
    });

    stdinRl.on("close", () => {
      this.child?.stdin?.end();
    });
  }

  private handleLine(line: string): void {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch {
      this.writeError(null, JSONRPC_ERROR_CODES.PARSE_ERROR, "Parse error");
      return;
    }

    const context: ProxyContext = {
      serverId: this.serverConfig.name,
      callerId: "stdio-client",
      callerRole: this.getPolicies().defaultRole,
      startedAt: Date.now(),
    };

    this.processRequest(request, context, (response) => {
      const childStdin = this.child?.stdin;
      if (childStdin?.writable) {
        childStdin.write(JSON.stringify(request) + "\n");
      } else {
        this.writeResponse(response);
      }
    });
  }

  private processRequest(
    request: JsonRpcRequest,
    context: ProxyContext,
    onAllow: (response: JsonRpcResponse) => void
  ): void {
    const policies = this.getPolicies();
    const policyResult = evaluatePolicy(request, context.callerRole, policies);

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

      this.writeResponse(response);
      return;
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

      this.writeResponse(response);
      return;
    }

    // Forward to upstream
    const okResponse: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: request.id,
      result: null,
    };

    logAuditEntry({
      request,
      response: okResponse,
      context,
      policyDecision: "allow",
      matchedRule: policyResult.matchedRule,
      scanFlags: scanResult.flags,
      auditConfig: this.sentinelConfig.audit,
    });

    onAllow(okResponse);
  }

  private writeResponse(response: JsonRpcResponse): void {
    process.stdout.write(JSON.stringify(response) + "\n");
  }

  private writeError(
    id: string | number | null,
    code: number,
    message: string
  ): void {
    this.writeResponse({
      jsonrpc: "2.0",
      id,
      error: { code, message },
    });
  }

  private interpolateEnv(env: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      result[k] = v.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
        return process.env[key] ?? "";
      });
    }
    return result;
  }

  stop(): void {
    this.child?.kill("SIGTERM");
    this.child = null;
  }
}
