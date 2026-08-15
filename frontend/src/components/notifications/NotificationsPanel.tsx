import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Heart, Star, MessageCircle, CalendarCheck, CalendarClock } from "lucide-react";
import { api } from "../../lib/api";
import { AppNotification } from "../../lib/types";
import { useSocket } from "../../context/SocketContext";

const ICONS: Record<string, typeof Heart> = {
  new_match: Heart,
  new_like: Heart,
  super_like: Star,
  new_message: MessageCircle,
  date_invitation: CalendarClock,
  date_confirmation: CalendarCheck,
};

function describe(n: AppNotification): string {
  switch (n.type) {
    case "new_match":
      return "You have a new match!";
    case "new_like":
      return "Someone liked your profile";
    case "super_like":
      return "Someone super liked you!";
    case "new_message":
      return "You have a new message";
    case "date_invitation":
      return "You have a new date invitation";
    case "date_confirmation":
      return "Your date plan was confirmed";
    default:
      return "New notification";
  }
}

function targetPath(n: AppNotification): string {
  const matchId = (n.payload as { matchId?: string }).matchId;
  if (n.type === "new_message" || n.type === "date_invitation" || n.type === "date_confirmation") {
    return matchId ? `/chat/${matchId}` : "/chat";
  }
  if (n.type === "new_match" || n.type === "new_like" || n.type === "super_like") return "/matches";
  return "/discover";
}

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { subscribe } = useSocket();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ items: AppNotification[]; unreadCount: number }>("/api/notifications");
    setItems(res.items);
    setUnreadCount(res.unreadCount);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh the bell whenever anything match/message/date related happens live.
  useEffect(() => {
    return subscribe((event) => {
      if (["message:new", "presence"].includes(event.type)) return; // avoid over-fetching on high-frequency events
      load();
    });
  }, [subscribe, load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAllRead() {
    await api.post("/api/notifications/read-all");
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  async function handleClick(n: AppNotification) {
    if (!n.read_at) {
      await api.post(`/api/notifications/${n.id}/read`);
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    navigate(targetPath(n));
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-full hover:bg-pulse-50 dark:hover:bg-pulse-800"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell size={20} className="text-pulse-700 dark:text-pulse-200" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-ember-500 text-white text-[10px] font-bold rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-pulse-900 rounded-xl2 shadow-pop border border-pulse-100 dark:border-pulse-800 z-50">
          <div className="flex items-center justify-between p-3 border-b border-pulse-100 dark:border-pulse-800">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-pulse-400 hover:text-pulse-700">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 && <p className="text-sm text-pulse-300 text-center py-8">You're all caught up</p>}
          <ul>
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-pulse-50 dark:hover:bg-pulse-800 ${
                      !n.read_at ? "bg-ember-100/30" : ""
                    }`}
                  >
                    <Icon size={16} className="text-ember-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm">{describe(n)}</p>
                      <p className="text-[11px] text-pulse-300">{new Date(n.created_at).toLocaleString()}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
