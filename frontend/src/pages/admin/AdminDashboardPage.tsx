import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Users, Flag, BadgeCheck } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { AdminOverview, AdminUserRow, AdminReportRow, AdminVerificationRow } from "../../lib/types";
import { Card, Badge, Button } from "../../components/ui/primitives";

type Tab = "overview" | "users" | "reports" | "verification";

export function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const { user } = useAuth();
  const canModerate = user?.role === "admin" || user?.role === "super_admin";

  const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "overview", label: "Overview", icon: ShieldAlert },
    { key: "users", label: "Users", icon: Users },
    { key: "reports", label: "Reports", icon: Flag },
    { key: "verification", label: "Verification", icon: BadgeCheck },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 md:pt-10 pb-10">
      <h1 className="font-display text-3xl font-semibold text-pulse-800 dark:text-paper mb-1">Admin</h1>
      <p className="text-pulse-400 text-sm mb-6">Signed in as {user?.role?.replace("_", " ")}</p>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
              tab === t.key ? "bg-pulse-500 text-white" : "bg-white dark:bg-pulse-900 text-pulse-600 dark:text-pulse-200 border border-pulse-100 dark:border-pulse-700"
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <UsersTab canModerate={canModerate} />}
      {tab === "reports" && <ReportsTab />}
      {tab === "verification" && <VerificationTab />}
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<AdminOverview | null>(null);

  useEffect(() => {
    api.get<AdminOverview>("/api/admin/overview").then(setStats);
  }, []);

  if (!stats) return <p className="text-pulse-400 text-sm">Loading…</p>;

  const cards: { label: string; value: number; tone?: "ember" | "sunbeam" }[] = [
    { label: "Total users", value: stats.totalUsers },
    { label: "Active users", value: stats.activeUsers },
    { label: "New today", value: stats.newUsersToday },
    { label: "Verified users", value: stats.verifiedUsers },
    { label: "Active matches", value: stats.totalMatches },
    { label: "Messages sent", value: stats.totalMessages },
    { label: "Pending reports", value: stats.pendingReports, tone: "ember" },
    { label: "Suspended users", value: stats.suspendedUsers, tone: "sunbeam" },
    { label: "Deleted accounts", value: stats.deletedAccounts },
    { label: "Community posts", value: stats.communityPosts },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-4">
          <p className={`font-mono text-2xl font-bold ${c.tone === "ember" ? "text-ember-500" : c.tone === "sunbeam" ? "text-sunbeam-700" : ""}`}>
            {c.value}
          </p>
          <p className="text-xs text-pulse-400 mt-1">{c.label}</p>
        </Card>
      ))}
    </div>
  );
}

