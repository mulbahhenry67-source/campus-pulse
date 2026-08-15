import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { pool } from "./db/pool";
import { attachWebSocketServer } from "./ws/socket.server";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Campus Pulse API listening on port ${env.PORT} [${env.NODE_ENV}]`);
});

attachWebSocketServer(server);
logger.info(`WebSocket server attached at ws://localhost:${env.PORT}/ws`);

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await pool.end();
    logger.info("Shutdown complete.");
    process.exit(0);
  });
  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
