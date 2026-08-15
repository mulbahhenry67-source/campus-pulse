import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { api, setAccessToken, bootstrapSession, ApiError } from "../lib/api";
import { PublicUser } from "../lib/types";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { firstName: string; lastName: string; email: string; password: string; dateOfBirth: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const me = await api.get<{ id: string; role: string }>("/api/auth/me");
      // /me only returns id/role; the rest of the user object is what we already
      // have from login/register. If we don't have it yet (fresh page load),
      // synthesize a minimal user so the UI can render — profile page fills in the rest.
      setUser((prev) => prev ?? { id: me.id, role: me.role } as PublicUser);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const restored = await bootstrapSession();
      if (restored) await loadMe();
      setLoading(false);
    })();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: PublicUser; accessToken: string }>("/api/auth/login", { email, password });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const register = useCallback(
    async (input: { firstName: string; lastName: string; email: string; password: string; dateOfBirth: string }) => {
      const res = await api.post<{ user: PublicUser; accessToken: string }>("/api/auth/register", input);
      setAccessToken(res.accessToken);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
