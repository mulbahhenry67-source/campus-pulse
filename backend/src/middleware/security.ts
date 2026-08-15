import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow non-browser tools (no Origin header) and configured origins only.
    if (!origin || env.corsAllowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
});

export const securityHeaders = helmet({
  contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
  crossOriginResourcePolicy: { policy: "same-site" },
});

/** Strict limiter for auth endpoints — the main brute-force defense. */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." } },
});

/** Looser limiter for general API traffic. */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
