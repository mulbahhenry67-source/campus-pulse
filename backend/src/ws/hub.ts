import { WebSocket } from "ws";
import { logger } from "../utils/logger";

/**
 * In-process registry of live WebSocket connections, keyed by user id. A user
 * can have multiple connections (multiple devices/tabs) — we fan out to all
 * of them. This is intentionally in-memory and per-process: fine for a
 * single API instance. Running more than one instance behind a load balancer
 * requires swapping this for a shared pub/sub (Redis) so a push reaches a
 * user connected to a different instance — noted here for the deployment
 * phase, not needed to make this phase functionally correct.
 */
class ConnectionHub {
  private connections = new Map<string, Set<WebSocket>>();

  register(userId: string, socket: WebSocket) {
    const set = this.connections.get(userId) ?? new Set();
    set.add(socket);
    this.connections.set(userId, set);
    const wasOffline = set.size === 1;
    return wasOffline;
  }

  /** Returns true if this was the user's last open connection (i.e. they just went offline). */
  unregister(userId: string, socket: WebSocket): boolean {
    const set = this.connections.get(userId);
    if (!set) return true;
    set.delete(socket);
    if (set.size === 0) {
      this.connections.delete(userId);
      return true;
    }
    return false;
  }

  isOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  /** Sends a JSON event to every live connection a user has open. No-op if they're offline. */
  pushToUser(userId: string, event: Record<string, unknown>) {
    const set = this.connections.get(userId);
    if (!set) return;
    const payload = JSON.stringify(event);
    for (const socket of set) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }

  pushToUsers(userIds: string[], event: Record<string, unknown>) {
    for (const id of userIds) this.pushToUser(id, event);
  }
}

export const connectionHub = new ConnectionHub();

export function logHubStats() {
  logger.debug({ onlineUsers: connectionHub["connections"].size }, "WebSocket hub stats");
}
