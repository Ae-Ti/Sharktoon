"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ChoiceCard, Field } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createCharacterAction } from "@/features/platform/actions";
import {
  STYLE_LABEL,
  useOnboarding,
  type CharacterMethod,
  type StylePreset,
} from "@/features/platform/onboarding/OnboardingContext";

import { Tags, Sparkles } from "lucide-react";

const METHODS: { id: CharacterMethod; title: string; description: string; icon: React.ReactNode }[] = [
  {
    id: "tags",
    title: "특징 태그로 만들기",
    description: "안경, 곱슬머리처럼 5개까지 키워드로 직접 구성해요.",
    icon: <Tags className="size-4.5" />,
  },
  {
    id: "default",
    title: "기본 캐릭터 쓰기",
    description: "지금 정하지 않고 첫 화부터 바로 볼래요.",
    icon: <Sparkles className="size-4.5" />,
  },
];

const TAG_SUGGESTIONS = ["안경", "후드티", "단발", "곱슬머리", "직장인", "고양이귀"];

const STYLES = (Object.keys(STYLE_LABEL) as StylePreset[]).map((id) => ({
  id,
  label: STYLE_LABEL[id],
}));

export default function Page() {
  const { method, style, tags, characterAssetId, set, skip } = useOnboarding();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
  const tagCount = tagList.length;

  function addTag(tag: string) {
    if (tagList.includes(tag) || tagCount >= 5) return;
    const nextTags = tagList.length > 0 ? `${tags}, ${tag}` : tag;
    set("tags", nextTags);
    set("characterAssetId", null);
  }

  /** 특징 태그로 캐릭터 시트를 만들고 사연 단계로 간다. 시트 생성은 크레딧을 쓰지 않는다. */
  function next() {
    setError(null);
    if (method === "default" || characterAssetId) {
      router.push("/onboarding/story");
      return;
    }
    if (tagCount === 0) {
      setError("특징을 하나 이상 적어 주세요. 지금 정하기 어렵다면 아래 건너뛰기를 눌러도 돼요.");
      return;
    }
    start(async () => {
      const form = new FormData();
      form.set("style", STYLE_LABEL[style]);
      form.set("tags", tags);
      const r = await createCharacterAction(form);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      set("characterAssetId", r.assetId);
      router.push("/onboarding/story");
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-display font-bold tracking-[-0.015em]">
          어떤 캐릭터로 그릴까요?
        </h1>
        <p className="text-body-sm text-ink-muted">
          선택한 화풍과 얼굴로 모든 회차의 주인공과 컷이 그려져요.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-label font-semibold">1. 웹툰 화풍 스타일</div>
          <span className="text-caption text-ink-muted">캐릭터 애셋과 4컷 만화에 함께 적용</span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={style === s.id}
              onClick={() => {
                set("style", s.id);
                set("characterAssetId", null);
              }}
              className={cn(
                "group cursor-pointer rounded-xl p-3 text-left transition-all shadow-2xs",
                style === s.id
                  ? "border-2 border-brand bg-brand-tint/40 ring-1 ring-brand/30 shadow-xs"
                  : "border border-border/80 bg-surface-card hover:border-brand/50 hover:bg-surface-sunken/40",
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-label font-bold text-ink">
                  {s.label}
                </span>
                {style === s.id && (
                  <span className="size-2 rounded-full bg-brand" />
                )}
              </div>
              <span className="block text-[11px] leading-tight text-ink-muted">
                {s.id === "simple_line" && "1.5px 슬림선 · 플랫 셀채색"}
                {s.id === "bold_line" && "2.5px 또렷한 선 · 선명한 명암"}
                {s.id === "pastel" && "부드러운 파스텔 · 따뜻한 감성"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-label font-semibold">2. 캐릭터 만드는 방법</div>
        <div role="group" aria-label="캐릭터 만드는 방법" className="flex flex-col gap-2.5">
          {METHODS.map((m) => (
            <ChoiceCard
              key={m.id}
              title={m.title}
              description={m.description}
              icon={m.icon}
              selected={method === m.id}
              onClick={() => {
                set("method", m.id);
                set("characterAssetId", null);
              }}
            />
          ))}
        </div>
      </div>

      {method === "tags" && (
        <div className="flex flex-col gap-2">
          <Field
            label="특징 태그"
            value={tags}
            onChange={(v) => {
              set("tags", v);
              set("characterAssetId", null);
            }}
            placeholder="안경, 곱슬머리, 후드티"
            help="쉼표로 구분해 5개까지 적어 주세요."
            error={tagCount > 5 ? "5개까지만 넣을 수 있어요." : undefined}
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-ink-subtle">추천 태그:</span>
            {TAG_SUGGESTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                disabled={tagCount >= 5 || tagList.includes(tag)}
                className="rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-[11px] font-medium text-ink-muted hover:border-brand hover:text-brand transition-colors disabled:opacity-40"
              >
                +{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-2 pt-2">
        {error && <p className="text-body-sm text-danger font-medium">{error}</p>}
        <Button size="lg" block loading={pending} disabled={tagCount > 5} onClick={next} className="shadow-xs font-bold">
          {pending ? "캐릭터 시트 만드는 중" : "다음"}
        </Button>
        <Button
          variant="ghost"
          block
          disabled={pending}
          onClick={() => {
            set("method", "default");
            set("characterAssetId", null);
            skip("character");
            router.push("/onboarding/story");
          }}
        >
          건너뛰고 기본 캐릭터로 시작
        </Button>
      </div>
    </>
  );
}
