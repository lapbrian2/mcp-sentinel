import { interpolateEnvVars } from "../config/loader.js";

describe("Config Loader", () => {
  describe("interpolateEnvVars", () => {
    beforeEach(() => {
      process.env["TEST_TOKEN"] = "my-token-value";
      process.env["TEST_HOST"] = "localhost";
    });

    afterEach(() => {
      delete process.env["TEST_TOKEN"];
      delete process.env["TEST_HOST"];
    });

    it("interpolates env vars", () => {
      const result = interpolateEnvVars("${TEST_TOKEN}");
      expect(result).toBe("my-token-value");
    });

    it("interpolates multiple vars", () => {
      const result = interpolateEnvVars("http://${TEST_HOST}:8080");
      expect(result).toBe("http://localhost:8080");
    });

    it("returns empty string for missing vars", () => {
      const result = interpolateEnvVars("${NONEXISTENT_VAR}");
      expect(result).toBe("");
    });

    it("passes through strings without vars", () => {
      const result = interpolateEnvVars("plain-string");
      expect(result).toBe("plain-string");
    });
  });
});
