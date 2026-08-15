import { NavLink } from "react-router-dom";
import { ConversationSummary } from "../../lib/types";
import { Avatar } from "../ui/primitives";

export function ConversationList({ conversations, activeMatchId }: { conversations: ConversationSummary[]; activeMatchId?: string }) {
  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center text-pulse-400 text-sm">
        No conversations yet. Matches show up here once you start chatting.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-pulse-100 dark:divide-pulse-800">
      {conversations.map((c) => (
        <li key={c.match_id}>
          <NavLink
            to={`/chat/${c.match_id}`}
            className={`flex items-center gap-3 px-4 py-3 hover:bg-pulse-50 dark:hover:bg-pulse-800 transition-colors ${
              activeMatchId === c.match_id ? "bg-pulse-50 dark:bg-pulse-800" : ""
            }`}
          >
            <Avatar url={c.photo_url} name={c.first_name} online={c.online} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-sm truncate">{c.first_name}</span>
                {c.last_message && (
                  <span className="text-[10px] text-pulse-300 font-mono shrink-0">
                    {new Date(c.last_message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <p className="text-xs text-pulse-400 truncate">
                {c.last_message ? c.last_message.content ?? "📷 Photo" : "Say hello 👋"}
              </p>
            </div>
            {c.unread_count > 0 && (
              <span className="bg-ember-500 text-white text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1.5">
                {c.unread_count}
              </span>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
