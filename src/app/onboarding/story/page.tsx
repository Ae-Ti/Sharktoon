"use client";

import { ButtonLink, Field } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useOnboarding } from "@/features/platform/onboarding/OnboardingContext";

const EXAMPLES = [
  { chip: "회사 빌런", text: "어제 부장님이 회의 중에 내 아이디어를 자기 것처럼 말했다" },
  { chip: "반려동물", text: "출근하려는데 고양이가 가방 위에 앉아서 안 비켜준다" },
  { chip: "연애 빙산", text: "3개월 만난 사람이 아직 내 생일을 모른다" },
];

const CUT_COUNTS = [4, 6, 8] as const;

export default function Page() {
  const { story, cutCount, set, skip } = useOnboarding();

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-display font-bold tracking-[-0.015em]">
          무슨 이야기예요?
        </h1>
        <p className="text-body-sm text-ink-muted">
          한 줄만 적어도 컷별 콘티를 만들어 드려요.
        </p>
      </div>

      <Field
        label="사연"
        multiline
        rows={5}
        value={story}
        onChange={(v) => set("story", v)}
        placeholder="어제 부장님이 회의 중에 내 아이디어를 자기 것처럼 말했다"
        help="콘티 만들기는 크레딧을 쓰지 않아요."
        maxLength={300}
      />

      <div className="flex flex-col gap-2">
        <div className="text-label font-semibold">뭘 써야 할지 모르겠다면</div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e.chip}
              type="button"
              onClick={() => set("story", e.text)}
              className="h-control-sm cursor-pointer rounded-full border border-border-control bg-surface-card px-3 text-label text-ink hover:bg-surface-sunken"
            >
              {e.chip}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-label font-semibold">컷 수</div>
        <div role="group" aria-label="컷 수" className="grid grid-cols-3 gap-2">
          {CUT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={cutCount === n}
              onClick={() => set("cutCount", n)}
              className={cn(
                "h-control-md cursor-pointer rounded-md text-label font-semibold",
                cutCount === n
                  ? "border-2 border-brand bg-brand-tint"
                  : "border border-border-control bg-surface-card",
              )}
            >
              {n}컷
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        <ButtonLink href="/episodes/ep_001/storyboard" size="lg" block>
          콘티 만들기
        </ButtonLink>
        <ButtonLink
          href="/episodes/ep_001/storyboard"
          variant="ghost"
          block
          onClick={() => {
            set("story", EXAMPLES[0].text);
            skip("story");
          }}
        >
          예시 사연으로 해볼래요
        </ButtonLink>
      </div>
    </>
  );
}
