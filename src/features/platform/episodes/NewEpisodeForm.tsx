"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BookOpen, Layers, Lightbulb, Sparkles, Plus, Check } from "lucide-react";
import { Button, Field, Badge, Modal } from "@/components/ui";
import { startEpisodeAction } from "@/features/platform/actions";
import { SeriesFormModal } from "@/features/platform/series/SeriesFormModal";
import type { SeriesSummary } from "@/features/platform/data/types";
import { cn } from "@/lib/cn";

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

  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId) ?? null;

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
          <h2 className="text-title font-semibold text-ink">연재할 시리즈</h2>
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
                새 시리즈 만들기
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
                기존 시리즈 불러오기
              </span>
              <span className="text-caption text-ink-muted">
                {seriesList.length > 0 ? `${seriesList.length}개 시리즈 중 선택` : "등록된 기존 시리즈 없음"}
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
                  이 시리즈의 고정 에셋 및 화풍 규칙이 회차에 적용돼요.
                </span>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpenSelectSeriesModal(true)}
              className="shrink-0 text-caption font-semibold"
            >
              시리즈 변경
            </Button>
          </div>
        ) : (
          <p className="text-caption text-ink-muted">
            시리즈를 선택하지 않으면 사연 내용으로 임시 시리즈가 자동 생성됩니다.
          </p>
        )}
      </div>

      {/* 1. 새 시리즈 만들기 모달 */}
      <SeriesFormModal
        open={openNewSeriesModal}
        onClose={() => setOpenNewSeriesModal(false)}
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
        title="시리즈 불러오기"
        description="이어서 연재할 시리즈를 선택해 주세요."
        footer={
          <Button variant="secondary" onClick={() => setOpenSelectSeriesModal(false)}>
            닫기
          </Button>
        }
      >
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
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
                  "flex items-center justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer",
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
        <Field
          label="사연 내용"
          multiline
          rows={5}
          value={story}
          onChange={setStory}
          placeholder="이번 회차에서 다룰 재미있는 에피소드나 대화를 적어주세요. (카카오톡 대화 형식도 가능해요)"
          help="콘티 생성은 크레딧을 소모하지 않습니다."
          maxLength={500}
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

      {/* 3. 컷 수 선택 섹션 (1~20컷 자유 선택) */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface-card p-5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-sunken text-ink-muted">
              <Layers className="size-4" />
            </span>
            <h2 className="text-title font-semibold text-ink">컷 수 선택 (최대 20컷)</h2>
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

        {/* 직접 컷 수 조절 스텝퍼 (1 ~ 20컷) */}
        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-sunken/40 p-3">
          <span className="text-caption font-medium text-ink-muted">직접 컷 수 조절</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={cutCount <= 1}
              onClick={() => setCutCount(Math.max(1, cutCount - 1))}
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-card text-body font-bold text-ink hover:bg-surface-sunken disabled:opacity-30 cursor-pointer"
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
                if (val >= 1 && val <= 20) setCutCount(val);
              }}
              className="w-14 text-center font-bold text-title text-ink rounded-md border border-border bg-surface-card py-1 focus:border-brand focus:outline-hidden"
            />
            <button
              type="button"
              disabled={cutCount >= 20}
              onClick={() => setCutCount(Math.min(20, cutCount + 1))}
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
