import pino from "pino";
import { isProd } from "../config/env";

export const logger = pino({
  level: isProd ? "info" : "debug",
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
