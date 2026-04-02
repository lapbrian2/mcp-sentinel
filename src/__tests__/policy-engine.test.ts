import { evaluatePolicy } from "../policy/engine.js";
import type { PolicyConfig, JsonRpcRequest } from "../types.js";

const adminPolicy: PolicyConfig = {
  roles: {
    admin: {
      description: "Full access",
      rules: [{ allow: "*" }],
    },
    readonly: {
      description: "Read only",
      rules: [
        { allow: "resources/read" },
        { allow: "tools/call", tools: ["get_*", "list_*"] },
        { deny: "*" },
      ],
    },
    blocked: {
      description: "No access",
      rules: [{ deny: "*" }],
    },
  },
  defaultRole: "readonly",
};

function makeRequest(method: string, toolName?: string): JsonRpcRequest {
  if (toolName) {
    return {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: { name: toolName },
    };
  }
  return { jsonrpc: "2.0", id: 1, method };
}

describe("Policy Engine", () => {
  describe("admin role", () => {
    it("allows any method", () => {
      const result = evaluatePolicy(makeRequest("tools/call", "exec_command"), "admin", adminPolicy);
      expect(result.decision).toBe("allow");
    });

    it("allows resources/read", () => {
      const result = evaluatePolicy(makeRequest("resources/read"), "admin", adminPolicy);
      expect(result.decision).toBe("allow");
    });
  });

  describe("readonly role", () => {
    it("allows resources/read", () => {
      const result = evaluatePolicy(makeRequest("resources/read"), "readonly", adminPolicy);
      expect(result.decision).toBe("allow");
    });

    it("allows get_* tools", () => {
      const result = evaluatePolicy(makeRequest("tools/call", "get_users"), "readonly", adminPolicy);
      expect(result.decision).toBe("allow");
    });

    it("allows list_* tools", () => {
      const result = evaluatePolicy(makeRequest("tools/call", "list_files"), "readonly", adminPolicy);
      expect(result.decision).toBe("allow");
    });

    it("denies exec tools", () => {
      const result = evaluatePolicy(makeRequest("tools/call", "exec_command"), "readonly", adminPolicy);
      expect(result.decision).toBe("deny");
    });

    it("denies write tools", () => {
      const result = evaluatePolicy(makeRequest("tools/call", "write_file"), "readonly", adminPolicy);
      expect(result.decision).toBe("deny");
    });

    it("denies unknown methods", () => {
      const result = evaluatePolicy(makeRequest("prompts/list"), "readonly", adminPolicy);
      expect(result.decision).toBe("deny");
    });
  });

  describe("blocked role", () => {
    it("denies everything", () => {
      const result = evaluatePolicy(makeRequest("resources/read"), "blocked", adminPolicy);
      expect(result.decision).toBe("deny");
    });
  });

  describe("unknown role", () => {
    it("falls back to defaultRole", () => {
      const result = evaluatePolicy(makeRequest("resources/read"), "nonexistent", adminPolicy);
      // defaultRole is readonly which allows resources/read
      expect(result.decision).toBe("allow");
    });
  });

  describe("deny-by-default", () => {
    it("denies when no role matches", () => {
      const policy: PolicyConfig = {
        roles: {},
        defaultRole: "none",
      };
      const result = evaluatePolicy(makeRequest("tools/call", "anything"), "unknown", policy);
      expect(result.decision).toBe("deny");
      expect(result.matchedRule).toBe("no-role");
    });
  });

  describe("matched rule reporting", () => {
    it("returns matched rule ID on allow", () => {
      const result = evaluatePolicy(makeRequest("resources/read"), "readonly", adminPolicy);
      expect(result.matchedRule).toMatch(/^readonly:rule\[\d+\]$/);
    });

    it("returns matched rule ID on deny", () => {
      const result = evaluatePolicy(makeRequest("tools/call", "exec"), "readonly", adminPolicy);
      expect(result.matchedRule).toMatch(/^readonly:rule\[\d+\]$/);
    });
  });
});
