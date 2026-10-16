"use client";

import { useState, useTransition, useMemo } from "react";
import { Sparkles, Image as ImageIcon, Wand2, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, ChoiceCard, Field, Modal } from "@/components/ui";
import {
  generateAssetVisualAction,
  saveAssetAction,
  uploadAssetReferenceAction,
} from "@/features/platform/actions";
import type { Asset, AssetKind } from "@/features/platform/data/types";
import { generateAssetIllustrationSvg } from "./assetVisuals";

export interface SeriesOption {
  id: string;
  title: string;
  assetIds: string[];
  stylePreset?: string;
  customStyleImageUrl?: string | null;
}

type FormKind = "character" | "animal" | "location" | "prop";

const KINDS: { id: FormKind; title: string; description: string; badge: string }[] = [
  { id: "character", title: "인물 (캐릭터)", description: "회차마다 같은 얼굴로 나올 주인공 및 조연", badge: "인물" },
  { id: "animal", title: "동물 (반려동물)", description: "강아지, 고양이 등 작화가 유지될 동물", badge: "동물" },
  { id: "location", title: "배경 (장소)", description: "사무실, 카페 등 반복해서 나오는 배경", badge: "장소" },
  { id: "prop", title: "소품", description: "법인카드, 텀블러 등 손에 쥐거나 놓이는 물건", badge: "소품" },
];

const PLACEHOLDERS: Record<FormKind, { name: string; desc: string; tags: string }> = {
  character: {
    name: "예: 김대리, 주인공, 팀장님",
    desc: "예: 20대 후반, 갈색 단발머리에 동그란 뿔테 안경, 회색 후드티. 무표정이 기본.",
    tags: "단발머리, 안경, 후드티",
  },
  animal: {
    name: "예: 마루, 뽀삐, 치즈냥이",
    desc: "예: 3살 포메라니안, 복슬복슬한 흰 털, 귀가 쫑긋 서 있고 호기심 많은 눈망울.",
    tags: "포메라니안, 흰털, 귀쫑긋",
  },
  location: {
    name: "예: 탕비실, 스타트업 사무실, 동네 카페",
    desc: "예: 커피머신과 정수기가 놓인 깔끔한 탕비실. 은은한 조명과 싱크대.",
    tags: "커피머신, 싱크대, 실내",
  },
  prop: {
    name: "예: 법인카드, 파란 머그컵, 사원증",
    desc: "예: 노란색 신용카드, 모서리가 살짝 닳아 있는 회사 법인카드.",
    tags: "신용카드, 노란색, 법카",
  },
};

export interface AssetFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 없으면 새로 만들기. */
  asset?: Asset | null;
  defaultKind: AssetKind;
  seriesList?: SeriesOption[];
  defaultSeriesId?: string | null;
}

