import { redactParams, extractToolInfo } from "../audit/logger.js";
import type { JsonRpcRequest } from "../types.js";

describe("Audit Logger", () => {
  describe("redactParams", () => {
    const redactFields = ["password", "token", "secret"];

    it("redacts exact field names", () => {
      const result = redactParams({ password: "hunter2", user: "alice" }, redactFields);
      expect(result).toEqual({ password: "[REDACTED]", user: "alice" });
    });

    it("redacts partial field name matches", () => {
      const result = redactParams({ api_token: "abc123" }, redactFields);
      expect(result).toEqual({ api_token: "[REDACTED]" });
    });

    it("redacts nested fields", () => {
      const result = redactParams(
        { credentials: { password: "hunter2", username: "alice" } },
        redactFields
      );
      expect((result as Record<string, unknown>)["credentials"]).toEqual({
        password: "[REDACTED]",
        username: "alice",
      });
    });

    it("handles arrays", () => {
      const result = redactParams(
        [{ token: "abc" }, { user: "bob" }],
        redactFields
      );
      expect(result).toEqual([{ token: "[REDACTED]" }, { user: "bob" }]);
    });

    it("passes through null", () => {
      expect(redactParams(null, redactFields)).toBeNull();
    });

    it("passes through primitives", () => {
      expect(redactParams("hello", redactFields)).toBe("hello");
      expect(redactParams(42, redactFields)).toBe(42);
    });

    it("does not modify non-sensitive fields", () => {
      const result = redactParams({ query: "SELECT *", limit: 100 }, redactFields);
      expect(result).toEqual({ query: "SELECT *", limit: 100 });
    });
  });

  describe("extractToolInfo", () => {
    it("extracts tool name from tools/call", () => {
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_user", arguments: {} },
      };
      const result = extractToolInfo(request);
      expect(result).toEqual({ toolName: "get_user", resourceUri: null });
    });

    it("extracts resource URI from resources/read", () => {
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "file:///home/user/doc.txt" },
      };
      const result = extractToolInfo(request);
      expect(result).toEqual({ toolName: null, resourceUri: "file:///home/user/doc.txt" });
    });

    it("returns nulls for other methods", () => {
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      };
      const result = extractToolInfo(request);
      expect(result).toEqual({ toolName: null, resourceUri: null });
    });

    it("handles missing params gracefully", () => {
      const request: JsonRpcRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
      };
      const result = extractToolInfo(request);
      expect(result).toEqual({ toolName: null, resourceUri: null });
    });
  });
});
