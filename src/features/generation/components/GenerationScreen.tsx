"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  ChoiceCard,
  CutProgressGrid,
  Field,
  Tabs,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { CREDIT_COST } from "@/contracts/credit";
import {
  CREDIT_REASON_BY_INTENT,
  CUT_EDIT_INTENT_LABEL,
  summarizeJob,
  type CutEditIntent,
  type GenerationJob,
  type GenerationJobCut,
} from "@/contracts/generation";
import { MAX_AUTO_ATTEMPTS } from "../mocks/job";
import { MOCK_STORYBOARD } from "../mocks/storyboard";
import { EpisodeHeader } from "./EpisodeHeader";

/** 한 컷 모드에서 고를 수 있는 동작. 마스크는 모델이 지원할 때만 보인다. */
const SINGLE_CUT_INTENTS: CutEditIntent[] = [
  "regenerate",
  "keep_composition_change_expression",
  "replace_background",
];

const INTENT_RESULT: Record<CutEditIntent, string> = {
  regenerate: "구도까지 전부 새로 뽑아요. 지금 결과가 마음에 안 들 때.",
  keep_composition_change_expression: "구도와 배경은 그대로 두고 표정만 바꿔요.",
  replace_background: "인물은 그대로 두고 배경만 갈아요.",
  inpaint_mask: "고를 영역만 다시 그려요.",
};

export interface GenerationScreenProps {
  initial: GenerationJob;
  /** ImageGenerator.supportsInpainting() 의 값. 오픈 이슈 3 결과에 따라 꺼진다. */
  supportsInpainting?: boolean;
}

