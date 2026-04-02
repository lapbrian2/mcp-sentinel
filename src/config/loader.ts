import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import yaml from "js-yaml";
import type { SentinelConfig } from "../types.js";

const DEFAULT_CONFIG: SentinelConfig = {
  port: 4100,
  dashboardPort: 4200,
  logLevel: "info",
  servers: [],
  audit: {
    database: "./data/sentinel.db",
    retention: "90d",
    redactFields: ["password", "token", "secret", "key"],
  },
  security: {
    rules: "./rules/*.yaml",
    defaultAction: "log",
  },
  auth: {
    type: "api-key",
    headerName: "Authorization",
  },
};

export function loadConfig(configPath?: string): SentinelConfig {
  const paths = configPath
    ? [configPath]
    : [
        "./sentinel.yaml",
        "./sentinel.yml",
        "./config/sentinel.yaml",
      ];

  for (const p of paths) {
    const resolved = resolve(p);
    if (existsSync(resolved)) {
      const raw = readFileSync(resolved, "utf-8");
      const parsed = yaml.load(raw) as Partial<SentinelConfig>;
      return mergeConfig(DEFAULT_CONFIG, parsed);
    }
  }

  return DEFAULT_CONFIG;
}

function mergeConfig(
  defaults: SentinelConfig,
  overrides: Partial<SentinelConfig>
): SentinelConfig {
  return {
    ...defaults,
    ...overrides,
    audit: { ...defaults.audit, ...overrides.audit },
    security: { ...defaults.security, ...overrides.security },
    auth: { ...defaults.auth, ...overrides.auth },
    port: overrides.port ?? defaults.port,
    dashboardPort: overrides.dashboardPort ?? defaults.dashboardPort,
  };
}

export function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
    return process.env[key] ?? "";
  });
}
