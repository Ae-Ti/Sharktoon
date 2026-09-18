"use client";

import { ButtonLink, ChoiceCard, Field } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  useOnboarding,
  type CharacterMethod,
  type StylePreset,
} from "@/features/platform/onboarding/OnboardingContext";

const METHODS: { id: CharacterMethod; title: string; description: string }[] = [
  {
    id: "selfie",
    title: "셀카로 만들기",
    description: "사진 1장이면 돼요. 원본은 시트를 만든 뒤 지워요.",
  },
  {
    id: "tags",
    title: "특징 태그로 만들기",
    description: "안경, 곱슬머리처럼 5개까지.",
  },
  {
    id: "default",
    title: "기본 캐릭터 쓰기",
    description: "지금 정하지 않고 첫 화부터 볼래요.",
  },
];

const STYLES: { id: StylePreset; label: string }[] = [
  { id: "simple_line", label: "심플 라인" },
  { id: "pastel", label: "파스텔" },
  { id: "bold_line", label: "굵은 선" },
];

export default function Page() {
  const { method, style, tags, set, skip } = useOnboarding();

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-display font-bold tracking-[-0.015em]">
          어떤 캐릭터로 그릴까요?
        </h1>
        <p className="text-body-sm text-ink-muted">
          한 번 정하면 모든 회차에 같은 얼굴로 나와요.
        </p>
      </div>

      <div role="group" aria-label="캐릭터 만드는 방법" className="flex flex-col gap-2.5">
        {METHODS.map((m) => (
          <ChoiceCard
            key={m.id}
            title={m.title}
            description={m.description}
            selected={method === m.id}
            onClick={() => set("method", m.id)}
          />
        ))}
      </div>

      {method === "selfie" && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border-control bg-surface-sunken px-6 py-8 text-center">
          <span className="text-body font-semibold">사진 고르기</span>
          <span className="text-body-sm text-ink-muted">
            얼굴이 잘 보이는 사진 1장이면 돼요.
          </span>
          <input type="file" accept="image/*" className="sr-only" />
        </label>
      )}

      {method === "tags" && (
        <Field
          label="특징 태그"
          value={tags}
          onChange={(v) => set("tags", v)}
          placeholder="안경, 곱슬머리, 후드티"
          help="쉼표로 구분해 5개까지 적어 주세요."
        />
      )}

      <div className="flex flex-col gap-2.5">
        <div className="text-label font-semibold">그림체</div>
        <div className="grid grid-cols-3 gap-2.5">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={style === s.id}
              onClick={() => set("style", s.id)}
              className={cn(
                "cursor-pointer rounded-lg p-0",
                style === s.id
                  ? "border-2 border-brand bg-brand-tint"
                  : "border border-border-control bg-surface-card",
              )}
            >
              <span
                className={cn(
                  "grid h-21 place-items-center rounded-md bg-skeleton text-[11px] text-ink-subtle",
                  style === s.id ? "m-1" : "m-[5px]",
                )}
              >
                미리보기
              </span>
              <span className="block pt-1.5 pb-2.5 text-caption font-semibold">
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        <ButtonLink href="/onboarding/story" size="lg" block>
          다음
        </ButtonLink>
        <ButtonLink
          href="/onboarding/story"
          variant="ghost"
          block
          onClick={() => {
            // 건너뛰어도 진행 바는 채워진다. 건너뛰기가 실패처럼 보이면 아무도 안 누른다.
            set("method", "default");
            skip("character");
          }}
        >
          건너뛰고 기본 캐릭터로 시작
        </ButtonLink>
      </div>
    </>
  );
}
