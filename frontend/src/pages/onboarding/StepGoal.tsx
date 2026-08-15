import { useState } from "react";
import { OnboardingLayout } from "./OnboardingLayout";
import { api } from "../../lib/api";
import { RELATIONSHIP_GOALS } from "../../lib/types";

const LABELS: Record<(typeof RELATIONSHIP_GOALS)[number], { title: string; desc: string }> = {
  serious: { title: "A serious relationship", desc: "Looking for something long-term" },
  casual: { title: "Casual dating", desc: "Open to seeing where things go" },
  friendship: { title: "Friendship", desc: "New people, no pressure" },
  new_connections: { title: "New connections", desc: "Not sure exactly what, just meeting people" },
  not_sure: { title: "Still figuring it out", desc: "Open to whatever feels right" },
};

export function StepGoal() {
  const [goal, setGoal] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch("/api/profiles/me", { relationshipGoal: goal || undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout step="goal" title="What are you looking for?" subtitle="You can change this anytime." onNext={save} saving={saving} nextDisabled={!goal}>
      <div className="flex flex-col gap-2.5">
        {RELATIONSHIP_GOALS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGoal(g)}
            className={`text-left px-4 py-3 rounded-xl border transition-colors ${
              goal === g ? "border-ember-500 bg-ember-100" : "border-pulse-100 dark:border-pulse-700"
            }`}
          >
            <p className="font-semibold text-sm">{LABELS[g].title}</p>
            <p className="text-xs text-pulse-400">{LABELS[g].desc}</p>
          </button>
        ))}
      </div>
    </OnboardingLayout>
  );
}
