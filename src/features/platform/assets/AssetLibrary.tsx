"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, Edit3, Trash2, Film, Folder } from "lucide-react";
import { cn } from "@/lib/cn";
import { AssetCard, Badge, Button, EmptyState, Modal, Tabs } from "@/components/ui";
import { deleteAssetAction, toggleSeriesAssetAction } from "@/features/platform/actions";
import type { Asset, AssetKind } from "@/features/platform/data/types";
import { AssetFormModal } from "./AssetFormModal";

const LABEL: Record<AssetKind, string> = {
  character: "캐릭터",
  location: "장소",
  prop: "소품",
  style: "스타일",
};

export interface SeriesOption {
  id: string;
  title: string;
  assetIds: string[];
}

export interface AssetLibraryProps {
  assets: Asset[];
  counts: Record<AssetKind, number>;
  order: AssetKind[];
  seriesList?: SeriesOption[];
  initialSeriesId?: string | null;
}

export function AssetLibrary({
  assets,
  counts: initialCounts,
  order,
  seriesList = [],
  initialSeriesId = null,
}: AssetLibraryProps) {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(initialSeriesId);
  const [seriesState, setSeriesState] = useState<SeriesOption[]>(seriesList);
  const [tab, setTab] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const [form, setForm] = useState<{ open: boolean; asset: Asset | null }>({
    open: false,
    asset: null,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const [togglingSeries, startToggleSeries] = useTransition();

  // Props 업데이트 시 동기화
  useEffect(() => {
    setSeriesState(seriesList);
  }, [seriesList]);

  const currentSeries = seriesState.find((s) => s.id === selectedSeriesId) ?? null;

  // 선택된 시리즈에 속한 에셋만 필터링 (선택 없으면 전체)
  const displayedAssets = currentSeries
    ? assets.filter((a) => currentSeries.assetIds.includes(a.id))
    : assets;

  // 현재 필터링 상태에 맞는 종류별 개수 재계산
  const displayedCounts: Record<AssetKind, number> = {
    character: displayedAssets.filter((a) => a.kind === "character").length,
    location: displayedAssets.filter((a) => a.kind === "location").length,
    prop: displayedAssets.filter((a) => a.kind === "prop").length,
    style: displayedAssets.filter((a) => a.kind === "style").length,
  };

  const kind = order[tab];
  const shown = displayedAssets.filter((a) => a.kind === kind);
  const picked = pickedId ? (displayedAssets.find((a) => a.id === pickedId) ?? null) : null;

  function handleSelectSeries(seriesId: string | null) {
    setSelectedSeriesId(seriesId);
    setPickedId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (seriesId) {
        url.searchParams.set("series", seriesId);
      } else {
        url.searchParams.delete("series");
      }
      window.history.replaceState({}, "", url.toString());
    }
  }

  function handleToggleSeries(seriesId: string, assetId: string, attach: boolean) {
    startToggleSeries(async () => {
      // 즉각적인 낙관적 업데이트
      setSeriesState((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const newIds = attach
            ? [...s.assetIds.filter((id) => id !== assetId), assetId]
            : s.assetIds.filter((id) => id !== assetId);
          return { ...s, assetIds: newIds };
        }),
      );

      const r = await toggleSeriesAssetAction(seriesId, assetId, attach);
      if (!r.ok) {
        // 실패 시 복구
        setSeriesState((prev) =>
          prev.map((s) => {
            if (s.id !== seriesId) return s;
            const revertIds = !attach
              ? [...s.assetIds.filter((id) => id !== assetId), assetId]
              : s.assetIds.filter((id) => id !== assetId);
            return { ...s, assetIds: revertIds };
          }),
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-title-lg font-bold">에셋 라이브러리</h1>
          <p className="text-body-sm text-ink-muted">
            캐릭터, 장소, 소품을 등록하여 시리즈와 회차 간 작화 일관성을 유지하세요.
          </p>
        </div>
        <Button onClick={() => setForm({ open: true, asset: null })} className="gap-1.5 shadow-2xs">
          <Plus className="size-4" />
          에셋 추가
        </Button>
      </div>

      {/* 시리즈별 필터 탭 바 */}
      {seriesState.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-surface-card p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold text-ink-muted flex items-center gap-1.5">
              <Folder className="size-3.5 text-brand" />
              시리즈별 에셋 보기
            </span>
            {currentSeries && (
              <span className="text-caption text-ink-subtle">
                <strong className="text-brand font-semibold">&lsquo;{currentSeries.title}&rsquo;</strong> 에셋만 표시 중
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              type="button"
              onClick={() => handleSelectSeries(null)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-3 text-caption font-semibold transition-all shrink-0 cursor-pointer",
                selectedSeriesId === null
                  ? "bg-brand text-on-brand shadow-2xs font-bold"
                  : "border border-border/80 bg-surface-sunken/50 text-ink-muted hover:border-brand/40 hover:text-ink",
              )}
            >
              <span>전체 에셋</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] leading-tight font-medium",
                  selectedSeriesId === null ? "bg-white/25 text-white" : "bg-border text-ink-subtle",
                )}
              >
                {assets.length}
              </span>
            </button>
            {seriesState.map((s) => {
              const active = selectedSeriesId === s.id;
              const count = assets.filter((a) => s.assetIds.includes(a.id)).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSeries(s.id)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-caption font-semibold transition-all shrink-0 cursor-pointer",
                    active
                      ? "bg-brand text-on-brand shadow-2xs font-bold"
                      : "border border-border/80 bg-surface-sunken/50 text-ink-muted hover:border-brand/40 hover:text-ink",
                  )}
                >
                  <Folder className="size-3 opacity-80" />
                  <span>{s.title}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] leading-tight font-medium",
                      active ? "bg-white/25 text-white" : "bg-border text-ink-subtle",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 에셋 종류(캐릭터, 장소, 소품, 스타일) 탭 */}
      <Tabs
        value={tab}
        onChange={(i) => {
          setTab(i);
          setPickedId(null);
        }}
        items={order.map((k) => ({ label: LABEL[k], count: displayedCounts[k] }))}
      />

      <div className="w-full">
        {shown.length === 0 ? (
          <EmptyState
            title={
              currentSeries
                ? `‘${currentSeries.title}’에 등록된 ${LABEL[kind]} 에셋이 없어요`
                : `아직 등록한 ${LABEL[kind]} 에셋이 없어요`
            }
            description={
              currentSeries
                ? `이 시리즈의 모든 회차 생성 시 고정 레퍼런스로 활용할 ${LABEL[kind]}을 추가해 보세요.`
                : "한 번 등록해 두면 다음 화부터 자동으로 같이 그려져요."
            }
            actionLabel={currentSeries ? `‘${currentSeries.title}’에 ${LABEL[kind]} 추가` : "에셋 추가"}
            onAction={() => setForm({ open: true, asset: null })}
          />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {shown.map((a) => {
              const memberSeries = seriesState.filter((s) => s.assetIds.includes(a.id));
              return (
                <li key={a.id} className="relative">
                  <AssetCard
                    name={a.name}
                    kind={LABEL[a.kind]}
                    kindTone={a.kind === "character" ? "brand" : "neutral"}
                    usedIn={a.usedIn}
                    selected={picked?.id === a.id}
                    thumb={
                      a.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.thumbUrl} alt="" className="size-full object-cover" />
                      ) : undefined
                    }
                    onClick={() => setPickedId(a.id)}
                  />
                  {selectedSeriesId === null && memberSeries.length > 0 && (
                    <div className="pointer-events-none absolute top-2 right-2 flex max-w-[85%] justify-end">
                      <span className="truncate rounded-md border border-border/80 bg-surface-card/95 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted shadow-2xs backdrop-blur-xs">
                        📁 {memberSeries[0].title}
                        {memberSeries.length > 1 ? ` 외 ${memberSeries.length - 1}` : ""}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 에셋 상세 화면 중앙 모달 */}
      {picked && (
        <Modal
          open={Boolean(picked)}
          onClose={() => setPickedId(null)}
          size="md"
          title={picked.name}
          description={`${LABEL[picked.kind]} 에셋 상세 정보`}
          footer={
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmDelete(true);
                }}
                className="gap-1.5 text-ink-muted hover:text-danger hover:bg-danger-tint/30"
              >
                <Trash2 className="size-4" />
                삭제
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setPickedId(null)}>
                  닫기
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const target = picked;
                    setPickedId(null);
                    setForm({ open: true, asset: target });
                  }}
                  className="gap-1.5"
                >
                  <Edit3 className="size-4" />
                  수정
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-1">
            {picked.referenceUrls.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {picked.referenceUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={`레퍼런스 ${i + 1}`}
                    className={cn(
                      "aspect-square w-full rounded-lg border border-border/70 object-cover shadow-2xs",
                      i === 0 && "col-span-2 row-span-2",
                    )}
                  />
                ))}
              </div>
            ) : (
              <div className="grid h-36 place-items-center rounded-lg bg-surface-sunken px-4 text-center text-caption text-ink-subtle">
                {picked.kind === "character"
                  ? "캐릭터 시트 · 정면 / 측면 / 표정 4종 / 전신"
                  : "레퍼런스 이미지"}
              </div>
            )}

            {picked.description && (
              <div className="rounded-xl border border-border/70 bg-surface-sunken/40 p-3.5">
                <p className="text-body-sm text-ink leading-relaxed">{picked.description}</p>
              </div>
            )}

            {picked.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {picked.tags.map((t) => (
                  <Badge key={t} tone="neutral">{t}</Badge>
                ))}
              </div>
            )}

            {/* 소속 시리즈 지정/표시 */}
            {seriesState.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3.5">
                <div className="flex items-center gap-1.5 text-label font-semibold text-ink">
                  <Folder className="size-3.5 text-ink-muted" />
                  <span>소속 시리즈 (고정 에셋)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {seriesState.map((s) => {
                    const isMember = s.assetIds.includes(picked.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={togglingSeries}
                        onClick={() => handleToggleSeries(s.id, picked.id, !isMember)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-caption font-medium border transition-colors cursor-pointer",
                          isMember
                            ? "border-brand/50 bg-brand-tint text-brand font-semibold hover:border-brand"
                            : "border-border/80 bg-surface-sunken/40 text-ink-subtle hover:text-ink hover:border-border-control",
                        )}
                        title={
                          isMember
                            ? `${s.title}에서 제외하기`
                            : `${s.title}에 고정 에셋으로 추가하기`
                        }
                      >
                        <span className="text-[11px] font-bold">{isMember ? "✓" : "+"}</span>
                        <span>{s.title}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-caption text-ink-muted leading-relaxed">
                  클릭하여 이 에셋을 고정 레퍼런스로 사용할 시리즈를 켜거나 끌 수 있어요.
                </p>
              </div>
            )}

            {/* 에셋을 쓰는 회차 */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3.5">
              <div className="flex items-center gap-1.5 text-label font-semibold text-ink">
                <Film className="size-3.5 text-ink-muted" />
                <span>이 에셋을 쓰는 회차</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {picked.usedInEpisodes.length > 0 ? (
                  picked.usedInEpisodes.map((e) => (
                    <Badge key={e} tone="brand">{e}</Badge>
                  ))
                ) : (
                  <span className="text-caption text-ink-muted">아직 사용된 회차가 없어요.</span>
                )}
              </div>
              <p className="text-caption text-ink-muted leading-relaxed">
                에셋을 변경하면 이후 생성되는 새 회차부터 새 모습이 반영돼요.
              </p>
            </div>
          </div>
        </Modal>
      )}

      <AssetFormModal
        key={`${form.open}-${form.asset?.id ?? "new"}-${kind}-${selectedSeriesId ?? "all"}`}
        open={form.open}
        asset={form.asset}
        defaultKind={kind}
        seriesList={seriesState}
        defaultSeriesId={selectedSeriesId}
        onClose={() => setForm({ open: false, asset: null })}
      />

      {picked && (
        <Modal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          dismissible={!deleting}
          title={`${picked.name}을 지울까요?`}
          description={
            picked.usedIn > 0
              ? `${picked.usedIn}개 회차가 이 에셋을 쓰고 있어요.`
              : "되돌릴 수 없어요."
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                그대로 둘게요
              </Button>
              <Button
                variant="danger"
                loading={deleting}
                onClick={() =>
                  startDelete(async () => {
                    const r = await deleteAssetAction(picked.id);
                    if (r.ok) {
                      setConfirmDelete(false);
                      setPickedId(null);
                    } else {
                      setDeleteError(r.message);
                    }
                  })
                }
              >
                삭제
              </Button>
            </>
          }
        >
          {deleteError && <p className="text-body-sm text-danger">{deleteError}</p>}
        </Modal>
      )}
    </div>
  );
}
