import { useCallback, useEffect, useState } from "react";
import { X, CalendarClock } from "lucide-react";
import { api } from "../../lib/api";
import { DatePlan, DATE_ACTIVITIES } from "../../lib/types";
import { Button } from "../ui/primitives";
import { useAuth } from "../../context/AuthContext";

const ACTIVITY_LABELS: Record<(typeof DATE_ACTIVITIES)[number], string> = {
  coffee: "Coffee",
  restaurant: "Restaurant",
  walk: "Walk",
  study_session: "Study session",
  gaming: "Gaming",
  sports: "Sports",
  movie: "Movie",
  campus_event: "Campus event",
  other: "Something else",
};

export function DatePlannerModal({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<DatePlan[]>([]);
  const [activity, setActivity] = useState<(typeof DATE_ACTIVITIES)[number]>("coffee");
  const [customActivity, setCustomActivity] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<{ items: DatePlan[] }>(`/api/matches/${matchId}/date-plans`);
    setPlans(res.items);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  async function propose() {
    if (!date || !time) return;
    setSubmitting(true);
    try {
      await api.post(`/api/matches/${matchId}/date-plans`, {
        activity,
        customActivity: activity === "other" ? customActivity : undefined,
        proposedDate: date,
        proposedTime: time,
        locationNote: location || undefined,
      });
      setDate("");
      setTime("");
      setLocation("");
      setCustomActivity("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function respond(planId: string, action: "confirm" | "decline" | "cancel") {
    await api.post(`/api/date-plans/${planId}/${action}`);
    load();
  }

  return (
    <div className="fixed inset-0 bg-midnight/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-pulse-900 rounded-t-xl2 sm:rounded-xl2 w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <CalendarClock size={20} className="text-ember-500" /> Plan a date
          </h2>
          <button onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {plans.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            {plans.map((p) => (
              <div key={p.id} className="border border-pulse-100 dark:border-pulse-700 rounded-xl p-3">
                <p className="font-semibold text-sm capitalize">
                  {p.activity === "other" ? p.custom_activity : ACTIVITY_LABELS[p.activity]}
                </p>
                <p className="text-xs text-pulse-400">
                  {new Date(`${p.proposed_date}T${p.proposed_time}`).toLocaleString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                {p.location_note && <p className="text-xs text-pulse-400">{p.location_note}</p>}
                <p className="text-[11px] mt-1 font-mono uppercase text-pulse-300">{p.status}</p>

                {p.status === "proposed" && p.proposed_by !== user?.id && (
                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => respond(p.id, "confirm")} className="!py-1 !px-3 text-xs">
                      Confirm
                    </Button>
                    <Button variant="ghost" onClick={() => respond(p.id, "decline")} className="!py-1 !px-3 text-xs">
                      Decline
                    </Button>
                  </div>
                )}
                {p.status === "confirmed" && (
                  <Button variant="danger" onClick={() => respond(p.id, "cancel")} className="!py-1 !px-3 text-xs mt-2">
                    Cancel plan
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs font-mono uppercase text-pulse-300 mb-2">Propose a new date</p>
        <div className="flex flex-col gap-3">
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as typeof activity)}
            className="rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-3 py-2 text-sm"
          >
            {DATE_ACTIVITIES.map((a) => (
              <option key={a} value={a}>
                {ACTIVITY_LABELS[a]}
              </option>
            ))}
          </select>
          {activity === "other" && (
            <input
              value={customActivity}
              onChange={(e) => setCustomActivity(e.target.value)}
              placeholder="What did you have in mind?"
              className="rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-3 py-2 text-sm"
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-3 py-2 text-sm"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-3 py-2 text-sm"
            />
          </div>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="General meeting spot (e.g. campus center)"
            maxLength={300}
            className="rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-pulse-300">For your safety, share a general public spot — not your exact address.</p>
          <Button onClick={propose} disabled={submitting || !date || !time}>
            {submitting ? "Sending…" : "Propose"}
          </Button>
        </div>
      </div>
    </div>
  );
}
