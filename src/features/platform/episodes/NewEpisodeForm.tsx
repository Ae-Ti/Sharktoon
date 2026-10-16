"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BookOpen, Layers, Lightbulb, Sparkles, Plus, Check, Camera, AlertCircle, Upload } from "lucide-react";
import { Button, Field, Badge, Modal } from "@/components/ui";
import { startEpisodeAction, extractStoryFromImageAction } from "@/features/platform/actions";
import { SeriesFormModal } from "@/features/platform/series/SeriesFormModal";
import type { SeriesSummary } from "@/features/platform/data/types";
import { cn } from "@/lib/cn";
import { EPISODE_CUTS_MAX, EPISODE_CUTS_MIN } from "@/contracts/instagram";

const EXAMPLES = [
  { chip: "회사 빌런", text: "어제 부장님이 회의 중에 내 아이디어를 자기 것처럼 말했다", emoji: "🏢" },
  { chip: "반려동물", text: "출근하려는데 고양이가 가방 위에 앉아서 안 비켜준다", emoji: "🐾" },
  { chip: "연애 빙산", text: "3개월 만난 사람이 아직 내 생일을 모른다", emoji: "💔" },
];

export interface NewEpisodeFormProps {
  allSeries: SeriesSummary[];
  initialSeriesId: string | null;
}

