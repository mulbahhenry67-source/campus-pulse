import { useEffect, useState } from "react";
import { OnboardingLayout } from "./OnboardingLayout";
import { api } from "../../lib/api";
import { Interest } from "../../lib/types";

export function StepInterests() {
  const [options, setOptions] = useState<Interest[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ items: Interest[] }>("/api/profiles/interest-options").then((r) => setOptions(r.items));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 15) next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/profiles/me/interests", { interestIds: [...selected] });
    } finally {
      setSaving(false);
    }
  }

  const byCategory = options.reduce<Record<string, Interest[]>>((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {});

  return (
    <OnboardingLayout
      step="interests"
      title="What are you into?"
      subtitle={`Pick up to 15 — you've selected ${selected.size}.`}
      onNext={save}
      saving={saving}
      nextDisabled={selected.size === 0}
    >
      <div className="flex flex-col gap-5">
        {Object.entries(byCategory).map(([category, items]) => (
          <div key={category}>
            <p className="text-xs font-mono uppercase text-pulse-300 mb-2">{category}</p>
            <div className="flex flex-wrap gap-2">
              {items.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => toggle(i.id)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    selected.has(i.id) ? "bg-pulse-500 text-white border-pulse-500" : "border-pulse-100 dark:border-pulse-700 text-pulse-700 dark:text-pulse-200"
                  }`}
                >
                  {i.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </OnboardingLayout>
  );
}
