"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lightbulb, Layers, Sparkles, BookOpen, Check } from "lucide-react";
import { Button, Field, Badge } from "@/components/ui";
import { startEpisodeAction } from "@/features/platform/actions";
import { cn } from "@/lib/cn";
import { STYLE_LABEL, useOnboarding } from "@/features/platform/onboarding/OnboardingContext";

const EXAMPLES = [
  { chip: "회사 빌런", text: "어제 부장님이 회의 중에 내 아이디어를 자기 것처럼 말했다", emoji: "🏢" },
  { chip: "반려동물", text: "출근하려는데 고양이가 가방 위에 앉아서 안 비켜준다", emoji: "🐾" },
  { chip: "연애 빙산", text: "3개월 만난 사람이 아직 내 생일을 모른다", emoji: "💔" },
];

const CUT_CONFIG = [
  { count: 4, title: "4컷", desc: "인스타 피드 기본", recommend: true },
  { count: 6, title: "6컷", desc: "기승전결 확장", recommend: false },
  { count: 8, title: "8컷", desc: "풀 스토리 몰입", recommend: false },
] as const;

export default function Page() {
  const { story, cutCount, style, characterAssetId, set, skip } = useOnboarding();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** 사연을 회차로 저장하고 콘티 화면으로 넘긴다. 콘티 생성은 크레딧을 쓰지 않는다. */
  function begin(text: string) {
    setError(null);
    start(async () => {
      const r = await startEpisodeAction({
        story: text,
        cutCount,
        stylePreset: STYLE_LABEL[style],
        characterAssetId: characterAssetId ?? undefined,
      });
      if (r.ok) router.push(`/episodes/${r.episodeId}/storyboard`);
      else setError(r.message);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-brand-tint text-brand">
            <BookOpen className="size-3.5" />
          </span>
          <h1 className="text-display font-bold tracking-[-0.015em]">
            무슨 이야기예요?
          </h1>
        </div>
        <p className="text-body-sm text-ink-muted">
          한 줄만 적어도 AI가 컷별 콘티를 자동으로 완성해 드려요.
        </p>
      </div>

      <div className="rounded-xl border border-border/80 bg-surface-card p-4 shadow-2xs">
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
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5 text-label font-semibold text-ink">
          <Lightbulb className="size-4 text-warning" />
          <span>뭘 써야 할지 모르겠다면</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => {
            const isSelected = story === e.text;
            return (
              <button
                key={e.chip}
                type="button"
                onClick={() => set("story", e.text)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-label transition-all cursor-pointer",
                  isSelected
                    ? "border-brand bg-brand-tint text-brand font-semibold shadow-2xs ring-1 ring-brand/30"
                    : "border-border/80 bg-surface-card text-ink-muted hover:border-border-control hover:bg-surface-sunken hover:text-ink"
                )}
              >
                <span>{e.emoji}</span>
                <span>{e.chip}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-label font-semibold text-ink">
            <Layers className="size-4 text-ink-muted" />
            <span>컷 수 선택 (최대 20컷)</span>
          </div>
          <span className="text-caption font-bold text-brand">현재 {cutCount}컷</span>
        </div>

        {/* 빠른 추천 프리셋 */}
        <div role="group" aria-label="빠른 컷 수 추천" className="grid grid-cols-4 gap-2">
          {[
            { count: 4, title: "4컷", desc: "인스타 피드", popular: true },
            { count: 6, title: "6컷", desc: "기승전결", popular: false },
            { count: 8, title: "8컷", desc: "풀 스토리", popular: false },
            { count: 10, title: "10컷", desc: "롱 에피소드", popular: false },
          ].map((c) => {
            const isSelected = cutCount === c.count;
            return (
              <button
                key={c.count}
                type="button"
                aria-pressed={isSelected}
                onClick={() => set("cutCount", c.count)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 rounded-xl border p-2.5 text-center transition-all cursor-pointer",
                  isSelected
                    ? "border-brand bg-brand-tint/50 shadow-xs ring-2 ring-brand/30"
                    : "border-border/80 bg-surface-card hover:border-border-control hover:bg-surface-sunken"
                )}
              >
                <span className="text-body font-bold text-ink">{c.title}</span>
                <span className="text-[10px] text-ink-muted">{c.desc}</span>
                {c.popular && (
                  <span className="absolute -top-1.5 right-1 rounded-full bg-brand px-1 py-0 text-[9px] font-bold text-on-brand shadow-2xs">
                    인기
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 직접 컷 수 조절 스텝퍼 (1 ~ 20컷) */}
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-card p-3 shadow-2xs">
          <span className="text-caption font-medium text-ink-muted">직접 컷 수 설정</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={cutCount <= 1}
              onClick={() => set("cutCount", Math.max(1, cutCount - 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-sunken text-body font-bold text-ink hover:bg-surface-card disabled:opacity-30 cursor-pointer"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={20}
              value={cutCount}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= 1 && val <= 20) set("cutCount", val);
              }}
              className="w-14 text-center font-bold text-title text-ink rounded-md border border-border bg-surface-card py-1 focus:border-brand focus:outline-hidden"
            />
            <button
              type="button"
              disabled={cutCount >= 20}
              onClick={() => set("cutCount", Math.min(20, cutCount + 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-sunken text-body font-bold text-ink hover:bg-surface-card disabled:opacity-30 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        {error && <p className="text-body-sm text-danger">{error}</p>}
        <Button
          size="lg"
          block
          loading={pending}
          disabled={!story.trim()}
          onClick={() => begin(story.trim())}
          className="gap-2"
        >
          <Sparkles className="size-4" />
          콘티 만들기
        </Button>
        <Button
          variant="ghost"
          block
          disabled={pending}
          onClick={() => {
            set("story", EXAMPLES[0].text);
            skip("story");
            begin(EXAMPLES[0].text);
          }}
        >
          예시 사연으로 바로 해볼래요
        </Button>
      </div>
    </>
  );
}
