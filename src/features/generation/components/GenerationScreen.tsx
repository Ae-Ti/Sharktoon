"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  UserX,
  ExternalLink,
  Wand2,
} from "lucide-react";
import {
  Badge,
  Button,
  ChoiceCard,
  CutProgressGrid,
  Field,
  Modal,
  Tabs,
} from "@/components/ui";
import { WebtoonComicViewer } from "@/components/ui/WebtoonComicViewer";
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
import {
  regenerateCutAction,
  retryFailedCutsAction,
  type ActionResult,
} from "../actions";
/** 이보다 많이 시도한 컷은 표시해 준다. 같은 컷이 계속 실패하면 장면을 고치는 게 낫다. */
const MAX_AUTO_ATTEMPTS = 2;
import { EpisodeHeader } from "./EpisodeHeader";
import { useJobPolling } from "./useJobPolling";

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
  initialBalance: number;
  /** 1화면 끝난 뒤 온보딩의 "첫 화 결과"로 보낸다. */
  episodeNumber: number;
  /** ImageGenerator.supportsInpainting() 의 값. 오픈 이슈 3 결과에 따라 꺼진다. */
  supportsInpainting?: boolean;
  /** 실제 모델 대신 목 생성기로 돌고 있는지. */
  usingMock?: boolean;
  seriesTitle: string;
  episodeTitle: string;
}

