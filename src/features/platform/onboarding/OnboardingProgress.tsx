"use client";

import { usePathname } from "next/navigation";
import { StepProgress } from "@/components/ui";

const STEPS = ["로그인", "캐릭터 만들기", "사연 입력", "첫 화 결과"];

const INDEX: Record<string, number> = {
  "/onboarding/character": 1,
  "/onboarding/story": 2,
  "/onboarding/result": 3,
};

export function OnboardingProgress() {
  const path = usePathname();
  const current = INDEX[path] ?? 1;
  return (
    <StepProgress
      steps={STEPS}
      current={current}
      partial={current === 3 ? 100 : 35}
    />
  );
}
