import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/tokens";
import { AppError } from "./errorHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}

/** Requires a valid access token. Attaches req.user. Never trusts client-supplied identity. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "UNAUTHENTICATED", "Authentication required."));
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(401, "INVALID_TOKEN", "Invalid or expired access token."));
  }
}

/** Restricts a route to specific roles. Must run after `authenticate`. */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError(403, "FORBIDDEN", "You don't have permission to do that."));
    }
    next();
  };
}
