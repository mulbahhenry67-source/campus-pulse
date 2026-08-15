import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function RequireRole({ roles }: { roles: string[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/discover" replace />;
  return <Outlet />;
}
