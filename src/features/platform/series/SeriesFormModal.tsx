"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import { Check, Palette, Sparkles, Upload, X, Image as ImageIcon } from "lucide-react";
import { Button, Field, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  createSeriesAction,
  updateSeriesRuleAction,
} from "@/features/platform/actions";
import type { SeriesRule } from "@/features/platform/data/types";
import { STYLE_PRESETS_DATA } from "@/features/platform/assets/assetVisuals";

const CUTS = [4, 6, 8];
const RATIOS: SeriesRule["aspectRatio"][] = ["1:1", "4:5"];

const DEFAULT_RULE: SeriesRule = {
  stylePreset: "심플 라인",
  defaultCutCount: 6,
  aspectRatio: "1:1",
  tone: null,
  fixedHashtags: [],
  customStyleImageUrl: null,
};

export interface SeriesFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 있으면 생성 규칙 수정, 없으면 새 작품. */
  seriesId?: string;
  initialTitle?: string;
  initialRule?: SeriesRule;
  onCreated?: (series: { id: string; title: string }) => void;
  sheetOnMobile?: boolean;
}

export function SeriesFormModal({
  open,
  onClose,
  seriesId,
  initialTitle = "",
  initialRule = DEFAULT_RULE,
  onCreated,
  sheetOnMobile = false,
}: SeriesFormModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialTitle);
  const [rule, setRule] = useState<SeriesRule>(initialRule);
  const [hashtags, setHashtags] = useState(initialRule.fixedHashtags.join(" "));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // 커스텀 화풍 상태
  const isCustomInitially = Boolean(
    initialRule.customStyleImageUrl ||
    (initialRule.stylePreset && !STYLE_PRESETS_DATA.some((p) => p.name === initialRule.stylePreset)),
  );
  const [isCustom, setIsCustom] = useState(isCustomInitially);
  const [customStyleName, setCustomStyleName] = useState(
    isCustomInitially ? initialRule.stylePreset : "나만의 화풍",
  );
  const [customImagePreview, setCustomImagePreview] = useState<string | null>(
    initialRule.customStyleImageUrl || null,
  );

  const editing = Boolean(seriesId);

  // 모달이 열릴 때 초기값 동기화
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setRule(initialRule);
      setHashtags(initialRule.fixedHashtags.join(" "));
      const customInit = Boolean(
        initialRule.customStyleImageUrl ||
        (initialRule.stylePreset && !STYLE_PRESETS_DATA.some((p) => p.name === initialRule.stylePreset)),
      );
      setIsCustom(customInit);
      setCustomStyleName(customInit ? initialRule.stylePreset : "나만의 화풍");
      setCustomImagePreview(initialRule.customStyleImageUrl || null);
      setError(null);
    }
  }, [open, initialTitle, initialRule]);

  function set<K extends keyof SeriesRule>(k: K, v: SeriesRule[K]) {
    setRule((r) => ({ ...r, [k]: v }));
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일(PNG, JPG, WebP 등)을 올려주세요.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("이미지 파일 크기는 8MB 이하여야 합니다.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomImagePreview(result);
      if (!customStyleName || customStyleName === "나만의 화풍") {
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        if (baseName.length > 0 && baseName.length <= 15) {
          setCustomStyleName(baseName);
        }
      }
    };
    reader.readAsDataURL(file);
  }

  function submit() {
    if (!editing && !title.trim()) {
      setError("작품 이름을 적어 주세요.");
      return;
    }

    if (isCustom && !customImagePreview) {
      setError("나만의 화풍을 만들려면 기준이 될 사진이나 그림을 1장 올려주세요.");
      return;
    }

    const finalStylePreset = isCustom
      ? customStyleName.trim() || "커스텀 화풍"
      : rule.stylePreset;

    const next: SeriesRule = {
      ...rule,
      stylePreset: finalStylePreset,
      customStyleImageUrl: isCustom ? customImagePreview : null,
      fixedHashtags: hashtags.split(/\s+/).filter((h) => h.startsWith("#")),
    };

    start(async () => {
      const r = editing
        ? await updateSeriesRuleAction(seriesId as string, next)
        : await createSeriesAction({
            title: title.trim(),
            description: null,
            rule: next,
          });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onClose();
      if (!editing && "id" in r && typeof r.id === "string") {
        if (onCreated) {
          onCreated({ id: r.id, title: title.trim() });
        } else {
          router.push(`/series/${r.id}`);
        }
      }
    });
  }

  const pill = (active: boolean) =>
    cn(
      "h-control-md cursor-pointer rounded-md px-4 text-label font-semibold transition-all",
      active
        ? "border-2 border-brand bg-brand-tint text-brand"
        : "border border-border-control bg-surface-card text-ink hover:border-ink-muted",
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      sheetOnMobile={sheetOnMobile}
      size="lg"
      title={editing ? "작품 화풍 및 설정" : "새 작품 만들기"}
      description={
        editing
          ? "이 작품의 고정 화풍과 연재 규칙입니다. 모든 소재와 회차가 이 화풍을 따라가요."
          : "작품의 고정 화풍을 정해두면, 어울리는 인물·배경·소품이 자동 등록되고 모든 회차에 일관되게 적용돼요."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button loading={pending} onClick={submit}>
            {editing ? "저장" : "작품 만들기"}
          </Button>
        </>
      }
    >
      {!editing && (
        <Field
          label="작품 이름"
          value={title}
          onChange={setTitle}
          placeholder="예: 직장 상사 빌런, 우리집 고양이 마루"
        />
      )}

      {/* 화풍 및 스타일 선택 영역 */}
      <div className="flex flex-col gap-2.5 font-sans">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-label font-bold text-ink">작품 화풍 (스타일)</span>
            <p className="text-caption text-ink-muted">
              모든 컷과 소재가 선택한 단일 화풍으로 자동 통일되어 그림체 이탈을 방지합니다.
            </p>
          </div>

          {/* 프리셋 vs 커스텀 전환 탭 */}
          <div className="inline-flex rounded-lg border border-border-control bg-surface-sunken p-0.5 font-sans">
            <button
              type="button"
              onClick={() => {
                setIsCustom(false);
                if (!STYLE_PRESETS_DATA.some((p) => p.name === rule.stylePreset)) {
                  set("stylePreset", "심플 라인");
                }
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label font-semibold font-sans transition-all cursor-pointer",
                !isCustom
                  ? "bg-surface-card text-brand shadow-xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              <Palette className="size-4 shrink-0" />
              추천 화풍 (6종)
            </button>
            <button
              type="button"
              onClick={() => setIsCustom(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label font-semibold font-sans transition-all cursor-pointer",
                isCustom
                  ? "bg-surface-card text-brand shadow-xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              <Sparkles className="size-4 shrink-0" />
              사진 업로드 (나만의 화풍)
            </button>
          </div>
        </div>

        {/* 1. 추천 프리셋 카드 그리드 */}
        {!isCustom ? (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {STYLE_PRESETS_DATA.map((p) => {
                const isSelected = rule.stylePreset === p.name;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => set("stylePreset", p.name)}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-xl border text-left transition-all duration-150 cursor-pointer font-sans",
                      isSelected
                        ? "border-brand bg-brand-tint/15 shadow-sm ring-2 ring-brand"
                        : "border-border-control bg-surface-card hover:border-brand/50 hover:bg-surface-sunken/40",
                    )}
                  >
                    {/* 일러스트 예시 썸네일 (실제 AI 화풍 PNG, fallback: sampleSvg) */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-sunken">
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        onError={(e) => {
                          e.currentTarget.src = p.sampleSvg;
                        }}
                        className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-brand text-white shadow-xs">
                          <Check className="size-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* 화풍 정보 */}
                    <div className="flex flex-1 flex-col p-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-body-sm font-bold text-ink">{p.name}</span>
                        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-caption font-medium text-ink-muted">
                          {p.badge}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-caption leading-snug text-ink-muted">
                        {p.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 나만의 화풍 만들기 유도 배너 */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border-control bg-surface-sunken/50 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 shrink-0 text-brand" />
                <span className="text-caption text-ink-muted">
                  자신이 직접 그린 그림이나 원하는 사진 스타일로 연재하고 싶으신가요?
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className="shrink-0 text-caption font-bold text-brand hover:underline cursor-pointer"
              >
                사진 한 장 올려 나만의 화풍 만들기 →
              </button>
            </div>
          </div>
        ) : (
          /* 2. 커스텀 화풍 업로드 패널 */
          <div className="flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand-tint/10 p-4 font-sans">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-full bg-brand text-white">
                  <Sparkles className="size-3.5" />
                </div>
                <div>
                  <span className="text-body-sm font-bold text-ink">나만의 맞춤 화풍 만들기</span>
                  <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-caption font-bold text-brand">
                    사진 1장 학습
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCustom(false);
                  if (!STYLE_PRESETS_DATA.some((p) => p.name === rule.stylePreset)) {
                    set("stylePreset", "심플 라인");
                  }
                }}
                className="text-caption font-medium text-ink-muted hover:text-ink underline cursor-pointer"
              >
                추천 프리셋 둘러보기
              </button>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              {/* 이미지 업로드 & 미리보기 */}
              <div className="shrink-0 w-full sm:w-48">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {customImagePreview ? (
                  <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-brand bg-surface-card shadow-sm">
                    <img
                      src={customImagePreview}
                      alt="화풍 레퍼런스 이미지"
                      className="size-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/50 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-md bg-white px-2.5 py-1 text-caption font-bold text-ink shadow-xs hover:bg-surface-sunken cursor-pointer"
                      >
                        사진 변경
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomImagePreview(null)}
                        className="rounded-md bg-danger px-2.5 py-1 text-caption font-bold text-white shadow-xs hover:bg-danger/90 cursor-pointer"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="absolute top-2 left-2 rounded-full bg-ink/75 px-2 py-0.5 text-caption font-semibold text-white backdrop-blur-xs">
                      기준 사진 등록됨
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/50 bg-surface-card p-3 text-center transition-all hover:border-brand hover:bg-brand-tint/20 cursor-pointer"
                  >
                    <div className="flex size-10 items-center justify-center rounded-full bg-brand-tint text-brand">
                      <Upload className="size-5" />
                    </div>
                    <div>
                      <span className="block text-label font-bold text-ink">사진 1장 올리기</span>
                      <span className="block text-caption text-ink-muted">손그림, 사진, 일러스트</span>
                    </div>
                  </button>
                )}
              </div>

              {/* 화풍 이름 및 AI 설명 */}
              <div className="flex flex-1 flex-col justify-between gap-3">
                <Field
                  label="화풍 이름"
                  value={customStyleName}
                  onChange={setCustomStyleName}
                  placeholder="예: 내 손그림체, 레트로 감성 수채화"
                  help="이 작품에만 적용되는 고유한 화풍 이름입니다."
                />

                <div className="rounded-lg border border-border-control bg-surface-card p-3 text-caption leading-relaxed text-ink-muted shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-brand">
                    <Sparkles className="size-3.5" />
                    AI 화풍 분석 및 동기화 원리
                  </div>
                  <p className="mt-1">
                    올려주신 사진의 <strong>선 굵기, 펜 질감, 컬러 팔레트, 음영 기법</strong>을 AI가 추출하여, 이 작품에 등록될 인물·배경·소품 소재와 모든 회차 컷에 동일한 화풍을 흔들림 없이 적용합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 컷 수 & 비율 */}
      <div className="flex flex-wrap gap-6 pt-1">
        <div className="flex flex-col gap-2">
          <span className="text-label font-semibold">기본 컷 수</span>
          <div className="flex gap-2">
            {CUTS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rule.defaultCutCount === n}
                onClick={() => set("defaultCutCount", n)}
                className={pill(rule.defaultCutCount === n)}
              >
                {n}컷
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-label font-semibold">비율</span>
          <div className="flex gap-2">
            {RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={rule.aspectRatio === r}
                onClick={() => set("aspectRatio", r)}
                className={pill(rule.aspectRatio === r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Field
        label="말투"
        value={rule.tone ?? ""}
        onChange={(v) => set("tone", v || null)}
        placeholder="반말 · 자조적"
        help="대사와 캡션이 이 말투를 따라가요."
        optional
      />

      <Field
        label="고정 해시태그"
        value={hashtags}
        onChange={setHashtags}
        placeholder="#직장상사빌런 #샥툰"
        help="매 화 캡션에 자동으로 붙어요. 화별 해시태그와는 구분돼요."
        optional
      />

      {error && <p className="text-body-sm font-semibold text-danger">{error}</p>}
    </Modal>
  );
}
