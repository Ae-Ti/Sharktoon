"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, Edit3, Trash2, Film, Folder, ChevronDown, Palette } from "lucide-react";
import { cn } from "@/lib/cn";
import { AssetCard, Badge, Button, EmptyState, Modal, Tabs } from "@/components/ui";
import { deleteAssetAction, toggleSeriesAssetAction } from "@/features/platform/actions";
import type { Asset, AssetKind } from "@/features/platform/data/types";
import { AssetFormModal } from "./AssetFormModal";

const LABEL: Record<AssetKind, string> = {
  character: "인물 / 캐릭터",
  location: "배경 (장소)",
  prop: "소품",
  style: "스타일",
};

export interface SeriesOption {
  id: string;
  title: string;
  assetIds: string[];
  stylePreset?: string;
  customStyleImageUrl?: string | null;
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

  // 선택된 작품에 속한 소재만 필터링 (선택 없으면 전체)
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

  const kind = order[tab] || order[0];
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
          <h1 className="text-title-lg font-bold">소재 보관함</h1>
          <p className="text-body-sm text-ink-muted">
            인물, 반려동물, 배경, 소품을 등록하여 작품과 회차 간 작화 일관성을 완벽히 유지하세요.
          </p>
        </div>
        <Button onClick={() => setForm({ open: true, asset: null })} className="gap-1.5 shadow-2xs">
          <Plus className="size-4" />
          소재 추가
        </Button>
      </div>

      {/* 작품별 소재 보기 드롭다운 & 화풍 안내 바 */}
      {seriesState.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface-card p-4 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                <Folder className="size-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-caption font-bold text-ink">작품별 소재 보기</span>
                <span className="text-[11px] text-ink-subtle">
                  작품을 선택하면 해당 작품의 소재만 모아보고, 추가 시 자동으로 해당 작품에 저장됩니다.
                </span>
              </div>
            </div>

            {/* 드롭다운 셀렉터 */}
            <div className="relative min-w-[270px]">
              <select
                value={selectedSeriesId ?? ""}
                onChange={(e) => handleSelectSeries(e.target.value ? e.target.value : null)}
                className="w-full appearance-none rounded-xl border border-border-control bg-surface-sunken/60 py-2.5 pl-3.5 pr-10 text-body-sm font-semibold text-ink transition-all hover:border-brand/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 cursor-pointer"
              >
                <option value="">📂 전체 작품 소재 보기 (총 {assets.length}개)</option>
                {seriesState.map((s) => {
                  const count = assets.filter((a) => s.assetIds.includes(a.id)).length;
                  return (
                    <option key={s.id} value={s.id}>
                      📁 {s.title} ({count}개 소재 · {s.stylePreset || "심플 라인"})
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-muted">
                <ChevronDown className="size-4" />
              </div>
            </div>
          </div>

          {/* 선택된 작품이 있을 때: 고정 화풍 및 작품 설정 바로가기 안내 */}
          {currentSeries && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-tint/60 border border-brand/20 px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-caption">
                <Palette className="size-4 text-brand shrink-0" />
                <span className="text-ink">
                  <strong className="font-bold text-brand">&lsquo;{currentSeries.title}&rsquo;</strong>의 고정 화풍:{" "}
                  <span className="rounded-md bg-white/80 px-2 py-0.5 font-bold text-brand shadow-3xs border border-brand/30">
                    {currentSeries.stylePreset || "심플 라인"}
                  </span>
                </span>
                <span className="text-ink-muted hidden sm:inline">· 모든 소재는 이 화풍과 통일되어 생성됩니다.</span>
              </div>
              <a
                href={`/series/${currentSeries.id}`}
                className="text-caption font-semibold text-brand hover:underline inline-flex items-center gap-1"
              >
                작품 설정에서 화풍 변경 ➔
              </a>
            </div>
          )}
        </div>
      )}

      {/* 소재 종류(인물/캐릭터, 배경, 소품) 탭 */}
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
                ? `‘${currentSeries.title}’에 등록된 ${LABEL[kind]} 소재가 없어요`
                : `아직 등록한 ${LABEL[kind]} 소재가 없어요`
            }
            description={
              currentSeries
                ? `이 작품의 모든 회차 생성 시 고정 레퍼런스로 활용할 ${LABEL[kind]} 소재를 추가해 보세요.`
                : "한 번 등록해 두면 다음 화부터 자동으로 같이 그려져요."
            }
            actionLabel={currentSeries ? `‘${currentSeries.title}’에 ${LABEL[kind]} 추가` : "소재 추가"}
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

      {/* 소재 상세 화면 모달 */}
      {picked && (
        <Modal
          open={Boolean(picked)}
          onClose={() => setPickedId(null)}
          size="md"
          title={picked.name}
          description={`${LABEL[picked.kind]} 상세 정보`}
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
            {picked.thumbUrl || picked.referenceUrls.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {(picked.referenceUrls.length > 0 ? picked.referenceUrls : [picked.thumbUrl!]).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={`${url}-${i}`}
                    src={url}
                    alt={`소재 이미지 ${i + 1}`}
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

            {/* 소속 작품 지정/표시 */}
            {seriesState.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3.5">
                <div className="flex items-center gap-1.5 text-label font-semibold text-ink">
                  <Folder className="size-3.5 text-ink-muted" />
                  <span>소속 작품 (고정 소재)</span>
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
                            : `${s.title}에 고정 소재로 추가하기`
                        }
                      >
                        <span className="text-[11px] font-bold">{isMember ? "✓" : "+"}</span>
                        <span>{s.title}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-caption text-ink-muted leading-relaxed">
                  클릭하여 이 소재를 고정 레퍼런스로 사용할 작품을 켜거나 끌 수 있어요.
                </p>
              </div>
            )}

            {/* 소재를 쓰는 회차 */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3.5">
              <div className="flex items-center gap-1.5 text-label font-semibold text-ink">
                <Film className="size-3.5 text-ink-muted" />
                <span>이 소재를 쓰는 회차</span>
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
                소재를 변경하면 이후 생성되는 새 회차부터 새 모습이 반영돼요.
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
          title={`${picked.name} 소재를 지울까요?`}
          description={
            picked.usedIn > 0
              ? `${picked.usedIn}개 회차가 이 소재를 쓰고 있어요.`
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
