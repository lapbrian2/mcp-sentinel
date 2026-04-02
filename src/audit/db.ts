import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import type { AuditEntry } from "../types.js";
import { logger } from "../utils/logger.js";

let db: Database.Database | null = null;

export function initDatabase(dbPath: string): Database.Database {
  const resolved = resolve(dbPath);
  const dir = dirname(resolved);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const instance = new Database(resolved);
  instance.pragma("journal_mode = WAL");
  instance.pragma("synchronous = NORMAL");

  createSchema(instance);
  logger.info("Database initialized", { path: resolved });

  db = instance;
  return instance;
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error("Database not initialized");
  return db;
}

function createSchema(instance: Database.Database): void {
  instance.exec(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transport TEXT NOT NULL CHECK(transport IN ('stdio', 'http')),
      upstream TEXT,
      status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('healthy', 'unhealthy', 'unknown')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      server_id TEXT NOT NULL,
      caller_id TEXT NOT NULL,
      caller_role TEXT NOT NULL,
      method TEXT NOT NULL,
      tool_name TEXT,
      resource_uri TEXT,
      params TEXT,
      response_status TEXT NOT NULL CHECK(response_status IN ('success', 'error')),
      policy_decision TEXT NOT NULL CHECK(policy_decision IN ('allow', 'deny')),
      matched_rule TEXT,
      latency_ms INTEGER NOT NULL,
      scan_flags TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY(server_id) REFERENCES mcp_servers(id)
    );

    CREATE TABLE IF NOT EXISTS violations (
      id TEXT PRIMARY KEY,
      audit_log_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('policy_deny', 'scan_alert')),
      severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high', 'critical')),
      rule_id TEXT NOT NULL,
      detail TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY(audit_log_id) REFERENCES audit_logs(id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      last_used INTEGER,
      revoked INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_server ON audit_logs(server_id);
    CREATE INDEX IF NOT EXISTS idx_audit_caller ON audit_logs(caller_id);
    CREATE INDEX IF NOT EXISTS idx_audit_decision ON audit_logs(policy_decision);
    CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON violations(timestamp);
  `);
}

export function insertAuditEntry(entry: AuditEntry): void {
  const instance = getDatabase();
  const stmt = instance.prepare(`
    INSERT INTO audit_logs (
      id, timestamp, server_id, caller_id, caller_role, method,
      tool_name, resource_uri, params, response_status,
      policy_decision, matched_rule, latency_ms, scan_flags
    ) VALUES (
      @id, @timestamp, @serverId, @callerId, @callerRole, @method,
      @toolName, @resourceUri, @params, @responseStatus,
      @policyDecision, @matchedRule, @latencyMs, @scanFlags
    )
  `);
  stmt.run({
    id: entry.id,
    timestamp: entry.timestamp,
    serverId: entry.serverId,
    callerId: entry.callerId,
    callerRole: entry.callerRole,
    method: entry.method,
    toolName: entry.toolName ?? null,
    resourceUri: entry.resourceUri ?? null,
    params: entry.params ?? null,
    responseStatus: entry.responseStatus,
    policyDecision: entry.policyDecision,
    matchedRule: entry.matchedRule ?? null,
    latencyMs: entry.latencyMs,
    scanFlags: entry.scanFlags,
  });
}

export function queryAuditLogs(opts: {
  from?: number;
  to?: number;
  callerId?: string;
  toolName?: string;
  decision?: "allow" | "deny";
  limit?: number;
  offset?: number;
}): AuditEntry[] {
  const instance = getDatabase();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (opts.from !== undefined) {
    conditions.push("timestamp >= @from");
    params["from"] = opts.from;
  }
  if (opts.to !== undefined) {
    conditions.push("timestamp <= @to");
    params["to"] = opts.to;
  }
  if (opts.callerId !== undefined) {
    conditions.push("caller_id = @callerId");
    params["callerId"] = opts.callerId;
  }
  if (opts.toolName !== undefined) {
    conditions.push("tool_name = @toolName");
    params["toolName"] = opts.toolName;
  }
  if (opts.decision !== undefined) {
    conditions.push("policy_decision = @decision");
    params["decision"] = opts.decision;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;

  params["limit"] = limit;
  params["offset"] = offset;

  return instance
    .prepare(
      `SELECT * FROM audit_logs ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`
    )
    .all(params) as AuditEntry[];
}
