import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadConfig } from "./config/loader.js";
import { PolicyLoader } from "./policy/loader.js";
import { initDatabase } from "./audit/db.js";
import { StdioProxy } from "./proxy/stdio.js";
import { HttpProxy, createHttpHandler } from "./proxy/http.js";
import { logger, setLogLevel } from "./utils/logger.js";
import { createServer } from "http";
import type { SentinelConfig, PolicyConfig } from "./types.js";

async function start(configPath?: string): Promise<void> {
  const config = loadConfig(configPath);
  setLogLevel(config.logLevel);

  logger.info("MCP Sentinel starting", {
    version: "0.1.0",
    port: config.port,
    servers: config.servers.length,
  });

  // Initialize database
  initDatabase(config.audit.database);

  // Load policies
  const policyLoader = new PolicyLoader(config.security.rules);
  let policies: PolicyConfig = policyLoader.load();

  policyLoader.enableHotReload((updated) => {
    policies = updated;
    logger.info("Policies hot-reloaded");
  });

  const getPolicies = (): PolicyConfig => policies;

  // Start server for each MCP server config
  for (const serverConfig of config.servers) {
    if (serverConfig.transport === "stdio") {
      const proxy = new StdioProxy(serverConfig, config, getPolicies);
      proxy.start();

      process.on("SIGTERM", () => proxy.stop());
      process.on("SIGINT", () => proxy.stop());
    } else if (serverConfig.transport === "http") {
      const proxy = new HttpProxy(serverConfig, config, getPolicies);
      const handler = createHttpHandler(proxy, config);
      const server = createServer((req, res) => {
        handler(req, res).catch((err) => {
          logger.error("Request handler error", err);
          res.writeHead(500).end();
        });
      });

      server.listen(config.port, () => {
        logger.info("HTTP proxy listening", {
          port: config.port,
          server: serverConfig.name,
        });
      });

      process.on("SIGTERM", () => server.close());
      process.on("SIGINT", () => server.close());
    }
  }

  if (config.servers.length === 0) {
    logger.warn("No servers configured — nothing to proxy");
  }
}

yargs(hideBin(process.argv))
  .command(
    "start",
    "Start MCP Sentinel proxy",
    (y) =>
      y.option("config", {
        alias: "c",
        type: "string",
        description: "Path to sentinel.yaml config file",
      }),
    async (argv) => {
      try {
        await start(argv.config);
      } catch (err) {
        logger.error("Fatal error", err);
        process.exit(1);
      }
    }
  )
  .command(
    "stdio <server>",
    "Run a single stdio server proxy",
    (y) =>
      y
        .positional("server", {
          type: "string",
          description: "Server name from config",
          demandOption: true,
        })
        .option("config", {
          alias: "c",
          type: "string",
          description: "Path to sentinel.yaml config file",
        }),
    async (argv) => {
      try {
        const config = loadConfig(argv.config);
        setLogLevel(config.logLevel);

        const serverConfig = config.servers.find(
          (s) => s.name === argv.server
        );
        if (!serverConfig) {
          logger.error(`Server '${argv.server}' not found in config`);
          process.exit(1);
        }

        initDatabase(config.audit.database);

        const policyLoader = new PolicyLoader(config.security.rules);
        let policies: PolicyConfig = policyLoader.load();
        policyLoader.enableHotReload((updated) => { policies = updated; });

        const proxy = new StdioProxy(serverConfig, config, () => policies);
        proxy.start();
      } catch (err) {
        logger.error("Fatal error", err);
        process.exit(1);
      }
    }
  )
  .demandCommand(1, "Specify a command")
  .strict()
  .parse();
