import { useState } from "react";
import { OnboardingLayout } from "./OnboardingLayout";
import { api } from "../../lib/api";

export function StepDistance() {
  const [maxDistanceKm, setMaxDistanceKm] = useState(25);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(30);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch("/api/profiles/me", {
        maxDistanceKm,
        minAgePreference: minAge,
        maxAgePreference: maxAge,
        discoverable: true,
      });
      await api.post("/api/profiles/me/complete-onboarding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout
      step="distance"
      title="Almost there"
      subtitle="Set how far and what ages you'd like to see."
      onNext={save}
      nextLabel="Finish and start exploring"
      saving={saving}
    >
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-sm font-semibold">Maximum distance</span>
            <span className="font-mono text-xs text-pulse-400">{maxDistanceKm} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={200}
            value={maxDistanceKm}
            onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
            className="w-full accent-ember-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Min age</label>
            <input
              type="number"
              min={18}
              max={maxAge}
              value={minAge}
              onChange={(e) => setMinAge(Number(e.target.value))}
              className="w-full rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Max age</label>
            <input
              type="number"
              min={minAge}
              max={99}
              value={maxAge}
              onChange={(e) => setMaxAge(Number(e.target.value))}
              className="w-full rounded-xl border border-pulse-100 dark:border-pulse-700 bg-white dark:bg-pulse-900 px-4 py-2.5 text-sm"
            />
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