/** PRD 3.1 — 콘티 기반 이미지 생성. 컷 단위 진행과 실패 재시도가 이 화면의 일이다. */
export function GenerationScreen({
  initial,
  initialBalance,
  episodeNumber,
  supportsInpainting = false,
  usingMock = false,
  seriesTitle,
  episodeTitle,
}: GenerationScreenProps) {
  const router = useRouter();
  const { job, live, balance, refresh } = useJobPolling(initial, initialBalance);
  const [tab, setTab] = useState(0);
  const [pickedCut, setPickedCut] = useState(initial.cuts[0]?.cutId ?? "");
  const [intent, setIntent] = useState<CutEditIntent>("regenerate");
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<{ required: number; available: number } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const s = summarizeJob(job);
  const doneCuts = job.cuts.filter((c) => c.status === "done");
  const failedCuts = job.cuts.filter((c) => c.status === "failed");
  const refundedCount = failedCuts.filter((c) => c.refunded).length;
  const allDone = !live && doneCuts.length === job.cuts.length;
  const hasFaceRecognitionError = failedCuts.some(
    (c) =>
      c.error?.includes("얼굴 인식") ||
      c.error?.includes("facexlib") ||
      c.error?.includes("no face detected"),
  );

  /** 액션 결과를 화면 상태로 옮긴다. 크레딧 부족만 시트를 연다. */
  function handle<T>(result: ActionResult<T>, onSuccess?: () => void) {
    if (result.ok) {
      setNotice(null);
      // 끝난 잡은 폴링이 멈춰 있다. 다시 돌린 뒤 한 번 받아 오면 폴링이 다시 시작된다.
      void refresh();
      onSuccess?.();
      return;
    }
    if (result.kind === "credit") {
      setShortfall({ required: result.required, available: result.available });
      return;
    }
    setNotice(result.message);
  }

  const intents = supportsInpainting
    ? [...SINGLE_CUT_INTENTS, "inpaint_mask" as const]
    : SINGLE_CUT_INTENTS;

  const singleCost =
    CREDIT_REASON_BY_INTENT[intent] === "cut_image"
      ? (job.tier === "pro" ? CREDIT_COST.cutImagePro : CREDIT_COST.cutImage)
      : CREDIT_COST.partialRegenerate;

  return (
    <div className="min-h-dvh bg-surface-page">
      <EpisodeHeader
        episodeId={job.episodeId}
        seriesTitle={seriesTitle}
        episodeTitle={episodeTitle}
        current="generate"
        credits={balance}
        action={
          <div className="flex items-center gap-2">
            {doneCuts.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setViewerOpen(true)}
              >
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                웹툰 뷰어
              </Button>
            )}
            <Button
              size="sm"
              disabled={doneCuts.length === 0}
              onClick={() => router.push(`/episodes/${job.episodeId}/editor`)}
            >
              편집기로
            </Button>
          </div>
        }
      />

      <main className="mx-auto flex max-w-[1080px] flex-col gap-4 p-4">
        {usingMock && (
          <p className="rounded-lg bg-surface-sunken px-3 py-2 text-caption text-ink-muted">
            목 생성기로 돌고 있어요. 1차 모델이 정해지면(오픈 이슈 1) 그대로 갈아끼웁니다.
          </p>
        )}

        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Badge tone={job.tier === "pro" ? "brand" : "neutral"}>
              {job.tier === "pro" ? "💎 Pro ComfyUI 모드" : "⚡ 일반 Schnell 모드"}
            </Badge>
            <span className="text-body-sm font-medium text-ink">
              {job.tier === "pro"
                ? "상용급 고화질 (PuLID + LoRA + OpenPose) 엔진 가동 중"
                : "초고속 시안 확인 엔진 가동 중"}
            </span>
          </div>
          <span className="text-caption font-semibold text-brand">
            {job.tier === "pro" ? "컷당 2 크레딧" : "컷당 1 크레딧"}
          </span>
        </div>

        {notice && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-body-sm text-danger">{notice}</p>
        )}

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
                cuts={job.cuts.map((c) => ({
                  cutId: c.cutId,
                  index: c.index,
                  status: c.status,
                  progress: c.progress,
                  refunded: c.refunded,
                  imageUrl: c.imageUrl,
                }))}
                title={live ? `이미지 만드는 중 · ${s.percent}%` : "생성 끝"}
                onRetry={() =>
                  startTransition(async () =>
                    handle(await retryFailedCutsAction({ episodeId: job.episodeId, jobId: job.id })),
                  )
                }
                onCutClick={(c) => {
                  if (c.cutId) {
                    router.push(`/episodes/${job.episodeId}/editor?cut=${c.cutId}`);
                  }
                }}
              />
              {allDone ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-tint px-4 py-3">
                  <span className="flex-1 text-body font-semibold text-brand-ink">
                    {job.cuts.length}컷이 다 나왔어요.
                  </span>
                  <Button
                    size="md"
                    className="font-bold shadow-xs"
                    onClick={() => router.push(`/episodes/${job.episodeId}/editor`)}
                  >
                    대사 다듬으러 가기
                  </Button>
                </div>
              ) : (
                <p className="text-caption text-ink-subtle">
                  이 화면을 닫아도 생성은 계속돼요. 홈의 &ldquo;이어서 만들기&rdquo;에서 다시 볼 수 있어요.
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-body-sm text-ink-muted">
                수정할 컷을 선택해 프롬프트나 옵션으로 다시 생성해요.
              </p>

              {/* 한 컷 모드에서도 모든 컷의 실제 생성 이미지를 보면서 클릭 선택 */}
              <div className="flex flex-col gap-2.5">
                <span className="text-label font-bold text-ink">수정할 컷 선택</span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                  {job.cuts.map((c) => {
                    const isSelected = c.cutId === pickedCut;
                    const isDone = c.status === "done" && Boolean(c.imageUrl);
                    return (
                      <div
                        key={c.cutId}
                        onClick={() => setPickedCut(c.cutId)}
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-xl border-2 cursor-pointer transition-all",
                          isSelected
                            ? "border-brand ring-4 ring-brand/20 shadow-md scale-[1.02]"
                            : "border-border/80 bg-surface-card hover:border-brand/50 hover:shadow-xs",
                        )}
                      >
                        {isDone ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.imageUrl!}
                            alt={`${c.index}컷`}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center bg-surface-sunken/40 text-caption text-ink-subtle">
                            {c.status === "running" ? "생성 중..." : c.status === "failed" ? "생성 실패" : "대기 중"}
                          </div>
                        )}
                        <span
                          className={cn(
                            "absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[11px] font-extrabold shadow-2xs tabular-nums",
                            isSelected
                              ? "bg-brand text-white"
                              : isDone
                                ? "bg-black/60 text-white backdrop-blur-xs"
                                : "bg-surface-card/90 text-ink-muted border border-border/80",
                          )}
                        >
                          {c.index}컷
                        </span>
                        {isSelected && (
                          <span className="absolute bottom-2 right-2 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                            선택됨
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-label font-bold text-ink">수정 방식</span>
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
              </div>

              <Field
                label="어떻게 바꿀까요"
                multiline
                rows={3}
                value={prompt}
                onChange={setPrompt}
                placeholder="표정을 조금 더 지쳐 보이게, 혹은 배경을 카페로 변경"
                help="시리즈 그림체와 캐릭터는 자동으로 유지돼요. 여기엔 바꿀 것만 적으세요."
                maxLength={200}
              />

              <Button
                cost={singleCost}
                block
                size="md"
                className="font-bold"
                loading={pending}
                disabled={!pickedCut}
                onClick={() =>
                  startTransition(async () => {
                    const res = await regenerateCutAction({
                      episodeId: job.episodeId,
                      jobId: job.id,
                      cutId: pickedCut,
                      intent,
                      prompt: prompt.trim() || undefined,
                    });
                    handle(res, () => {
                      setPrompt("");
                      setTab(0);
                    });
                  })
                }
              >
                {job.cuts.find((c) => c.cutId === pickedCut)?.index ?? ""}컷만 다시 만들기
              </Button>
            </div>
          )}
        </section>

        {failedCuts.length > 0 && (
          <motion.section
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-4 rounded-2xl border border-danger/30 bg-danger-tint/50 p-5 shadow-sm backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-danger">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="text-label font-bold">
                  못 만든 컷 {failedCuts.length}개
                </h2>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() =>
                  startTransition(async () =>
                    handle(
                      await retryFailedCutsAction({
                        episodeId: job.episodeId,
                        jobId: job.id,
                      }),
                    ),
                  )
                }
              >
                전체 다시 만들기
              </Button>
            </div>

            {/* 얼굴 인식 실패인 경우 사용자 안내 및 명시적 해결 옵션 제공 */}
            {hasFaceRecognitionError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50/90 p-4 dark:border-amber-800/60 dark:bg-amber-950/30"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <UserX className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h3 className="text-sm font-bold text-ink">
                      캐릭터 얼굴 인식 실패 안내
                    </h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      등록된 캐릭터 사진에서 정면 얼굴의 이목구비(눈, 코, 입)를 인식하지 못했습니다 (facexlib align face fail).<br />
                      AI가 캐릭터의 얼굴을 고정(PuLID)하려면 이목구비가 가려지지 않고 선명한 <strong>정면 실물 사진</strong>이 필요합니다.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/50 dark:border-amber-800/40">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => router.push("/assets")}
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    정면 캐릭터 사진으로 변경하기
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={pending}
                    onClick={() =>
                      startTransition(async () =>
                        handle(
                          await retryFailedCutsAction({
                            episodeId: job.episodeId,
                            jobId: job.id,
                            skipFaceLock: true,
                          }),
                        ),
                      )
                    }
                  >
                    <Wand2 className="mr-1 h-3.5 w-3.5 text-brand" />
                    얼굴 고정 없이 AI 임의 얼굴로 생성하기
                  </Button>
                </div>
              </motion.div>
            )}

            <ul className="flex flex-col gap-2.5">
              {failedCuts.map((c) => {
                const isFaceFail =
                  c.error?.includes("얼굴 인식") ||
                  c.error?.includes("facexlib") ||
                  c.error?.includes("no face detected");

                return (
                  <li
                    key={c.cutId}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-surface-card p-3 shadow-sm"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-danger/10 text-caption font-bold text-danger">
                      {c.index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-body-sm font-medium text-ink">
                        {isFaceFail ? "얼굴 인식 실패" : "이미지 생성 실패"}
                      </div>
                      <div className="text-caption text-ink-muted truncate">
                        {c.error}
                      </div>
                    </div>
                    {c.attempt > MAX_AUTO_ATTEMPTS && (
                      <Badge tone="warning">{c.attempt}번 시도함</Badge>
                    )}
                    <div className="flex items-center gap-2">
                      {isFaceFail && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={pending}
                          onClick={() =>
                            startTransition(async () =>
                              handle(
                                await regenerateCutAction({
                                  episodeId: job.episodeId,
                                  jobId: job.id,
                                  cutId: c.cutId,
                                  intent: "regenerate",
                                  skipFaceLock: true,
                                }),
                              ),
                            )
                          }
                        >
                          <Wand2 className="mr-1 h-3 w-3" />
                          임의 얼굴로
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={pending}
                        onClick={() =>
                          startTransition(async () =>
                            handle(
                              await regenerateCutAction({
                                episodeId: job.episodeId,
                                jobId: job.id,
                                cutId: c.cutId,
                                intent: "regenerate",
                              }),
                            ),
                          )
                        }
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        다시
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="text-caption text-ink-muted">
              {refundedCount > 0
                ? `실패한 컷에 쓴 크레딧 ${refundedCount}개는 돌려드렸어요. 다시 만들 때 새로 차감돼요.`
                : "실패한 컷에는 크레딧을 쓰지 않았어요. 다시 만들 때 차감돼요."}
            </p>
          </motion.section>
        )}
      </main>

      {/* 크레딧이 모자라면 버튼을 막는 대신 여기서 막고 충전으로 보낸다(credit.ts 주석). */}
      <Modal
        open={shortfall !== null}
        onClose={() => setShortfall(null)}
        title="크레딧이 모자라요"
        description={
          shortfall
            ? `이 작업에 ${shortfall.required}크레딧이 필요한데 ${shortfall.available}크레딧 남았어요.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setShortfall(null)}>
              나중에
            </Button>
            <Button onClick={() => router.push("/home")}>출석하고 받기</Button>
          </>
        }
      />

      <WebtoonComicViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={`${seriesTitle} - ${episodeTitle}`}
        cuts={job.cuts.map((c) => ({
          cutId: c.cutId,
          imageUrl: c.imageUrl,
          index: c.index,
        }))}
      />
    </div>
  );
}
