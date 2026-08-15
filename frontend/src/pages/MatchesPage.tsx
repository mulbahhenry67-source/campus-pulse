import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { MatchSummary } from "../lib/types";
import { Avatar, Card } from "../components/ui/primitives";

export function MatchesPage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<{ items: MatchSummary[] }>("/api/matches")
      .then((res) => setMatches(res.items))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 md:pt-10">
      <h1 className="font-display text-3xl font-semibold text-pulse-800 dark:text-paper mb-6">Your matches</h1>

      {loading && <p className="text-pulse-400">Loading…</p>}

      {!loading && matches.length === 0 && (
        <Card className="p-8 text-center">
          <p className="font-display text-xl mb-2">No matches yet</p>
          <p className="text-pulse-400 text-sm">Keep exploring Discover — your next match is out there.</p>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {matches.map((m) => (
          <button
            key={m.id}
            onClick={() => navigate(`/chat/${m.id}`)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl2 bg-white dark:bg-pulse-900 shadow-card hover:shadow-pop transition-shadow text-center"
          >
            <Avatar url={m.photo_url} name={m.first_name} size={72} />
            <span className="font-semibold text-sm">{m.first_name}</span>
            <span className="text-[11px] text-pulse-300">{new Date(m.matched_at).toLocaleDateString()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