function UsersTab({ canModerate }: { canModerate: boolean }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.get<{ items: AdminUserRow[] }>(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`);
    setUsers(res.items);
  }, [search]);

  useEffect(() => {
    const handle = setTimeout(load, 250);
    return () => clearTimeout(handle);
  }, [load]);

  async function suspend(id: string) {
    const reason = window.prompt("Reason for suspension (visible in the audit log):");
    if (!reason) return;
    setActioning(id);
    try {
      await api.post(`/api/admin/users/${id}/suspend`, { reason });
      load();
    } finally {
      setActioning(null);
    }
  }

  async function restore(id: string) {
    setActioning(id);
    try {
      await api.post(`/api/admin/users/${id}/restore`);
      load();
    } finally {
      setActioning(null);
    }
  }

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full rounded-full border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-4 py-2.5 text-sm mb-4"
      />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-pulse-50 dark:bg-pulse-800 text-left text-xs text-pulse-400">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Role</th>
              {canModerate && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-pulse-100 dark:border-pulse-800">
                <td className="px-4 py-2.5">
                  {u.first_name} {u.last_name}
                </td>
                <td className="px-4 py-2.5 text-pulse-400">{u.email}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={u.status === "active" ? "meadow" : u.status === "suspended" ? "sunbeam" : "ember"}>{u.status}</Badge>
                </td>
                <td className="px-4 py-2.5 capitalize text-pulse-400">{u.role.replace("_", " ")}</td>
                {canModerate && (
                  <td className="px-4 py-2.5 text-right">
                    {u.status === "active" ? (
                      <Button variant="danger" onClick={() => suspend(u.id)} disabled={actioning === u.id} className="!py-1 !px-3 text-xs">
                        Suspend
                      </Button>
                    ) : u.status === "suspended" ? (
                      <Button variant="ghost" onClick={() => restore(u.id)} disabled={actioning === u.id} className="!py-1 !px-3 text-xs">
                        Restore
                      </Button>
                    ) : null}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <p className="text-center text-sm text-pulse-300 py-8">No users found.</p>}
      </Card>
    </div>
  );
}

function ReportsTab() {
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");

  const load = useCallback(async () => {
    const res = await api.get<{ items: AdminReportRow[] }>(`/api/admin/reports?status=${statusFilter}`);
    setReports(res.items);
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(id: string, status: "resolved" | "rejected") {
    const moderatorNotes = window.prompt("Add a note about this decision (optional):") ?? undefined;
    await api.post(`/api/admin/reports/${id}/review`, { status, moderatorNotes });
    load();
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {["pending", "under_review", "resolved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${
              statusFilter === s ? "bg-pulse-500 text-white" : "bg-white dark:bg-pulse-900 border border-pulse-100 dark:border-pulse-700"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {reports.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <Badge tone="ember">{r.target_type.replace("_", " ")}</Badge>
              <span className="text-[11px] text-pulse-300 font-mono">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm font-semibold capitalize mt-2">{r.reason.replace("_", " ")}</p>
            {r.description && <p className="text-sm text-pulse-400 mt-1">{r.description}</p>}
            <p className="text-xs text-pulse-300 mt-2">
              Reported by {r.reporter_name} ({r.reporter_email})
            </p>
            {r.moderator_notes && <p className="text-xs text-pulse-400 mt-1 italic">Note: {r.moderator_notes}</p>}
            {r.status === "pending" && (
              <div className="flex gap-2 mt-3">
                <Button onClick={() => review(r.id, "resolved")} className="!py-1 !px-3 text-xs">
                  Resolve
                </Button>
                <Button variant="ghost" onClick={() => review(r.id, "rejected")} className="!py-1 !px-3 text-xs">
                  Dismiss
                </Button>
              </div>
            )}
          </Card>
        ))}
        {reports.length === 0 && <p className="text-center text-sm text-pulse-300 py-8">No reports in this category.</p>}
      </div>
    </div>
  );
}

function VerificationTab() {
  const [requests, setRequests] = useState<AdminVerificationRow[]>([]);

  const load = useCallback(async () => {
    const res = await api.get<{ items: AdminVerificationRow[] }>("/api/admin/verification-requests?status=pending");
    setRequests(res.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, approve: boolean) {
    await api.post(`/api/admin/verification-requests/${id}/${approve ? "approve" : "reject"}`, {});
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-sm">
              {r.first_name} {r.last_name} <span className="text-pulse-300 font-normal">— {r.email}</span>
            </p>
            <Badge>{r.method === "school_email" ? "School email" : "Student ID"}</Badge>
          </div>
          {r.method === "school_email" ? (
            <p className="text-sm text-pulse-400">Claimed school email: {r.school_email}</p>
          ) : (
            <a href={r.student_id_image_url ?? "#"} target="_blank" rel="noreferrer" className="text-sm text-pulse-500 underline">
              View submitted student ID
            </a>
          )}
          <div className="flex gap-2 mt-3">
            <Button onClick={() => decide(r.id, true)} className="!py-1 !px-3 text-xs">
              Approve
            </Button>
            <Button variant="ghost" onClick={() => decide(r.id, false)} className="!py-1 !px-3 text-xs">
              Reject
            </Button>
          </div>
        </Card>
      ))}
      {requests.length === 0 && <p className="text-center text-sm text-pulse-300 py-8">No pending verification requests.</p>}
    </div>
  );
}
