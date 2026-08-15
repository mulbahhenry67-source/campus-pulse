import { Message } from "../../lib/types";

export function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  if (message.deleted_at) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"} mb-2`}>
        <div className="text-xs italic text-pulse-300 px-4 py-2">Message deleted</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col mb-2 ${isMine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
          isMine ? "bg-ember-500 text-white rounded-br-md" : "bg-pulse-50 dark:bg-pulse-800 text-midnight dark:text-paper rounded-bl-md"
        }`}
      >
        {message.image_url && (
          <img src={message.image_url} alt="Shared" className="rounded-lg mb-1 max-h-64 object-cover" />
        )}
        {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {message.reactions.length > 0 && (
          <span className="text-xs bg-white dark:bg-pulse-900 border border-pulse-100 dark:border-pulse-700 rounded-full px-2 py-0.5">
            {message.reactions.map((r) => r.emoji).join(" ")}
          </span>
        )}
        <span className="text-[10px] text-pulse-300 font-mono">
          {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
