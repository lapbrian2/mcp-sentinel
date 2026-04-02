/**
 * Core types for MCP Sentinel
 */

export interface SentinelConfig {
  port: number;
  dashboardPort: number;
  logLevel: "debug" | "info" | "warn" | "error";
  servers: ServerConfig[];
  audit: AuditConfig;
  security: SecurityConfig;
  auth: AuthConfig;
}

export interface ServerConfig {
  name: string;
  transport: "stdio" | "http";
  // stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // http
  url?: string;
}

export interface AuditConfig {
  database: string;
  retention: string; // e.g. "90d"
  redactFields: string[];
}

export interface SecurityConfig {
  rules: string;
  defaultAction: "log" | "warn" | "block";
}

export interface AuthConfig {
  type: "api-key" | "none";
  headerName?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  serverId: string;
  callerId: string;
  callerRole: string;
  method: string;
  toolName: string | null;
  resourceUri: string | null;
  params: string | null; // JSON, redacted
  responseStatus: "success" | "error";
  policyDecision: "allow" | "deny";
  matchedRule: string | null;
  latencyMs: number;
  scanFlags: string; // JSON array
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface PolicyRule {
  allow?: string | string[];
  deny?: string | string[];
  tools?: string[];
  resources?: string[];
  conditions?: PolicyCondition[];
}

export interface PolicyRole {
  description?: string;
  rules: PolicyRule[];
}

export interface PolicyConfig {
  roles: Record<string, PolicyRole>;
  defaultRole: string;
}

export interface ProxyContext {
  serverId: string;
  callerId: string;
  callerRole: string;
  startedAt: number;
}

export interface ScanResult {
  flagged: boolean;
  flags: ScanFlag[];
}

export interface ScanFlag {
  type: "prompt_injection" | "data_exfiltration" | "privilege_escalation";
  severity: "low" | "medium" | "high" | "critical";
  detail: string;
  ruleId: string;
}

export interface PolicyCondition {
  field: string;
  contains?: string;
  matches?: string;
  notContains?: string;
}
