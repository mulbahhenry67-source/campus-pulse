import { useEffect, useRef, useCallback, useState } from "react";
import { getAccessToken } from "./api";

export type WsEvent =
  | { type: "presence"; userId: string; status: "online" | "offline" }
  | { type: "typing" | "stop_typing"; matchId: string; userId: string }
  | { type: "message:new"; matchId: string; message: unknown }
  | { type: "message:deleted"; matchId: string; messageId: string }
  | { type: "message:reaction"; matchId: string; messageId: string; userId: string; emoji: string }
  | { type: "message:read"; matchId: string; userId: string }
  | { type: "pong" };

type Listener = (event: WsEvent) => void;

/**
 * Maintains one shared WebSocket connection for the whole app (reconnecting
 * with backoff if it drops) and lets components subscribe to events. Kept
 * as a hook rather than a bare singleton so it naturally reconnects when the
 * access token changes (e.g. right after login).
 */
export function useCampusPulseSocket(enabled: boolean) {
  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Set<Listener>>(new Set());
  const [connected, setConnected] = useState(false);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token || !enabled) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${token}`);
    socketRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
    };

    socket.onmessage = (raw) => {
      try {
        const event = JSON.parse(raw.data) as WsEvent;
        listenersRef.current.forEach((listener) => listener(event));
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = () => {
      setConnected(false);
      if (!enabled) return;
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 15000);
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };
  }, [enabled]);

  useEffect(() => {
    if (enabled) connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const send = useCallback((event: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(event));
    }
  }, []);

  return { connected, subscribe, send };
}