export function NewEpisodeForm({ allSeries, initialSeriesId }: NewEpisodeFormProps) {
  const router = useRouter();
  const [seriesList, setSeriesList] = useState<SeriesSummary[]>(allSeries);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(
    initialSeriesId ?? (allSeries[0]?.id || null)
  );
  const [openNewSeriesModal, setOpenNewSeriesModal] = useState(false);
  const [openSelectSeriesModal, setOpenSelectSeriesModal] = useState(false);

  const [story, setStory] = useState("");
  const [cutCount, setCutCount] = useState<number>(4);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 이미지(카톡 캡처 등) 업로드 및 AI 사연 추출 상태
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);

  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId) ?? null;

  async function handleImageFile(file: File) {
    if (!file) return;
    setVisionError(null);
    setAnalyzingImage(true);
    setUploadedImageName(file.name);

    const previewUrl = URL.createObjectURL(file);
    setUploadedImagePreview(previewUrl);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await extractStoryFromImageAction(formData);
      if (res.ok) {
        setStory(res.story);
      } else {
        setVisionError(res.message);
      }
    } catch {
      setVisionError("이미지 분석 중 문제가 발생했습니다.");
    } finally {
      setAnalyzingImage(false);
    }
  }

  function handleCreate() {
    if (!story.trim()) return;
    setError(null);
    start(async () => {
      const res = await startEpisodeAction({
        story: story.trim(),
        cutCount,
        seriesId: selectedSeriesId ?? undefined,
      });
      if (res.ok) {
        router.push(`/episodes/${res.episodeId}/storyboard`);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. 시리즈 선택 섹션 (2대 선택 카드: 새 시리즈 만들기 vs 기존 시리즈 불러오기) */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand-tint text-brand">
            <BookOpen className="size-4" />
          </span>
          <h2 className="text-title font-semibold text-ink">연재할 작품</h2>
        </div>

        {/* 2대 선택 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setOpenNewSeriesModal(true)}
            className="flex items-center gap-3.5 rounded-xl border border-dashed border-border-control p-4 text-left transition-all hover:border-brand hover:bg-brand-tint/20 cursor-pointer group"
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-tint text-brand group-hover:scale-105 transition-transform">
              <Plus className="size-5 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="text-body font-bold text-ink group-hover:text-brand transition-colors">
                새 작품 만들기
              </span>
              <span className="text-caption text-ink-muted">
                새 화풍과 규칙으로 새로운 이야기 시작
              </span>
            </div>
          </button>

          <button
            type="button"
            disabled={seriesList.length === 0}
            onClick={() => setOpenSelectSeriesModal(true)}
            className={cn(
              "flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all cursor-pointer group",
              seriesList.length === 0
                ? "border-border/60 bg-surface-sunken/40 opacity-50 cursor-not-allowed"
                : "border-border/80 bg-surface-card hover:border-brand hover:bg-surface-sunken/40"
            )}
          >
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-ink-muted group-hover:text-ink transition-colors">
              <BookOpen className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-body font-bold text-ink">
                기존 작품 불러오기
              </span>
              <span className="text-caption text-ink-muted">
                {seriesList.length > 0 ? `${seriesList.length}개 작품 중 선택` : "등록된 기존 작품 없음"}
              </span>
            </div>
          </button>
        </div>

        {/* 현재 선택된 시리즈 안내 카드 */}
        {selectedSeries ? (
          <div className="flex items-center justify-between rounded-xl border border-brand/40 bg-brand-tint/30 p-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-on-brand font-bold text-caption">
                {selectedSeries.title[0]}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body font-bold text-ink truncate">
                    {selectedSeries.title}
                  </span>
                  <Badge tone="brand" className="text-[10px]">
                    {selectedSeries.episodeCount}화 연재 중
                  </Badge>
                </div>
                <span className="text-[11px] text-ink-muted truncate">
                  이 작품의 고정 소재 및 화풍 규칙이 회차에 적용돼요.
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpenSelectSeriesModal(true)}
              className="shrink-0 text-caption font-semibold"
            >
              작품 변경
            </Button>
          </div>
        ) : (
          <p className="text-caption text-ink-muted">
            작품을 선택하지 않으면 사연 내용으로 임시 작품이 자동 생성됩니다.
          </p>
        )}
      </div>

      {/* 1. 새 시리즈 만들기 모달 */}
      <SeriesFormModal
        open={openNewSeriesModal}
        onClose={() => setOpenNewSeriesModal(false)}
        sheetOnMobile={false}
        onCreated={(newS) => {
          const created: SeriesSummary = {
            id: newS.id,
            title: newS.title,
            description: null,
            isPublic: true,
            episodeCount: 0,
            updatedAt: new Date().toISOString(),
          };
          setSeriesList((prev) => [created, ...prev]);
          setSelectedSeriesId(newS.id);
        }}
      />

      {/* 2. 기존 시리즈 불러오기 모달 */}
      <Modal
        open={openSelectSeriesModal}
        onClose={() => setOpenSelectSeriesModal(false)}
        sheetOnMobile={false}
        title="작품 불러오기"
        description="이어서 연재할 작품을 선택해 주세요."
        footer={
          <Button variant="secondary" onClick={() => setOpenSelectSeriesModal(false)}>
            닫기
          </Button>
        }
      >
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto p-1.5 -m-1.5">
          {seriesList.map((s) => {
            const isSelected = selectedSeriesId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedSeriesId(s.id);
                  setOpenSelectSeriesModal(false);
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer focus:outline-none",
                  isSelected
                    ? "border-brand bg-brand-tint/50 shadow-xs ring-2 ring-brand/30"
                    : "border-border/80 bg-surface-card hover:border-brand/60 hover:bg-surface-sunken/40"
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-body font-bold text-ink">{s.title}</span>
                    <Badge tone={isSelected ? "brand" : "neutral"} className="text-[10px]">
                      {s.episodeCount}화
                    </Badge>
                  </div>
                  {s.description && (
                    <span className="text-caption text-ink-muted line-clamp-1">{s.description}</span>
                  )}
                </div>
                {isSelected && <Check className="size-5 text-brand stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      </Modal>

      {/* 2. 사연 입력 섹션 */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-title font-semibold text-ink">사연 내용</h2>
          <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-brand/40 bg-brand-tint px-3 py-1.5 text-caption font-bold text-brand hover:bg-brand-hover hover:text-white transition-all shadow-2xs">
            <Camera className="size-3.5" />
            <span>카톡/글 캡처 올리기</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={analyzingImage}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
              }}
            />
          </label>
        </div>

        {/* 첨부된 이미지 미리보기 & 분석 상태 */}
        {uploadedImagePreview && (
          <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand-tint/20 p-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadedImagePreview}
                alt="첨부된 캡처"
                className="size-14 rounded-lg object-cover border border-border/80 shrink-0 shadow-2xs"
              />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-ink truncate">
                    {uploadedImageName}
                  </span>
                  {analyzingImage && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand animate-pulse">
                      <Sparkles className="size-3 animate-spin" />
                      AI 텍스트 추출 중...
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-ink-muted leading-tight">
                  {analyzingImage
                    ? "카톡 대화와 글 내용을 AI가 읽어 사연 텍스트로 자동 변환하고 있어요."
                    : "이미지 속 대화와 사연을 추출했습니다. 내용을 확인하고 자유롭게 수정해 보세요!"}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={analyzingImage}
              onClick={() => {
                setUploadedImagePreview(null);
                setUploadedImageName(null);
              }}
              className="text-caption font-medium text-ink-muted hover:text-danger px-2 py-1 cursor-pointer transition-colors shrink-0"
            >
              삭제
            </button>
          </div>
        )}

        {visionError && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-tint px-3 py-2 text-caption text-danger">
            <AlertCircle className="size-4 shrink-0" />
            <span>{visionError}</span>
          </div>
        )}

        <Field
          label=""
          multiline
          rows={6}
          value={story}
          onChange={setStory}
          placeholder="이번 회차에서 다룰 재미있는 에피소드나 대화를 적어주세요. 카톡 대화 형식도 가능해요!&#10;(우측 상단의 '카톡/글 캡처 올리기'로 스크린샷을 올리면 AI가 자동으로 읽어드려요)"
          help="콘티 생성은 크레딧을 소모하지 않습니다."
          maxLength={1000}
        />

        {/* 추천 소재 칩 */}
        <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-label font-semibold text-ink">
            <Lightbulb className="size-4 text-warning" />
            <span>추천 에피소드 소재</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e.chip}
                type="button"
                onClick={() => setStory(e.text)}
                className="flex items-center gap-1.5 rounded-full border border-border/80 bg-surface-sunken/60 px-3.5 py-1.5 text-label text-ink-muted hover:border-brand hover:text-ink transition-all cursor-pointer"
              >
                <span>{e.emoji}</span>
                <span>{e.chip}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. 컷 수 선택 섹션 (4~10컷) */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
              <Layers className="size-4" />
            </span>
            <h2 className="text-title font-semibold text-ink">컷 수 선택 (4~10컷)</h2>
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
                onClick={() => setCutCount(c.count)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 rounded-xl border p-2.5 text-center transition-all cursor-pointer",
                  isSelected
                    ? "border-brand bg-brand-tint/50 shadow-xs ring-2 ring-brand/30"
                    : "border-border/80 bg-surface-sunken/40 hover:border-border-control"
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

        {/* 직접 컷 수 조절 스텝퍼 (4 ~ 10컷) */}
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-sunken/40 p-3">
          <span className="text-caption font-medium text-ink-muted">직접 컷 수 조절</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={cutCount <= EPISODE_CUTS_MIN}
              onClick={() => setCutCount(Math.max(EPISODE_CUTS_MIN, cutCount - 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-card text-body font-bold text-ink hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
            >
              −
            </button>
            <input
              type="number"
              min={EPISODE_CUTS_MIN}
              max={EPISODE_CUTS_MAX}
              value={cutCount}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val >= EPISODE_CUTS_MIN && val <= EPISODE_CUTS_MAX) setCutCount(val);
              }}
              className="w-14 text-center font-bold text-title text-ink rounded-md border border-border bg-surface-card py-1 focus:border-brand focus:outline-hidden"
            />
            <button
              type="button"
              disabled={cutCount >= EPISODE_CUTS_MAX}
              onClick={() => setCutCount(Math.min(EPISODE_CUTS_MAX, cutCount + 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-card text-body font-bold text-ink hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-body-sm text-danger">{error}</p>}

      {/* 4. 액션 버튼 */}
      <Button
        size="lg"
        block
        loading={pending}
        disabled={!story.trim()}
        onClick={handleCreate}
        className="gap-2 shadow-xs font-bold text-body"
      >
        <Sparkles className="size-4.5" />
        콘티 만들기 (무료)
      </Button>
    </div>
  );
}
