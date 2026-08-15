import { useCallback, useEffect, useRef, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Heart, CalendarClock } from "lucide-react";
import { api } from "../lib/api";
import { ConversationSummary, Message } from "../lib/types";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { ConversationList } from "../components/chat/ConversationList";
import { MessageBubble } from "../components/chat/MessageBubble";
import { DatePlannerModal } from "../components/chat/DatePlannerModal";
import { Avatar } from "../components/ui/primitives";

export function ChatPage() {
  const { matchId } = useParams<{ matchId?: string }>();
  const { user } = useAuth();
  const { subscribe, send } = useSocket();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [showDatePlanner, setShowDatePlanner] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.match_id === matchId);

  const loadConversations = useCallback(async () => {
    const res = await api.get<{ items: ConversationSummary[] }>("/api/conversations");
    setConversations(res.items);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!matchId) return;
    setOtherTyping(false);
    api.get<{ items: Message[] }>(`/api/conversations/${matchId}/messages`).then((res) => setMessages(res.items));
    api.post(`/api/conversations/${matchId}/read`).then(loadConversations);
  }, [matchId, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Live updates over the shared WebSocket connection.
  useEffect(() => {
    return subscribe((event) => {
      if (event.type === "message:new" && event.matchId === matchId) {
        setMessages((prev) => [...prev, event.message as Message]);
        api.post(`/api/conversations/${matchId}/read`);
      }
      if (event.type === "message:new") {
        loadConversations();
      }
      if (event.type === "typing" && event.matchId === matchId) {
        setOtherTyping(true);
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setOtherTyping(false), 3000);
      }
      if (event.type === "stop_typing" && event.matchId === matchId) {
        setOtherTyping(false);
      }
      if (event.type === "message:reaction" && event.matchId === matchId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === event.messageId ? { ...m, reactions: [...m.reactions.filter((r) => r.userId !== event.userId), { emoji: event.emoji, userId: event.userId }] } : m)),
        );
      }
      if (event.type === "presence") {
        loadConversations();
      }
    });
  }, [subscribe, matchId, loadConversations]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !matchId) return;
    const content = draft.trim();
    setDraft("");
    const res = await api.post<{ message: Message }>(`/api/conversations/${matchId}/messages`, { content });
    setMessages((prev) => [...prev, res.message]);
    loadConversations();
  }

  function handleTyping() {
    if (!matchId) return;
    send({ type: "typing", matchId });
  }

  async function react(messageId: string) {
    await api.put(`/api/messages/${messageId}/reactions`, { emoji: "❤️" });
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, reactions: [...m.reactions.filter((r) => r.userId !== user?.id), { emoji: "❤️", userId: user!.id }] } : m)),
    );
  }

  const showList = !matchId; // on mobile, list and thread are mutually exclusive views

  return (
    <div className="h-screen md:h-auto flex">
      <aside className={`w-full md:w-80 md:border-r border-pulse-100 dark:border-pulse-800 ${showList ? "block" : "hidden md:block"}`}>
        <div className="p-4 border-b border-pulse-100 dark:border-pulse-800">
          <h1 className="font-display text-2xl font-semibold">Messages</h1>
        </div>
        <ConversationList conversations={conversations} activeMatchId={matchId} />
      </aside>

      {matchId && (
        <section className="flex-1 flex flex-col h-screen md:h-[calc(100vh-1px)]">
          <header className="flex items-center gap-3 p-4 border-b border-pulse-100 dark:border-pulse-800 bg-white dark:bg-midnight sticky top-0 z-10">
            <button className="md:hidden" onClick={() => navigate("/chat")} aria-label="Back to conversations">
              <ArrowLeft size={20} />
            </button>
            {activeConversation && (
              <>
                <Avatar url={activeConversation.photo_url} name={activeConversation.first_name} size={36} online={activeConversation.online} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">{activeConversation.first_name}</p>
                  <p className="text-[11px] text-pulse-300">
                    {otherTyping ? "Typing…" : activeConversation.online ? "Online" : "Offline"}
                  </p>
                </div>
                <button
                  onClick={() => setShowDatePlanner(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-ember-500 border border-ember-300 rounded-full px-3 py-1.5 hover:bg-ember-100"
                >
                  <CalendarClock size={14} /> Plan a date
                </button>
              </>
            )}
          </header>

          {showDatePlanner && <DatePlannerModal matchId={matchId} onClose={() => setShowDatePlanner(false)} />}

          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((m) => (
              <div key={m.id} className="group relative">
                <MessageBubble message={m} isMine={m.sender_id === user?.id} />
                {!m.deleted_at && (
                  <button
                    onClick={() => react(m.id)}
                    className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                      m.sender_id === user?.id ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2"
                    }`}
                    aria-label="React with heart"
                  >
                    <Heart size={14} className="text-pulse-300 hover:text-ember-500" />
                  </button>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 p-4 border-t border-pulse-100 dark:border-pulse-800">
            <input
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                handleTyping();
              }}
              placeholder="Message..."
              className="flex-1 rounded-full border border-pulse-100 dark:border-pulse-700 bg-pulse-50 dark:bg-pulse-800 px-4 py-2.5 text-sm"
              aria-label="Type a message"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="w-10 h-10 rounded-full bg-ember-500 text-white flex items-center justify-center disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
