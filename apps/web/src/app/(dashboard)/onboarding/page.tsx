import { OnboardingWizard } from "./onboarding-wizard";

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-10">
      <OnboardingWizard />
    </div>
  );
}
