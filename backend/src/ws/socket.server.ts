import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer } from "http";
import { URL } from "url";
import { verifyAccessToken } from "../utils/tokens";
import { connectionHub } from "./hub";
import { pool } from "../db/pool";
import { profileRepository } from "../modules/profiles/profile.repository";
import { logger } from "../utils/logger";

interface ClientMessage {
  type: "typing" | "stop_typing" | "ping";
  matchId?: string;
}

async function getMatchPartnerIds(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ other_id: string }>(
    `SELECT CASE WHEN user_low_id = $1 THEN user_high_id ELSE user_low_id END AS other_id
     FROM matches WHERE (user_low_id = $1 OR user_high_id = $1) AND unmatched_at IS NULL`,
    [userId],
  );
  return rows.map((r) => r.other_id);
}

/** Confirms the two users actually share an active match, so typing events can't be spoofed cross-match. */
async function isActiveParticipant(userId: string, matchId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM matches WHERE id = $1 AND (user_low_id = $2 OR user_high_id = $2) AND unmatched_at IS NULL`,
    [matchId, userId],
  );
  return rows.length > 0;
}

async function getOtherParticipant(matchId: string, userId: string): Promise<string | null> {
  const { rows } = await pool.query<{ other_id: string }>(
    `SELECT CASE WHEN user_low_id = $2 THEN user_high_id ELSE user_low_id END AS other_id
     FROM matches WHERE id = $1 AND (user_low_id = $2 OR user_high_id = $2) AND unmatched_at IS NULL`,
    [matchId, userId],
  );
  return rows[0]?.other_id ?? null;
}

export function attachWebSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (socket: WebSocket, request) => {
    let userId: string;
    try {
      const url = new URL(request.url ?? "", "http://internal");
      const token = url.searchParams.get("token");
      if (!token) throw new Error("missing token");
      const payload = verifyAccessToken(token);
      userId = payload.sub;
    } catch {
      socket.close(4401, "Unauthorized");
      return;
    }

    const wasOffline = connectionHub.register(userId, socket);
    logger.info({ userId }, "WebSocket connected");

    if (wasOffline) {
      const partners = await getMatchPartnerIds(userId);
      connectionHub.pushToUsers(partners, { type: "presence", userId, status: "online" });
    }

    socket.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return; // ignore malformed frames rather than crashing the connection
      }

      if (msg.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if ((msg.type === "typing" || msg.type === "stop_typing") && msg.matchId) {
        const participant = await isActiveParticipant(userId, msg.matchId);
        if (!participant) return;
        const otherId = await getOtherParticipant(msg.matchId, userId);
        if (otherId) {
          connectionHub.pushToUser(otherId, { type: msg.type, matchId: msg.matchId, userId });
        }
      }
    });

    socket.on("close", async () => {
      const wentOffline = connectionHub.unregister(userId, socket);
      logger.info({ userId }, "WebSocket disconnected");
      if (wentOffline) {
        await profileRepository.touchLastActive(userId).catch(() => undefined);
        const partners = await getMatchPartnerIds(userId);
        connectionHub.pushToUsers(partners, { type: "presence", userId, status: "offline" });
      }
    });

    socket.on("error", (err) => {
      logger.warn({ err, userId }, "WebSocket error");
    });
  });

  return wss;
}
