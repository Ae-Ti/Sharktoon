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
            onClick={() => {
              set("method", m.id);
              // 방법을 바꾸면 이전에 만든 캐릭터는 쓰지 않는다.
              set("characterAssetId", null);
            }}
          />
        ))}
      </div>

      {method === "selfie" && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border-control bg-surface-sunken px-6 py-8 text-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="고른 사진" className="size-28 rounded-full object-cover" />
          ) : null}
          <span className="text-body font-semibold">{selfie ? "다른 사진 고르기" : "사진 고르기"}</span>
          <span className="text-body-sm text-ink-muted">
            얼굴이 잘 보이는 사진 1장이면 돼요. PNG·JPG, 10MB 까지.
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

      <div className="flex flex-col gap-2.5">
        <div className="text-label font-semibold">그림체</div>
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