/** PRD 3.1 — 콘티 기반 이미지 생성. 컷 단위 진행과 실패 재시도가 이 화면의 일이다. */
export function GenerationScreen({
  initial,
  supportsInpainting = false,
}: GenerationScreenProps) {
  const router = useRouter();
  const [job, setJob] = useState(initial);
  const [tab, setTab] = useState(0);
  const [pickedCut, setPickedCut] = useState(initial.cuts[0]?.cutId ?? "");
  const [intent, setIntent] = useState<CutEditIntent>("regenerate");

  const s = summarizeJob(job);
  const doneCuts = job.cuts.filter((c) => c.status === "done");
  const failedCuts = job.cuts.filter((c) => c.status === "failed");

  /** 실패한 컷만 다시 큐에 넣는다. 성공한 컷은 손대지 않는다. */
  function retryFailed() {
    setJob((j) => ({
      ...j,
      status: "running",
      cuts: j.cuts.map((c) =>
        c.status === "failed"
          ? { ...c, status: "queued", error: undefined, attempt: c.attempt + 1 }
          : c,
      ),
    }));
  }

  function retryOne(cutId: string) {
    setJob((j) => ({
      ...j,
      status: "running",
      cuts: j.cuts.map((c) =>
        c.cutId === cutId
          ? { ...c, status: "queued", error: undefined, attempt: c.attempt + 1 }
          : c,
      ),
    }));
  }

  const intents = supportsInpainting
    ? [...SINGLE_CUT_INTENTS, "inpaint_mask" as const]
    : SINGLE_CUT_INTENTS;

  const singleCost =
    CREDIT_REASON_BY_INTENT[intent] === "cut_image"
      ? CREDIT_COST.cutImage
      : CREDIT_COST.partialRegenerate;

  return (
    <div className="min-h-dvh bg-surface-page">
      <EpisodeHeader
        episodeId={job.episodeId}
        seriesTitle="퇴근길 기록"
        episodeTitle="1화 · 퇴근 10분 전"
        current="generate"
        credits={12}
        action={
          <Button
            size="sm"
            disabled={doneCuts.length === 0}
            onClick={() => router.push(`/episodes/${job.episodeId}/editor`)}
          >
            편집기로
          </Button>
        }
      />

      <main className="mx-auto flex max-w-[1080px] flex-col gap-4 p-4">
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-card p-6">
          <Tabs
            items={[
              { label: "에이전트 모드", count: job.cuts.length },
              { label: "한 컷 모드" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === 0 ? (
            <>
              <CutProgressGrid
                cuts={job.cuts.map((c) => ({ status: c.status, progress: c.progress }))}
                title={
                  s.running > 0 || s.queued > 0
                    ? `이미지 만드는 중 · ${s.percent}%`
                    : "생성 끝"
                }
                onRetry={retryFailed}
              />
              <p className="text-caption text-ink-subtle">
                이 화면을 닫아도 생성은 계속돼요. 끝나면 알려드릴게요.
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-body-sm text-ink-muted">
                컷 하나만 골라서 다시 만들어요. 나머지 컷 결과는 그대로 둡니다.
              </p>

              <div className="flex flex-col gap-2">
                <span className="text-label font-semibold">컷 고르기</span>
                <div className="flex flex-wrap gap-2">
                  {job.cuts.map((c) => (
                    <button
                      key={c.cutId}
                      type="button"
                      onClick={() => setPickedCut(c.cutId)}
                      className={cn(
                        "h-control-sm cursor-pointer rounded-md px-3 text-label font-semibold tabular-nums",
                        c.cutId === pickedCut
                          ? "bg-brand text-on-brand"
                          : "bg-surface-sunken text-ink-muted hover:text-ink",
                      )}
                    >
                      {c.index}컷
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {intents.map((it) => (
                  <ChoiceCard
                    key={it}
                    title={CUT_EDIT_INTENT_LABEL[it]}
                    description={INTENT_RESULT[it]}
                    selected={intent === it}
                    onClick={() => setIntent(it)}
                  />
                ))}
              </div>

              {!supportsInpainting && (
                <p className="rounded-lg bg-surface-sunken px-3 py-2 text-caption text-ink-muted">
                  선택 영역만 다시 그리기는 모델 검증(오픈 이슈 3)이 끝나면 열립니다.
                </p>
              )}

              <Field
                label="어떻게 바꿀까요"
                multiline
                rows={3}
                placeholder="표정을 조금 더 지쳐 보이게"
                help="시리즈 그림체와 캐릭터는 자동으로 붙어요. 여기엔 바꿀 것만 적으세요."
                maxLength={200}
              />

              <Button cost={singleCost} block>
                이 컷만 다시 만들기
              </Button>
            </div>
          )}
        </section>

        {failedCuts.length > 0 && (
          <section className="flex flex-col gap-3 rounded-xl border border-danger bg-danger-tint p-4">
            <h2 className="text-label font-semibold text-danger">
              못 만든 컷 {failedCuts.length}개
            </h2>
            <ul className="flex flex-col gap-2">
              {failedCuts.map((c) => (
                <li
                  key={c.cutId}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-card px-3 py-2"
                >
                  <span className="text-label font-bold tabular-nums">{c.index}컷</span>
                  <span className="min-w-0 flex-1 text-body-sm text-ink-muted">
                    {c.error}
                  </span>
                  {c.attempt > MAX_AUTO_ATTEMPTS && (
                    <Badge tone="warning">{c.attempt}번 시도함</Badge>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => retryOne(c.cutId)}>
                    다시
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-caption text-ink-muted">
              쓴 크레딧 {failedCuts.length}개는 이미 돌려드렸어요. 다시 만들 때 새로 차감돼요.
            </p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-label font-semibold text-ink">
            먼저 끝난 컷 {doneCuts.length}개
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {job.cuts.map((c) => (
              <CutTile
                key={c.cutId}
                cut={c}
                caption={MOCK_STORYBOARD.cuts[c.index - 1]?.scene ?? ""}
                onOpen={() => router.push(`/episodes/${job.episodeId}/editor`)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function CutTile({
  cut,
  caption,
  onOpen,
}: {
  cut: GenerationJobCut;
  caption: string;
  onOpen: () => void;
}) {
  const done = cut.status === "done" && cut.imageUrl;

  return (
    <figure className="flex flex-col gap-2">
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-lg border",
          done ? "border-border" : "border-dashed border-border-control bg-skeleton",
        )}
      >
        {done ? (
          // 목 데이터는 SVG data URI 다. 스토리지가 붙으면 next/image 로 바꾼다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cut.imageUrl} alt={`${cut.index}컷`} className="size-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-caption font-semibold text-ink-subtle">
            {cut.status === "running"
              ? `${cut.progress ?? 0}%`
              : cut.status === "failed"
                ? "실패"
                : "대기"}
          </span>
        )}
        <span className="absolute top-1 left-2 text-[11px] font-bold text-ink-muted mix-blend-difference">
          {cut.index}
        </span>
        {done && (
          <button
            type="button"
            onClick={onOpen}
            className="absolute inset-0 grid cursor-pointer place-items-center bg-overlay text-label font-semibold text-ink-inverse opacity-0 transition-opacity hover:opacity-100"
          >
            편집기에서 열기
          </button>
        )}
      </div>
      <figcaption className="line-clamp-2 text-caption text-ink-muted">{caption}</figcaption>
    </figure>
  );
}
