import type { ScanResult, ScanFlag } from "../types.js";

interface ScanPattern {
  id: string;
  type: ScanFlag["type"];
  severity: ScanFlag["severity"];
  description: string;
  test: (value: string) => boolean;
}

const BUILT_IN_PATTERNS: ScanPattern[] = [
  // Prompt injection
  {
    id: "pi-ignore-instructions",
    type: "prompt_injection",
    severity: "high",
    description: "Ignore instructions pattern",
    test: (v) =>
      /ignore\s+(previous|all|above)\s+instructions?/i.test(v) ||
      /forget\s+everything/i.test(v),
  },
  {
    id: "pi-system-prompt-override",
    type: "prompt_injection",
    severity: "critical",
    description: "System prompt override attempt",
    test: (v) =>
      /<system>|<\/system>|\[system\]/i.test(v) ||
      /\bsystem\s+prompt\b.*\boverride\b/i.test(v),
  },
  {
    id: "pi-jailbreak",
    type: "prompt_injection",
    severity: "high",
    description: "Common jailbreak patterns",
    test: (v) =>
      /\bDAN\b/.test(v) ||
      /do\s+anything\s+now/i.test(v) ||
      /jailbreak/i.test(v),
  },
  // Data exfiltration
  {
    id: "de-base64-blob",
    type: "data_exfiltration",
    severity: "medium",
    description: "Large base64 encoded blob",
    test: (v) => {
      const base64Regex = /[A-Za-z0-9+/]{100,}={0,2}/;
      return base64Regex.test(v);
    },
  },
  {
    id: "de-suspicious-url",
    type: "data_exfiltration",
    severity: "medium",
    description: "Suspicious outbound URL in params",
    test: (v) =>
      /https?:\/\/[^\s"']+\?[^\s"']*(?:data|payload|content|secret)=/i.test(v),
  },
  // Privilege escalation
  {
    id: "pe-path-traversal",
    type: "privilege_escalation",
    severity: "high",
    description: "Path traversal attempt",
    test: (v) => /\.\.[/\\]/.test(v) || /%2e%2e[%2f%5c]/i.test(v),
  },
  {
    id: "pe-sensitive-paths",
    type: "privilege_escalation",
    severity: "critical",
    description: "Access to sensitive system paths",
    test: (v) =>
      /\/etc\/(passwd|shadow|sudoers)/i.test(v) ||
      /\/proc\/\d+/i.test(v) ||
      /c:\\windows\\system32/i.test(v),
  },
];

export class SecurityScanner {
  private patterns: ScanPattern[] = [...BUILT_IN_PATTERNS];

  scan(params: unknown): ScanResult {
    const flags: ScanFlag[] = [];
    this.scanValue(params, flags);
    return { flagged: flags.length > 0, flags };
  }

  private scanValue(value: unknown, flags: ScanFlag[]): void {
    if (value === null || value === undefined) return;

    if (typeof value === "string") {
      this.scanString(value, flags);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.scanValue(item, flags);
      }
      return;
    }

    if (typeof value === "object") {
      for (const v of Object.values(value as Record<string, unknown>)) {
        this.scanValue(v, flags);
      }
    }
  }

  private scanString(value: string, flags: ScanFlag[]): void {
    for (const pattern of this.patterns) {
      if (pattern.test(value)) {
        // Avoid duplicate flags for the same pattern
        if (!flags.some((f) => f.ruleId === pattern.id)) {
          flags.push({
            type: pattern.type,
            severity: pattern.severity,
            detail: pattern.description,
            ruleId: pattern.id,
          });
        }
      }
    }
  }
}
