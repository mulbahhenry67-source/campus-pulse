import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users } from "lucide-react";
import { api } from "../../lib/api";
import { Community } from "../../lib/types";
import { Card, Badge } from "../../components/ui/primitives";

export function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      api
        .get<{ items: Community[] }>(`/api/communities${search ? `?q=${encodeURIComponent(search)}` : ""}`)
        .then((res) => setCommunities(res.items))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 md:pt-10 pb-10">
      <h1 className="font-display text-3xl font-semibold text-pulse-800 dark:text-paper mb-1">Communities</h1>
      <p className="text-pulse-400 text-sm mb-6">Find your people beyond the swipe.</p>

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pulse-300" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search communities…"
          className="w-full rounded-full border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 pl-10 pr-4 py-2.5 text-sm"
        />
      </div>

      {loading && <p className="text-pulse-400 text-sm">Loading…</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {communities.map((c) => (
          <button key={c.id} onClick={() => navigate(`/communities/${c.id}`)} className="text-left">
            <Card className="p-5 h-full hover:shadow-pop transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-lg font-semibold">{c.name}</h2>
                {c.joined && <Badge tone="meadow">Joined</Badge>}
              </div>
              <p className="text-sm text-pulse-400 mb-3 line-clamp-2">{c.description}</p>
              <p className="flex items-center gap-1.5 text-xs text-pulse-300">
                <Users size={13} /> {c.member_count} member{c.member_count === 1 ? "" : "s"}
              </p>
            </Card>
          </button>
        ))}
      </div>

      {!loading && communities.length === 0 && <p className="text-pulse-400 text-sm text-center py-10">No communities found.</p>}
    </div>
  );
}
