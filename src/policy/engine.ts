import micromatch from "micromatch";
import type {
  PolicyConfig,
  PolicyRole,
  PolicyRule,
  JsonRpcRequest,
} from "../types.js";

export interface PolicyDecision {
  decision: "allow" | "deny";
  matchedRule: string | null;
  reason: string;
}

export function evaluatePolicy(
  request: JsonRpcRequest,
  callerRole: string,
  policy: PolicyConfig
): PolicyDecision {
  const role = policy.roles[callerRole] ?? policy.roles[policy.defaultRole];
  if (!role) {
    return {
      decision: "deny",
      matchedRule: "no-role",
      reason: `No role found for: ${callerRole}`,
    };
  }

  return evaluateRole(request, role, callerRole);
}

function evaluateRole(
  request: JsonRpcRequest,
  role: PolicyRole,
  roleName: string
): PolicyDecision {
  const method = request.method;
  const toolName = extractToolName(request);

  for (let i = 0; i < role.rules.length; i++) {
    const rule = role.rules[i];
    if (!rule) continue;
    const ruleId = `${roleName}:rule[${i}]`;
    const match = matchesRule(rule, method, toolName);
    if (match === "allow") {
      return { decision: "allow", matchedRule: ruleId, reason: "Explicit allow" };
    }
    if (match === "deny") {
      return { decision: "deny", matchedRule: ruleId, reason: "Explicit deny" };
    }
  }

  // Deny-by-default
  return {
    decision: "deny",
    matchedRule: "default-deny",
    reason: "No matching allow rule (deny-by-default)",
  };
}

function matchesRule(
  rule: PolicyRule,
  method: string,
  toolName: string | null
): "allow" | "deny" | null {
  // Check deny first (deny takes precedence when explicitly matched)
  if (rule.deny !== undefined) {
    const patterns = Array.isArray(rule.deny) ? rule.deny : [rule.deny];
    if (matchesMethodAndTool(patterns, method, toolName, rule.tools)) {
      return "deny";
    }
  }

  if (rule.allow !== undefined) {
    const patterns = Array.isArray(rule.allow) ? rule.allow : [rule.allow];
    if (matchesMethodAndTool(patterns, method, toolName, rule.tools)) {
      return "allow";
    }
  }

  return null;
}

function matchesMethodAndTool(
  patterns: string[],
  method: string,
  toolName: string | null,
  toolGlobs?: string[]
): boolean {
  const methodMatches = patterns.some(
    (p) => p === "*" || micromatch.isMatch(method, p)
  );
  if (!methodMatches) return false;

  // If tools filter is present, tool name must match
  if (toolGlobs && toolGlobs.length > 0) {
    if (!toolName) return false;
    return toolGlobs.some((g) => micromatch.isMatch(toolName, g));
  }

  return true;
}

function extractToolName(request: JsonRpcRequest): string | null {
  if (request.method === "tools/call") {
    const params = request.params as { name?: string } | undefined;
    return params?.name ?? null;
  }
  return null;
}
