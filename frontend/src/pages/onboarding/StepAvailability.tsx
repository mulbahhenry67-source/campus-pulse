import { useState } from "react";
import { OnboardingLayout } from "./OnboardingLayout";
import { api } from "../../lib/api";
import { AvailabilityBlock } from "../../lib/types";
import { DayTimeGrid } from "../../components/ui/DayTimeGrid";

export function StepAvailability() {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.put("/api/availability", { blocks: blocks.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout
      step="availability"
      title="When are you usually free?"
      subtitle="We'll surface matches whose free time overlaps with yours."
      onNext={save}
      saving={saving}
    >
      <DayTimeGrid value={blocks} onChange={setBlocks} />
    </OnboardingLayout>
  );
}
