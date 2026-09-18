"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CharacterMethod = "selfie" | "tags" | "default";
export type StylePreset = "simple_line" | "pastel" | "bold_line";

export interface OnboardingState {
  method: CharacterMethod;
  style: StylePreset;
  tags: string;
  story: string;
  cutCount: 4 | 6 | 8;
  /** 건너뛰기로 지나온 단계. 진행 바는 건너뛴 단계도 완료로 센다. */
  skipped: Set<string>;
}

interface Ctx extends OnboardingState {
  set: <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => void;
  skip: (step: string) => void;
}

const OnboardingCtx = createContext<Ctx | null>(null);

/**
 * 온보딩 네 단계가 공유하는 상태. 레이아웃에 두어 단계 사이를 오가도 유지된다.
 * 서버에 저장하지 않는다 — 첫 화 결과 전에는 아무것도 요구하지 않는 것이 원칙이다.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>({
    // 가장 부담이 적은 선택지를 미리 채워 둔다. 빈 화면으로 두지 않는다.
    method: "selfie",
    style: "simple_line",
    tags: "",
    story: "",
    cutCount: 6,
    skipped: new Set(),
  });

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      set: (key, v) => setState((s) => ({ ...s, [key]: v })),
      skip: (step) =>
        setState((s) => ({ ...s, skipped: new Set(s.skipped).add(step) })),
    }),
    [state],
  );

  return <OnboardingCtx.Provider value={value}>{children}</OnboardingCtx.Provider>;
}

export function useOnboarding(): Ctx {
  const ctx = useContext(OnboardingCtx);
  if (!ctx) throw new Error("OnboardingProvider 안에서만 쓴다");
  return ctx;
}
