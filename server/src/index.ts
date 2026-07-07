import http from "http";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { createApp } from "./app";
import { initSocketServer } from "./sockets";
import { dispatchScheduledMessages } from "./modules/messages/messages.service";

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  initSocketServer(server);

  // Flush scheduled messages every 15 seconds.
  const scheduler = setInterval(() => {
    dispatchScheduledMessages().catch((err) => logger.error({ err }, "scheduled dispatch failed"));
  }, 15_000);

  server.listen(env.PORT, () => {
    logger.info(`🚀 PhantomChat API listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    clearInterval(scheduler);
    server.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal boot error");
  process.exit(1);
});
