"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button, ChoiceCard, Field } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createCharacterAction } from "@/features/platform/actions";
import {
  STYLE_LABEL,
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

const STYLES = (Object.keys(STYLE_LABEL) as StylePreset[]).map((id) => ({
  id,
  label: STYLE_LABEL[id],
}));

export default function Page() {
  const { method, style, tags, selfie, characterAssetId, set, skip } = useOnboarding();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const preview = useObjectUrl(selfie);

  const tagCount = tags.split(",").map((t) => t.trim()).filter(Boolean).length;

  /** 셀카나 태그로 캐릭터 시트를 만들고 사연 단계로 간다. 시트 생성은 크레딧을 쓰지 않는다. */
  function next() {
    setError(null);
    if (method === "default" || characterAssetId) {
      router.push("/onboarding/story");
      return;
    }
    if (method === "selfie" && !selfie) {
      setError("사진을 골라 주세요. 지금 정하기 어렵다면 아래 건너뛰기를 눌러도 돼요.");
      return;
    }
    start(async () => {
      const form = new FormData();
      form.set("method", method);
      form.set("style", STYLE_LABEL[style]);
      form.set("tags", tags);
      if (selfie) form.set("selfie", selfie);
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
                "group cursor-pointer rounded-lg p-3 text-left transition-all",
                style === s.id
                  ? "border-2 border-brand bg-brand-tint ring-1 ring-brand/30"
                  : "border border-border-control bg-surface-card hover:bg-surface-sunken",
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
              selected={method === m.id}
              onClick={() => {
                set("method", m.id);
                // 방법을 바꾸면 이전에 만든 캐릭터는 쓰지 않는다.
                set("characterAssetId", null);
              }}
            />
          ))}
        </div>
      </div>

      {method === "selfie" && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border-control bg-surface-sunken px-6 py-7 text-center hover:border-brand transition-colors">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="고른 사진" className="size-24 rounded-full object-cover ring-2 ring-brand" />
          ) : null}
          <span className="text-body font-semibold">{selfie ? "다른 사진 고르기" : "사진 고르기"}</span>
          <span className="text-body-sm text-ink-muted">
            얼굴이 잘 보이는 사진 1장으로 <strong className="text-brand font-medium">'{STYLE_LABEL[style]}'</strong> 2D 캐릭터를 만들어요.
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              set("selfie", e.target.files?.[0] ?? null);
              set("characterAssetId", null);
            }}
          />
        </label>
      )}

      {method === "tags" && (
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
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        {error && <p className="text-body-sm text-danger">{error}</p>}
        <Button size="lg" block loading={pending} disabled={tagCount > 5} onClick={next}>
          {pending ? "캐릭터 시트 만드는 중" : "다음"}
        </Button>
        <Button
          variant="ghost"
          block
          disabled={pending}
          onClick={() => {
            // 건너뛰어도 진행 바는 채워진다. 건너뛰기가 실패처럼 보이면 아무도 안 누른다.
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

/** 고른 사진 미리보기 URL. 바뀌거나 떠날 때 해제한다. */
function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return url;
}
