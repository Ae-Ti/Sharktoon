"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Sparkles,
  Plus,
  Palette,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { SeriesFormModal } from "@/features/platform/series/SeriesFormModal";
import { startEpisodeDraftAction } from "@/features/platform/actions";
import type { SeriesSummary } from "@/features/platform/data/types";
import { cn } from "@/lib/cn";

export interface NewEpisodeSeriesSelectorProps {
  allSeries: SeriesSummary[];
}

export function NewEpisodeSeriesSelector({ allSeries }: NewEpisodeSeriesSelectorProps) {
  const router = useRouter();
  const [openNewSeriesModal, setOpenNewSeriesModal] = useState(false);
  const [pendingSeriesId, setPendingSeriesId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleSelectSeries(seriesId: string) {
    setError(null);
    setPendingSeriesId(seriesId);
    try {
      const res = await startEpisodeDraftAction({ seriesId });
      if (res.ok) {
        router.push(`/episodes/${res.episodeId}/storyboard?new=1`);
      } else {
        setError(res.message);
        setPendingSeriesId(null);
      }
    } catch {
      setError("에피소드를 시작하는 도중 오류가 발생했습니다. 다시 시도해 주세요.");
      setPendingSeriesId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 뒤로 가기 & 헤더 */}
      <div className="flex flex-col gap-2">
        <Link
          href="/home"
          className="inline-flex items-center gap-1.5 text-caption font-medium text-ink-muted hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft className="size-4" />
          <span>홈으로</span>
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-title-lg font-bold text-ink">새 인스타툰 만들기</h1>
          <p className="text-body-sm text-ink-muted">
            연재할 작품을 선택해 주세요. 새로운 시리즈를 시작하거나, 기존 작품의 다음 화를 이어서 그릴 수 있어요.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-tint p-4 text-body-sm text-danger shadow-2xs">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. 새 작품 만들기 카드 */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-brand/40 bg-gradient-to-br from-brand-tint/60 via-surface-card to-surface-card p-6 shadow-xs hover:border-brand/80 hover:shadow-md transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-on-brand shadow-2xs">
              <Sparkles className="size-6 stroke-[2.2]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-title font-bold text-ink">새 작품(시리즈) 만들기</h2>
                <Badge tone="brand" className="text-[11px] font-bold">
                  새 화풍 & 캐릭터
                </Badge>
              </div>
              <p className="text-body-sm text-ink-muted leading-relaxed">
                새로운 화풍 스타일이나 직접 올린 사진으로 커스텀 스타일을 만들고 1화를 시작해요.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-ink-muted">
                <span className="flex items-center gap-1">
                  <Palette className="size-3 text-brand" />
                  5가지 추천 화풍 & 사진 커스텀 화풍
                </span>
                <span>·</span>
                <span>1:1 / 4:5 인스타 최적 비율</span>
              </div>
            </div>
          </div>
          <Button
            size="md"
            variant="cta"
            disabled={pendingSeriesId !== null}
            onClick={() => setOpenNewSeriesModal(true)}
            className="shrink-0 font-bold gap-2 self-start sm:self-center px-5 shadow-xs"
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>새 작품 만들기</span>
          </Button>
        </div>
      </div>

      {/* 2. 기존 작품 이어 그리기 섹션 */}
      <div className="flex flex-col gap-3.5 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-sunken text-ink">
              <BookOpen className="size-4" />
            </span>
            <h2 className="text-title font-bold text-ink">기존 작품에서 이어 그리기</h2>
            <span className="text-caption font-bold text-ink-muted">
              ({allSeries.length})
            </span>
          </div>
        </div>

        {allSeries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center bg-surface-card">
            <BookOpen className="size-8 text-ink-muted/50" />
            <div className="flex flex-col gap-1">
              <p className="text-body font-bold text-ink">아직 등록된 작품이 없습니다.</p>
              <p className="text-caption text-ink-muted">
                위의 '새 작품 만들기' 버튼을 눌러 첫 번째 인스타툰 시리즈를 시작해 보세요!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {allSeries.map((s) => {
              const isPending = pendingSeriesId === s.id;
              const nextEpisodeNumber = s.episodeCount + 1;

              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={pendingSeriesId !== null}
                  onClick={() => handleSelectSeries(s.id)}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all cursor-pointer",
                    "border-border/80 bg-surface-card hover:border-brand hover:bg-brand-tint/15 hover:shadow-xs",
                    "focus:outline-none focus:ring-2 focus:ring-brand/40",
                    isPending && "border-brand bg-brand-tint/30 ring-2 ring-brand/40",
                    pendingSeriesId !== null && !isPending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="flex flex-col gap-2.5 w-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-on-brand font-bold text-body shadow-2xs group-hover:scale-105 transition-transform">
                          {s.title[0] || "툰"}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-body font-bold text-ink truncate group-hover:text-brand transition-colors">
                            {s.title}
                          </span>
                          <span className="text-caption text-ink-muted">
                            현재 {s.episodeCount}화 연재 중
                          </span>
                        </div>
                      </div>
                      <Badge tone="brand" className="shrink-0 text-[11px] font-bold">
                        {nextEpisodeNumber}화 시작
                      </Badge>
                    </div>

                    {s.description && (
                      <p className="text-caption text-ink-muted line-clamp-2 leading-relaxed">
                        {s.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/50 text-caption font-semibold">
                    <span className="text-ink-muted text-[12px]">
                      기존 캐릭터 및 화풍 적용
                    </span>
                    <span className="flex items-center gap-1 text-brand group-hover:translate-x-0.5 transition-transform">
                      {isPending ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>회차 준비 중...</span>
                        </>
                      ) : (
                        <>
                          <span>이어 그리기</span>
                          <ArrowRight className="size-3.5 stroke-[2.5]" />
                        </>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 새 작품 생성 모달 */}
      <SeriesFormModal
        open={openNewSeriesModal}
        onClose={() => setOpenNewSeriesModal(false)}
        sheetOnMobile={false}
        onCreated={(newS) => {
          setOpenNewSeriesModal(false);
          startTransition(async () => {
            await handleSelectSeries(newS.id);
          });
        }}
      />
    </div>
  );
}

