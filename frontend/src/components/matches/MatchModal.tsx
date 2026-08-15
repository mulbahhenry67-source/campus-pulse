import { useNavigate } from "react-router-dom";
import { Button } from "../ui/primitives";
import { DiscoverResult } from "../../lib/types";

export function MatchModal({ person, onClose }: { person: DiscoverResult; onClose: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-midnight/70 backdrop-blur-sm z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-pulse-900 rounded-xl2 shadow-pop max-w-sm w-full p-8 text-center animate-[pop_0.3s_ease]">
        <p className="font-display italic text-ember-500 text-lg mb-1">It's a match!</p>
        <h2 className="font-display text-3xl font-semibold mb-4">You and {person.firstName}</h2>

        <div className="flex justify-center -space-x-4 mb-6">
          <div className="w-20 h-20 rounded-full border-4 border-white dark:border-pulse-900 bg-pulse-100 overflow-hidden">
            {person.photoUrl && <img src={person.photoUrl} alt={person.firstName} className="w-full h-full object-cover" />}
          </div>
        </div>

        <p className="text-sm text-pulse-400 mb-6">
          {person.compatibility.score}% compatible — {person.compatibility.factors[0] ?? "you both signed up for Campus Pulse!"}
        </p>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              onClose();
              navigate("/chat");
            }}
          >
            Start chatting
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Keep browsing
          </Button>
        </div>
      </div>
    </div>
  );
}
