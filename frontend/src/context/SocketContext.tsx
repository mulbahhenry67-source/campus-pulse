import { createContext, useContext, ReactNode } from "react";
import { useCampusPulseSocket, WsEvent } from "../lib/useSocket";
import { useAuth } from "./AuthContext";

interface SocketContextValue {
  connected: boolean;
  subscribe: (listener: (event: WsEvent) => void) => () => void;
  send: (event: Record<string, unknown>) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socket = useCampusPulseSocket(!!user);
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
