import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-pulse-400">Loading Campus Pulse…</div>;
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
