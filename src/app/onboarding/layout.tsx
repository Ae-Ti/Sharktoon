import type { ReactNode } from "react";
import { OnboardingProvider } from "@/features/platform/onboarding/OnboardingContext";
import { OnboardingProgress } from "@/features/platform/onboarding/OnboardingProgress";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <OnboardingProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-5 px-4 pt-5 pb-6">
        <OnboardingProgress />
        {children}
      </div>
    </OnboardingProvider>
  );
}