export function AssetFormModal({
  open,
  onClose,
  asset,
  defaultKind,
  seriesList,
  defaultSeriesId,
}: AssetFormModalProps) {
  // 기존 에셋에 동물 태그가 있다면 animal 탭으로 시작
  const initialKind: FormKind = useMemo(() => {
    if (asset) {
      if (asset.kind === "character" && (asset.tags.includes("동물") || asset.name.includes("고양이") || asset.name.includes("강아지"))) {
        return "animal";
      }
      return asset.kind === "style" ? "character" : asset.kind;
    }
    return defaultKind === "style" ? "character" : defaultKind;
  }, [asset, defaultKind]);

  const [kind, setKind] = useState<FormKind>(initialKind);
  const [name, setName] = useState(asset?.name ?? "");
  const [description, setDescription] = useState(asset?.description ?? "");
  const [tags, setTags] = useState(asset?.tags.join(", ") ?? "");

  // 선택된 작품 목록 (defaultSeriesId가 있으면 그것만, 없으면 기본 전체)
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<string[]>(() => {
    if (asset) {
      return seriesList?.filter((s) => s.assetIds.includes(asset.id)).map((s) => s.id) ?? [];
    }
    if (defaultSeriesId) {
      return [defaultSeriesId];
    }
    return seriesList?.map((s) => s.id) ?? [];
  });

  // 대상 작품 정보 파악
  const targetSeries = useMemo(() => {
    if (defaultSeriesId && seriesList) {
      return seriesList.find((s) => s.id === defaultSeriesId) ?? null;
    }
    if (selectedSeriesIds.length > 0 && seriesList) {
      return seriesList.find((s) => s.id === selectedSeriesIds[0]) ?? null;
    }
    return null;
  }, [defaultSeriesId, selectedSeriesIds, seriesList]);

  const activeStylePreset = targetSeries?.stylePreset || "심플 라인";

  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(() => asset?.thumbUrl ?? null);
  const [isConvertedToStyle, setIsConvertedToStyle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [isGeneratingAi, startGeneratingAi] = useTransition();

  const tagList = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // 캐릭터 태그는 5개까지. DB 제약과 같은 값을 화면에서도 먼저 막는다.
  const tooManyTags = tagList.length > 5;

  // AI 소재 이미지 생성 핸들러 (실제 AI 모델 또는 작품 스타일 맞춤 일러스트)
  function handleGenerateAiVisual(refImageOverride?: string | null) {
    const effectiveTags = [...tagList];
    if (kind === "animal" && !effectiveTags.includes("동물")) {
      effectiveTags.push("동물");
    }

    const assetName =
      name.trim() ||
      (kind === "animal"
        ? "반려동물"
        : kind === "character"
        ? "주인공"
        : kind === "location"
        ? "배경 장소"
        : "소품");

    startGeneratingAi(async () => {
      try {
        const res = await generateAssetVisualAction({
          name: assetName,
          kind,
          description: description.trim() || null,
          tags: effectiveTags,
          stylePreset: activeStylePreset,
          customStyleImageUrl: targetSeries?.customStyleImageUrl ?? null,
          referenceImageUrl:
            refImageOverride !== undefined ? refImageOverride : filePreview,
        });

        if (res.ok) {
          setGeneratedPreview(res.imageUrl);
          setError(null);
          return;
        }
      } catch (err) {
        console.warn("AI generation failed, fallback to local visual:", err);
      }

      // fallback
      const svgData = generateAssetIllustrationSvg({
        name: assetName,
        kind,
        description: description.trim() || null,
        tags: effectiveTags,
        style: activeStylePreset,
        customStyleImageUrl: targetSeries?.customStyleImageUrl,
      });
      setGeneratedPreview(svgData);
    });
  }

  // 업로드한 실사 사진을 작품 화풍으로 AI 변환
  function handleConvertToStyle() {
    setIsConvertedToStyle(true);
    handleGenerateAiVisual(filePreview);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setIsConvertedToStyle(false);
    if (selected) {
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(selected);
    } else {
      setFilePreview(null);
    }
  }

  function submit() {
    if (!name.trim()) {
      setError("소재 이름을 적어 주세요.");
      return;
    }
    if (tooManyTags) {
      setError("특징 태그는 5개까지만 넣을 수 있어요.");
      return;
    }

    // animal 은 DB enum 호환을 위해 kind: 'character' 로 매핑하고 '동물' 태그 자동 포함
    const effectiveKind: AssetKind = kind === "animal" ? "character" : kind;
    const finalTags = [...tagList];
    if (kind === "animal" && !finalTags.includes("동물")) {
      finalTags.push("동물");
    }

    start(async () => {
      let effectiveThumb = generatedPreview;

      // 이미지를 직접 올리지도 않았고 AI 비주얼도 아직 수동 생성하지 않은 경우, 저장 시점에 화풍 맞춤 AI 비주얼 자동 생성
      if (!effectiveThumb && !file) {
        try {
          const res = await generateAssetVisualAction({
            name: name.trim(),
            kind: effectiveKind,
            description: description.trim() || null,
            tags: finalTags,
            stylePreset: activeStylePreset,
            customStyleImageUrl: targetSeries?.customStyleImageUrl ?? null,
            referenceImageUrl: filePreview,
          });
          if (res.ok) {
            effectiveThumb = res.imageUrl;
          }
        } catch (err) {
          console.warn("Auto AI visual generation during submit failed:", err);
        }
      }

      // 오프라인이거나 모델 실패 시의 최종 안전망 일러스트
      if (!effectiveThumb) {
        effectiveThumb = generateAssetIllustrationSvg({
          name: name.trim(),
          kind,
          description: description.trim() || null,
          tags: finalTags,
          style: activeStylePreset,
          customStyleImageUrl: targetSeries?.customStyleImageUrl,
        });
      }

      const r = await saveAssetAction(
        asset?.id ?? null,
        {
          kind: effectiveKind,
          name: name.trim(),
          description: description.trim() || null,
          tags: finalTags,
          thumbUrl: effectiveThumb,
        },
        seriesList ? (targetSeries ? [targetSeries.id] : selectedSeriesIds) : undefined,
      );
      if (!r.ok) {
        setError(r.message);
        return;
      }
      if (file) {
        const form = new FormData();
        form.set("assetId", r.id);
        form.set("file", file);
        const up = await uploadAssetReferenceAction(form);
        if (!up.ok) {
          setError(`저장은 됐지만 이미지를 못 올렸어요. ${up.message}`);
          return;
        }
      }
      onClose();
    });
  }

  const p = PLACEHOLDERS[kind];

  const previewSvg = useMemo(() => {
    return generateAssetIllustrationSvg({
      name: name.trim() || p.name.split(",")[0].replace("예:", "").trim(),
      kind,
      description: description.trim() || null,
      tags: tagList,
      style: activeStylePreset,
      customStyleImageUrl: targetSeries?.customStyleImageUrl,
    });
  }, [name, p.name, kind, description, tagList, activeStylePreset, targetSeries?.customStyleImageUrl]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={asset ? "소재 수정" : "소재 추가"}
      description={
        asset
          ? "바꾼 내용은 다음 화부터 적용돼요. 지난 회차는 그대로 유지돼요."
          : `선택한 작품의 화풍(${activeStylePreset})에 맞춰 고정 레퍼런스로 등록됩니다.`
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button loading={pending} onClick={submit}>
            {pending ? "화풍 적용 및 저장 중..." : asset ? "저장" : "추가"}
          </Button>
        </>
      }
    >
      {/* 1. 소재 종류 선택 (인물, 동물, 장소, 소품) */}
      {!asset && (
        <div role="group" aria-label="소재 종류" className="grid grid-cols-2 gap-2">
          {KINDS.map((k) => (
            <ChoiceCard
              key={k.id}
              title={k.title}
              description={k.description}
              selected={kind === k.id}
              onClick={() => {
                setKind(k.id);
              }}
            />
          ))}
        </div>
      )}

      {/* 2. 소속 작품 안내 (드롭다운에서 선택된 작품에 바로 저장) */}
      {targetSeries ? (
        <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand-tint/60 px-3.5 py-2.5 text-caption">
          <span className="font-semibold text-ink flex items-center gap-1.5">
            📁 등록 작품: <strong className="text-brand font-bold">&lsquo;{targetSeries.title}&rsquo;</strong>
          </span>
          <span className="text-[11px] font-semibold text-brand bg-white/90 px-2 py-0.5 rounded-md border border-brand/30 shadow-3xs">
            자동 저장 및 화풍 일치
          </span>
        </div>
      ) : (
        seriesList && seriesList.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-label font-semibold text-ink">
              적용할 작품 <span className="font-normal text-ink-subtle">(선택 시 고정 레퍼런스로 반영)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {seriesList.map((s) => {
                const checked = selectedSeriesIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-body-sm cursor-pointer transition-colors select-none",
                      checked
                        ? "border-brand bg-brand-tint/60 text-ink font-semibold"
                        : "border-border bg-surface-card text-ink-muted hover:border-border-control",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-brand"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSeriesIds((prev) => [...prev, s.id]);
                        } else {
                          setSelectedSeriesIds((prev) => prev.filter((id) => id !== s.id));
                        }
                      }}
                    />
                    <span>📁 {s.title}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* 3. 이름 입력 */}
      <Field
        label="이름"
        value={name}
        onChange={(v) => {
          setName(v);
        }}
        placeholder={p.name}
      />

      {/* 4. 설명 입력 */}
      <Field
        label="설명"
        multiline
        rows={3}
        value={description}
        onChange={setDescription}
        placeholder={p.desc}
        help="생성할 때 이 문장이 그대로 들어가요. 구체적일수록 일관성이 올라가요."
        optional
      />

      {/* 5. 특징 태그 입력 */}
      <Field
        label="특징 태그"
        value={tags}
        onChange={setTags}
        placeholder={p.tags}
        error={tooManyTags ? "태그는 5개까지만 넣을 수 있어요." : undefined}
        help="쉼표로 구분해 5개까지. 인물의 고유 외모나 소품 특징을 적어주세요."
        optional
      />

      {/* 6. 소재 이미지 및 AI 화풍 변환 섹션 */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border/80 bg-surface-sunken/40 p-4">
        <div className="flex items-center justify-between">
          <span className="text-label font-bold text-ink flex items-center gap-1.5">
            <ImageIcon className="size-4 text-brand" />
            <span>소재 이미지 & 화풍 변환</span>
          </span>
          <span className="text-caption text-ink-muted">
            적용 화풍: <strong className="text-brand font-semibold">{activeStylePreset}</strong>
          </span>
        </div>

        <div className="flex items-center gap-3.5">
          {/* 이미지 프리뷰 */}
          <div className="relative size-22 rounded-xl border border-border/80 overflow-hidden bg-surface-card shrink-0 shadow-2xs">
            {filePreview && !isConvertedToStyle ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={filePreview} alt="업로드 이미지" className="size-full object-cover" />
            ) : generatedPreview ? (
              <div className="relative size-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={generatedPreview} alt="AI 생성 일러스트" className="size-full object-cover" />
                <span className="absolute bottom-1 right-1 rounded bg-brand/90 px-1 py-0.2 text-[8px] font-bold text-white shadow-xs">
                  AI 화풍 반영
                </span>
              </div>
            ) : asset?.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.thumbUrl} alt="현재 소재 이미지" className="size-full object-cover" />
            ) : (
              <div className="relative size-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewSvg} alt="기본 프리뷰" className="size-full object-cover opacity-75" />
                <span className="absolute bottom-1 right-1 rounded bg-surface-card/90 border border-border px-1 py-0.2 text-[8px] font-medium text-ink-subtle">
                  기본안
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-1">
            {file ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold text-ink truncate max-w-[200px]">
                  📷 업로드됨: {file.name}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isGeneratingAi}
                    onClick={handleConvertToStyle}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand text-on-brand hover:opacity-90 disabled:opacity-50 px-2.5 py-1 text-[11px] font-bold cursor-pointer transition-all shadow-3xs"
                  >
                    <Wand2 className="size-3" />
                    {isGeneratingAi ? "화풍 변환 중..." : `작품 화풍(${activeStylePreset})으로 변환`}
                  </button>
                  {isConvertedToStyle && !isGeneratingAi && (
                    <span className="text-[11px] font-semibold text-brand flex items-center gap-0.5">
                      <Check className="size-3" /> 변환 완료
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-caption text-ink-muted leading-tight">
                사진을 올리지 않아도 <strong>AI가 작품 화풍({activeStylePreset})</strong>에 맞춰 소재 일러스트를 직접 자동 생성합니다.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                disabled={isGeneratingAi}
                onClick={() => handleGenerateAiVisual()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand bg-brand-tint px-2.5 py-1 text-caption font-bold text-brand hover:bg-brand/15 disabled:opacity-50 cursor-pointer shadow-3xs"
              >
                <Sparkles className="size-3.5" />
                {isGeneratingAi ? "화풍 AI 생성 중..." : "AI 소재 이미지 미리 생성"}
              </button>

              <label className="inline-flex items-center gap-1 rounded-lg border border-border-control bg-surface-card px-2.5 py-1 text-caption font-medium text-ink hover:border-brand cursor-pointer">
                <span>📁 사진·그림 올리기</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-body-sm text-danger">{error}</p>}
    </Modal>
  );
}
