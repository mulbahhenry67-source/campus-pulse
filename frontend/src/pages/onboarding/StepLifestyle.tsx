import { useState } from "react";
import { OnboardingLayout } from "./OnboardingLayout";
import { api } from "../../lib/api";

const QUESTIONS: { key: string; label: string; options: string[] }[] = [
  { key: "smoking", label: "Smoking", options: ["never", "sometimes", "regularly"] },
  { key: "drinking", label: "Drinking", options: ["never", "socially", "often"] },
  { key: "exercise", label: "Exercise", options: ["rarely", "sometimes", "often"] },
  { key: "sleep_schedule", label: "Sleep schedule", options: ["early_bird", "flexible", "night_owl"] },
];

function formatLabel(v: string) {
  return v.replace("_", " ");
}

export function StepLifestyle() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch("/api/profiles/me", { lifestyle: values });
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout step="lifestyle" title="Lifestyle" subtitle="No wrong answers — this just helps with better matches." onNext={save} saving={saving}>
      <div className="flex flex-col gap-5">
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <p className="text-sm font-semibold mb-2">{q.label}</p>
            <div className="flex gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, [q.key]: opt }))}
                  className={`flex-1 capitalize px-3 py-2 rounded-xl text-sm font-semibold border ${
                    values[q.key] === opt ? "bg-pulse-500 text-white border-pulse-500" : "border-pulse-100 dark:border-pulse-700"
                  }`}
                >
                  {formatLabel(opt)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </OnboardingLayout>
  );
}
