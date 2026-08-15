import { NavLink, Outlet } from "react-router-dom";
import { Heart, MessageCircle, Sparkles, User, Users, ShieldAlert, LucideIcon } from "lucide-react";
import { NotificationsPanel } from "../notifications/NotificationsPanel";
import { useAuth } from "../../context/AuthContext";

const NAV_ITEMS = [
  { to: "/discover", label: "Discover", icon: Sparkles },
  { to: "/matches", label: "Matches", icon: Heart },
  { to: "/chat", label: "Messages", icon: MessageCircle },
  { to: "/communities", label: "Communities", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell() {
  const { user } = useAuth();
  const isStaff = user && ["moderator", "admin", "super_admin"].includes(user.role);
  const navItems = isStaff ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: ShieldAlert }] : NAV_ITEMS;

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop side nav */}
      <nav className="hidden md:flex flex-col w-64 border-r border-pulse-100 dark:border-pulse-800 p-6 gap-1">
        <div className="font-display text-2xl font-semibold text-pulse-600 mb-8">Campus Pulse</div>
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <main className="flex-1 pb-20 md:pb-0 min-h-screen">
        <div className="flex justify-end px-4 pt-4 md:px-8 md:pt-6">
          <NotificationsPanel />
        </div>
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-pulse-900 border-t border-pulse-100 dark:border-pulse-800 flex justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] z-40">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[3rem] ${
                isActive ? "text-ember-500" : "text-pulse-300"
              }`
            }
          >
            <item.icon size={20} />
            <span className="text-[9px] font-semibold">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
          isActive ? "bg-pulse-50 dark:bg-pulse-800 text-pulse-700 dark:text-pulse-100" : "text-pulse-400 hover:bg-pulse-50 dark:hover:bg-pulse-800"
        }`
      }
    >
      <Icon size={20} />
      {label}
    </NavLink>
  );
}
