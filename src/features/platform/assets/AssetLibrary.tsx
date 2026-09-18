"use client";

import { useState } from "react";
import { AssetCard, Badge, Button, EmptyState, Tabs } from "@/components/ui";
import type { Asset, AssetKind } from "@/features/platform/data/types";

const LABEL: Record<AssetKind, string> = {
  character: "캐릭터",
  location: "장소",
  prop: "소품",
  style: "스타일",
};

export interface AssetLibraryProps {
  assets: Asset[];
  counts: Record<AssetKind, number>;
  order: AssetKind[];
}

export function AssetLibrary({ assets, counts, order }: AssetLibraryProps) {
  const [tab, setTab] = useState(0);
  const kind = order[tab];
  const shown = assets.filter((a) => a.kind === kind);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = shown.find((a) => a.id === pickedId) ?? shown[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title-lg font-bold">에셋 라이브러리</h1>
        <Button>에셋 추가</Button>
      </div>

      <Tabs
        value={tab}
        onChange={(i) => {
          setTab(i);
          setPickedId(null);
        }}
        items={order.map((k) => ({ label: LABEL[k], count: counts[k] }))}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {shown.length === 0 ? (
            <EmptyState
              title={`아직 등록한 ${LABEL[kind]} 에셋이 없어요`}
              description="한 번 등록해 두면 다음 화부터 자동으로 같이 그려져요."
              actionLabel="에셋 추가"
            />
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
              {shown.map((a) => (
                <li key={a.id}>
                  <AssetCard
                    name={a.name}
                    kind={LABEL[a.kind]}
                    kindTone={a.kind === "character" ? "brand" : "neutral"}
                    usedIn={a.usedIn}
                    onClick={() => setPickedId(a.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {picked && (
          <aside className="flex w-full shrink-0 flex-col gap-4 rounded-lg border border-border bg-surface-card p-5 lg:w-80">
            <div className="grid h-45 place-items-center rounded-md bg-skeleton px-4 text-center text-caption text-ink-subtle">
              {picked.kind === "character"
                ? "캐릭터 시트 · 정면 / 측면 / 표정 4종 / 전신"
                : "레퍼런스 이미지"}
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-title font-semibold">{picked.name}</h2>
              {picked.description && (
                <p className="text-body-sm text-ink-muted">{picked.description}</p>
              )}
            </div>

            {picked.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {picked.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            )}

            <div className="h-px bg-border" />

            {/* 에셋을 바꾸면 이 회차들의 일관성이 흔들린다. 고치기 전에 보여준다. */}
            <div className="flex flex-col gap-2">
              <h3 className="text-label font-semibold">이 에셋을 쓰는 회차</h3>
              <div className="flex flex-wrap gap-1.5">
                {picked.usedInEpisodes.map((e) => (
                  <Badge key={e}>{e}</Badge>
                ))}
              </div>
              <p className="text-caption text-ink-muted">
                바꾸면 이 회차들의 캐릭터가 달라 보일 수 있어요. 지난 회차는 그대로 두고 다음 화부터 적용해요.
              </p>
            </div>

            <Button variant="secondary" block>
              {picked.kind === "character" ? "시트 다시 만들기" : "레퍼런스 교체"}
            </Button>
          </aside>
        )}
      </div>
    </div>
  );
}
