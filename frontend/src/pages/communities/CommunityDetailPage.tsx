import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, MessageSquare, Users } from "lucide-react";
import { api } from "../../lib/api";
import { Community, CommunityPost, PostComment } from "../../lib/types";
import { Button, Card } from "../../components/ui/primitives";

export function CommunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [draft, setDraft] = useState("");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [communityRes, postsRes] = await Promise.all([
      api.get<{ community: Community }>(`/api/communities/${id}`),
      api.get<{ items: CommunityPost[] }>(`/api/communities/${id}/posts`),
    ]);
    setCommunity(communityRes.community);
    setPosts(postsRes.items);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleMembership() {
    if (!community) return;
    if (community.joined) {
      await api.post(`/api/communities/${community.id}/leave`);
    } else {
      await api.post(`/api/communities/${community.id}/join`);
    }
    load();
  }

  async function submitPost() {
    if (!draft.trim() || !community) return;
    await api.post(`/api/communities/${community.id}/posts`, { content: draft.trim() });
    setDraft("");
    load();
  }

  async function toggleLike(postId: string) {
    await api.post(`/api/community-posts/${postId}/like`);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) } : p)),
    );
  }

  if (!community) return <div className="p-8 text-pulse-400">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 md:pt-10 pb-10">
      <button onClick={() => navigate("/communities")} className="flex items-center gap-1.5 text-sm text-pulse-400 mb-4">
        <ArrowLeft size={16} /> Communities
      </button>

      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="font-display text-2xl font-semibold">{community.name}</h1>
          <Button variant={community.joined ? "ghost" : "primary"} onClick={toggleMembership} className="!py-1.5 !px-4 text-xs shrink-0">
            {community.joined ? "Leave" : "Join"}
          </Button>
        </div>
        <p className="text-sm text-pulse-400 mb-3">{community.description}</p>
        <p className="flex items-center gap-1.5 text-xs text-pulse-300 mb-3">
          <Users size={13} /> {community.member_count} members
        </p>
        {community.rules && (
          <details className="text-xs text-pulse-400">
            <summary className="cursor-pointer font-semibold text-pulse-500">Community rules</summary>
            <p className="mt-2">{community.rules}</p>
          </details>
        )}
      </Card>

      {community.joined ? (
        <Card className="p-4 mb-6">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Share something with ${community.name}…`}
            className="w-full rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-3 py-2 text-sm mb-2"
            rows={2}
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button onClick={submitPost} disabled={!draft.trim()} className="!py-1.5 !px-4 text-xs">
              Post
            </Button>
          </div>
        </Card>
      ) : (
        <p className="text-sm text-pulse-300 text-center mb-6">Join {community.name} to post and comment.</p>
      )}

      <div className="flex flex-col gap-4">
        {posts.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="font-semibold text-sm">{p.author_name}</span>
              <span className="text-[11px] text-pulse-300 font-mono">{new Date(p.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm mb-3 whitespace-pre-wrap">{p.content}</p>
            <div className="flex items-center gap-4">
              <button onClick={() => toggleLike(p.id)} className={`flex items-center gap-1.5 text-xs ${p.liked_by_me ? "text-ember-500" : "text-pulse-400"}`}>
                <Heart size={14} fill={p.liked_by_me ? "currentColor" : "none"} /> {p.like_count}
              </button>
              <button
                onClick={() => setExpandedPost(expandedPost === p.id ? null : p.id)}
                className="flex items-center gap-1.5 text-xs text-pulse-400"
              >
                <MessageSquare size={14} /> {p.comment_count}
              </button>
            </div>
            {expandedPost === p.id && <PostComments postId={p.id} canComment={community.joined} onCommentAdded={load} />}
          </Card>
        ))}
        {posts.length === 0 && <p className="text-sm text-pulse-300 text-center py-10">No posts yet — be the first to share something.</p>}
      </div>
    </div>
  );
}

function PostComments({ postId, canComment, onCommentAdded }: { postId: string; canComment: boolean; onCommentAdded: () => void }) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    const res = await api.get<{ items: PostComment[] }>(`/api/community-posts/${postId}/comments`);
    setComments(res.items);
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!draft.trim()) return;
    await api.post(`/api/community-posts/${postId}/comments`, { content: draft.trim() });
    setDraft("");
    load();
    onCommentAdded();
  }

  return (
    <div className="mt-4 pt-4 border-t border-pulse-100 dark:border-pulse-800 flex flex-col gap-3">
      {comments.map((c) => (
        <div key={c.id} className="text-sm">
          <span className="font-semibold">{c.author_name}</span> <span className="text-pulse-600 dark:text-pulse-200">{c.content}</span>
        </div>
      ))}
      {canComment && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded-full border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-3 py-1.5 text-xs"
          />
          <Button onClick={submit} disabled={!draft.trim()} className="!py-1 !px-3 text-xs">
            Send
          </Button>
        </div>
      )}
    </div>
  );
}
