import { createHash, randomBytes } from "crypto";
import { getDatabase } from "../audit/db.js";
import { generateId } from "../utils/id.js";

export interface ApiKeyRecord {
  id: string;
  name: string;
  role: string;
  createdAt: number;
  lastUsed: number | null;
  revoked: boolean;
}

export function generateApiKey(): string {
  return "sk-" + randomBytes(32).toString("hex");
}

function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function createApiKey(
  name: string,
  role: string
): { id: string; key: string } {
  const db = getDatabase();
  const id = generateId();
  const rawKey = generateApiKey();
  const keyHash = hashKey(rawKey);

  db.prepare(
    `INSERT INTO api_keys (id, key_hash, name, role, created_at)
     VALUES (@id, @keyHash, @name, @role, @createdAt)`
  ).run({ id, keyHash, name, role, createdAt: Date.now() });

  return { id, key: rawKey };
}

export function lookupApiKey(
  rawKey: string
): { callerId: string; callerRole: string } | null {
  const db = getDatabase();
  const keyHash = hashKey(rawKey);

  const row = db
    .prepare(
      `SELECT id, role FROM api_keys WHERE key_hash = @keyHash AND revoked = 0`
    )
    .get({ keyHash }) as { id: string; role: string } | undefined;

  if (!row) return null;

  db.prepare(`UPDATE api_keys SET last_used = @now WHERE id = @id`).run({
    now: Date.now(),
    id: row.id,
  });

  return { callerId: row.id, callerRole: row.role };
}

export function listApiKeys(): ApiKeyRecord[] {
  const db = getDatabase();
  return db
    .prepare(
      `SELECT id, name, role,
              created_at as createdAt, last_used as lastUsed,
              CAST(revoked AS INTEGER) as revoked
       FROM api_keys ORDER BY created_at DESC`
    )
    .all() as ApiKeyRecord[];
}

export function revokeApiKey(id: string): boolean {
  const db = getDatabase();
  const result = db
    .prepare(`UPDATE api_keys SET revoked = 1 WHERE id = @id`)
    .run({ id });
  return result.changes > 0;
}
