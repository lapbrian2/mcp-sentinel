import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { URL } from "url";
import { logger } from "../utils/logger.js";
import { handleApiRequest } from "./handlers.js";
import { getDashboardHtml } from "../dashboard/html.js";
import type { PolicyConfig } from "../types.js";

export function startDashboardServer(
  port: number,
  getPolicies: () => PolicyConfig
): void {
  const server = createServer((req, res) => {
    handleRequest(req, res, getPolicies).catch((err) => {
      logger.error("Dashboard server error", err);
      sendJson(res, 500, { error: "Internal server error" });
    });
  });

  server.listen(port, () => {
    logger.info("Dashboard listening", { port, url: `http://localhost:${port}` });
  });

  process.on("SIGTERM", () => server.close());
  process.on("SIGINT", () => server.close());
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  getPolicies: () => PolicyConfig
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost`);
  const path = url.pathname;

  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // API routes
  if (path.startsWith("/api/")) {
    const body = await readBody(req);
    await handleApiRequest(req, res, url, body, getPolicies);
    return;
  }

  // Dashboard HTML — serve for root and any non-API route
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(getDashboardHtml());
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === "GET" || req.method === "HEAD") return null;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  data: unknown
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
