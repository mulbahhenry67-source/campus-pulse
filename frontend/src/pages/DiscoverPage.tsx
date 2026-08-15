import { useCallback, useEffect, useState } from "react";
import { X, Heart, Star, MapPin, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { DiscoverResult } from "../lib/types";
import { Button, Card, Badge } from "../components/ui/primitives";
import { CompatibilityRing } from "../components/ui/CompatibilityRing";
import { MatchModal } from "../components/matches/MatchModal";

export function DiscoverPage() {
  const [results, setResults] = useState<DiscoverResult[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchedWith, setMatchedWith] = useState<DiscoverResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ results: DiscoverResult[] }>("/api/discover?limit=20");
      setResults(res.results);
      setIndex(0);
    } catch {
      setError("We couldn't load new profiles. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = results[index];

  async function act(action: "like" | "pass" | "superlike") {
    if (!current) return;
    try {
      if (action === "pass") {
        await api.post("/api/likes/pass", { userId: current.userId });
      } else {
        const res = await api.post<{ matched: boolean }>("/api/likes", {
          userId: current.userId,
          isSuperLike: action === "superlike",
        });
        if (res.matched) setMatchedWith(current);
      }
    } finally {
      setIndex((i) => i + 1);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-6 md:pt-10">
      <h1 className="font-display text-3xl font-semibold text-pulse-800 dark:text-paper mb-1">Discover</h1>
      <p className="text-pulse-400 text-sm mb-6">Don't just match faces. Match lives.</p>

      {loading && <div className="text-center py-20 text-pulse-400">Finding people for you…</div>}

      {error && (
        <Card className="p-6 text-center">
          <p className="text-ember-700 mb-4">{error}</p>
          <Button onClick={load}>Retry</Button>
        </Card>
      )}

      {!loading && !error && !current && (
        <Card className="p-8 text-center">
          <p className="font-display text-xl mb-2">You're all caught up</p>
          <p className="text-pulse-400 text-sm mb-5">Check back later, or widen your filters in Settings to see more people.</p>
          <Button onClick={load}>Refresh</Button>
        </Card>
      )}

      {!loading && current && (
        <Card className="overflow-hidden">
          <div className="relative h-96 bg-pulse-100">
            {current.photoUrl ? (
              <img src={current.photoUrl} alt={current.firstName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-display text-6xl text-pulse-300">
                {current.firstName.charAt(0)}
              </div>
            )}
            <div className="absolute top-3 right-3">
              <CompatibilityRing score={current.compatibility.score} />
            </div>
            {current.verified && (
              <div className="absolute top-3 left-3">
                <Badge tone="meadow">
                  <ShieldCheck size={12} /> Verified
                </Badge>
              </div>
            )}
          </div>

          <div className="p-5">
            <div className="flex items-baseline gap-2 mb-1">
              <h2 className="font-display text-2xl font-semibold">{current.firstName}</h2>
              <span className="text-pulse-400">{current.age}</span>
            </div>
            {current.distanceKm != null && (
              <p className="flex items-center gap-1 text-sm text-pulse-400 mb-3">
                <MapPin size={14} /> {current.distanceKm} km away
              </p>
            )}
            {current.bio && <p className="text-sm text-midnight/80 dark:text-paper/80 mb-4">{current.bio}</p>}

            {current.compatibility.factors.length > 0 && (
              <div className="flex flex-col gap-1.5 mb-2">
                {current.compatibility.factors.slice(0, 3).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-pulse-700 dark:text-pulse-200 bg-pulse-50 dark:bg-pulse-800 rounded-lg px-3 py-2">
                    <Heart size={12} className="text-ember-500 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-pulse-300 italic mt-2">{current.compatibility.note}</p>
          </div>

          <div className="flex items-center justify-center gap-4 p-5 pt-0">
            <button
              aria-label="Pass"
              onClick={() => act("pass")}
              className="w-14 h-14 rounded-full border-2 border-pulse-100 dark:border-pulse-700 flex items-center justify-center text-pulse-400 hover:border-ember-500 hover:text-ember-500 transition-colors"
            >
              <X size={26} />
            </button>
            <button
              aria-label="Super like"
              onClick={() => act("superlike")}
              className="w-12 h-12 rounded-full border-2 border-sunbeam-500 flex items-center justify-center text-sunbeam-700 hover:bg-sunbeam-300/30 transition-colors"
            >
              <Star size={20} />
            </button>
            <button
              aria-label="Like"
              onClick={() => act("like")}
              className="w-14 h-14 rounded-full bg-ember-500 flex items-center justify-center text-white hover:bg-ember-700 transition-colors shadow-pop"
            >
              <Heart size={26} fill="white" />
            </button>
          </div>
        </Card>
      )}

      {matchedWith && <MatchModal person={matchedWith} onClose={() => setMatchedWith(null)} />}
    </div>
  );
}
