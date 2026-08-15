import express, { Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "./utils/logger";
import { env } from "./config/env";
import { corsMiddleware, securityHeaders, generalRateLimiter } from "./middleware/security";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { profileRouter } from "./modules/profiles/profile.routes";
import { discoveryRouter } from "./modules/discovery/discovery.controller";
import { likesRouter } from "./modules/likes/likes.routes";
import { matchesRouter } from "./modules/matches/matches.routes";
import { availabilityRouter } from "./modules/availability/availability.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { conversationsRouter, messagesRouter } from "./modules/messages/messages.routes";
import { communitiesRouter, communityPostsRouter } from "./modules/communities/communities.routes";
import { datePlansRouter, datePlanActionsRouter } from "./modules/dates/dates.routes";
import { verificationRouter } from "./modules/verification/verification.routes";
import { adminRouter } from "./modules/admin/admin.routes";

export function createApp(): Express {
  const app = express();

  // Trust the first proxy hop (needed for correct req.ip / rate limiting behind
  // a load balancer in production — adjust if deployed behind more hops).
  app.set("trust proxy", 1);

  // Force HTTPS in production. Relies on the upstream proxy/load balancer setting
  // X-Forwarded-Proto (see DEPLOYMENT.md — this app never terminates TLS itself).
  // Skipped outside production so local dev and tests aren't broken by it.
  if (env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      if (req.secure || req.headers["x-forwarded-proto"] === "https") return next();
      res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
    });
  }

  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));
  app.use(generalRateLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

  app.use("/api/auth", authRouter);
  app.use("/api/profiles", profileRouter);
  app.use("/api/discover", discoveryRouter);
  app.use("/api/likes", likesRouter);
  app.use("/api/matches", matchesRouter);
  app.use("/api/availability", availabilityRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/communities", communitiesRouter);
  app.use("/api/community-posts", communityPostsRouter);
  app.use("/api/matches/:matchId/date-plans", datePlansRouter);
  app.use("/api/date-plans", datePlanActionsRouter);
  app.use("/api/verification", verificationRouter);
  app.use("/api/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
