import { readFileSync, existsSync, watch, readdirSync } from "fs";
import { resolve, dirname, extname } from "path";
import yaml from "js-yaml";
import type { PolicyConfig } from "../types.js";
import { logger } from "../utils/logger.js";

const DEFAULT_POLICY: PolicyConfig = {
  roles: {
    admin: {
      description: "Full access",
      rules: [{ allow: "*" }],
    },
    analyst: {
      description: "Read-only",
      rules: [
        { allow: "resources/read" },
        { allow: "tools/call", tools: ["query_*", "search_*", "get_*"] },
        { deny: "*" },
      ],
    },
  },
  defaultRole: "analyst",
};

export class PolicyLoader {
  private policies: PolicyConfig = DEFAULT_POLICY;
  private watchers: ReturnType<typeof watch>[] = [];

  constructor(private policyGlob: string) {}

  load(): PolicyConfig {
    const files = this.resolveFiles();
    if (files.length === 0) {
      logger.warn("No policy files found, using default policy", {
        glob: this.policyGlob,
      });
      return DEFAULT_POLICY;
    }

    const merged = this.mergeFiles(files);
    this.policies = merged;
    logger.info("Policies loaded", { files: files.length, roles: Object.keys(merged.roles) });
    return merged;
  }

  enableHotReload(onChange: (policies: PolicyConfig) => void): void {
    const files = this.resolveFiles();
    for (const file of files) {
      try {
        const watcher = watch(file, () => {
          logger.info("Policy file changed, reloading", { file });
          const updated = this.load();
          onChange(updated);
        });
        this.watchers.push(watcher);
      } catch {
        logger.warn("Could not watch policy file", { file });
      }
    }

    // Also watch the directory for new files
    const dirs = [...new Set(files.map((f) => dirname(f)))];
    for (const dir of dirs) {
      try {
        const watcher = watch(dir, () => {
          const updated = this.load();
          onChange(updated);
        });
        this.watchers.push(watcher);
      } catch {
        // ignore
      }
    }
  }

  stop(): void {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
  }

  getCurrent(): PolicyConfig {
    return this.policies;
  }

  private resolveFiles(): string[] {
    const p = resolve(this.policyGlob);

    // Direct file path
    if (!this.policyGlob.includes("*")) {
      return existsSync(p) ? [p] : [];
    }

    // Glob: find all .yaml/.yml files in the directory portion
    const dirPart = dirname(p);
    if (!existsSync(dirPart)) return [];

    try {
      return readdirSync(dirPart)
        .filter((f) => extname(f) === ".yaml" || extname(f) === ".yml")
        .map((f) => resolve(dirPart, f));
    } catch {
      return [];
    }
  }

  private mergeFiles(files: string[]): PolicyConfig {
    const merged: PolicyConfig = {
      roles: {},
      defaultRole: "analyst",
    };

    for (const file of files) {
      try {
        const raw = readFileSync(file, "utf-8");
        const parsed = yaml.load(raw) as Partial<PolicyConfig>;
        if (parsed.roles) {
          Object.assign(merged.roles, parsed.roles);
        }
        if (parsed.defaultRole) {
          merged.defaultRole = parsed.defaultRole;
        }
      } catch (err) {
        logger.error("Failed to parse policy file", { file, err });
      }
    }

    return merged;
  }
}
