import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ProgressBar, Button } from "../../components/ui/primitives";

const STEPS = ["photos", "school", "goal", "interests", "personality", "lifestyle", "availability", "distance"];

export function OnboardingLayout({
  step,
  title,
  subtitle,
  children,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  saving,
}: {
  step: (typeof STEPS)[number];
  title: string;
  subtitle?: string;
  children: ReactNode;
  onNext: () => Promise<void> | void;
  nextLabel?: string;
  nextDisabled?: boolean;
  saving?: boolean;
}) {
  const navigate = useNavigate();
  const index = STEPS.indexOf(step);

  async function handleNext() {
    await onNext();
    const next = STEPS[index + 1];
    navigate(next ? `/onboarding/${next}` : "/discover");
  }

  return (
    <div className="min-h-screen bg-paper dark:bg-midnight flex flex-col">
      <div className="max-w-md w-full mx-auto px-6 pt-8">
        <ProgressBar step={index + 1} total={STEPS.length} />
      </div>
      <div className="flex-1 max-w-md w-full mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-semibold mb-1.5">{title}</h1>
        {subtitle && <p className="text-pulse-400 text-sm mb-6">{subtitle}</p>}
        {children}
      </div>
      <div className="max-w-md w-full mx-auto px-6 pb-10 flex gap-3">
        {index > 0 && (
          <Button variant="ghost" onClick={() => navigate(`/onboarding/${STEPS[index - 1]}`)}>
            Back
          </Button>
        )}
        <Button onClick={handleNext} disabled={nextDisabled || saving} className="flex-1">
          {saving ? "Saving…" : nextLabel}
        </Button>
      </div>
    </div>
  );
}
