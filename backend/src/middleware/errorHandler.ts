import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { logger } from "../utils/logger";
import { env } from "../config/env";

/** A known, deliberately-thrown application error with a safe public message. */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "NOT_FOUND", `Route not found: ${req.method} ${req.path}`));
}

/**
 * Central error handler. Known AppErrors are returned as-is (safe messages).
 * Anything unexpected is logged with a request ID and returned as a generic
 * 500 — the client never sees stack traces, SQL errors, or internal details.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = randomUUID();

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error({ err, requestId, path: req.path }, "Application error");
    }
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details, requestId },
    });
  }

  logger.error({ err, requestId, path: req.path }, "Unhandled error");

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our end. Please try again.",
      requestId,
      ...(env.NODE_ENV !== "production" && err instanceof Error ? { debug: err.message } : {}),
    },
  });
}
