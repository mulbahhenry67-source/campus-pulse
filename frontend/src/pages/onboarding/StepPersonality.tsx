import { useState } from "react";
import { OnboardingLayout } from "./OnboardingLayout";
import { api } from "../../lib/api";

const TRAITS: { key: string; label: string; low: string; high: string }[] = [
  { key: "openness", label: "Openness", low: "Prefers routine", high: "Loves new experiences" },
  { key: "conscientiousness", label: "Organization", low: "Spontaneous", high: "Plans everything" },
  { key: "extraversion", label: "Social energy", low: "Recharges alone", high: "Energized by people" },
  { key: "agreeableness", label: "Warmth", low: "Direct & blunt", high: "Warm & accommodating" },
  { key: "neuroticism", label: "Even keel", low: "Easygoing", high: "Feels things intensely" },
];

export function StepPersonality() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(TRAITS.map((t) => [t.key, 50])),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch("/api/profiles/me", { personality: values });
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout
      step="personality"
      title="A bit about your personality"
      subtitle="This helps us find people who genuinely click with you."
      onNext={save}
      saving={saving}
    >
      <div className="flex flex-col gap-6">
        {TRAITS.map((t) => (
          <div key={t.key}>
            <div className="flex justify-between mb-1.5">
              <span className="text-sm font-semibold">{t.label}</span>
              <span className="font-mono text-xs text-pulse-400">{values[t.key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={values[t.key]}
              onChange={(e) => setValues((v) => ({ ...v, [t.key]: Number(e.target.value) }))}
              className="w-full accent-ember-500"
              aria-label={t.label}
            />
            <div className="flex justify-between text-[11px] text-pulse-300 mt-1">
              <span>{t.low}</span>
              <span>{t.high}</span>
            </div>
          </div>
        ))}
      </div>
    </OnboardingLayout>
  );
}
