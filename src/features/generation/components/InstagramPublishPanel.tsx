"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { CaptionCheck } from "@/contracts/instagram";
import {
  cancelPublishAction,
  getInstagramPublishStateAction,
  schedulePublishAction,
  uploadPublishImagesAction,
  type InstagramPublishState,
  type PublishJobView,
} from "@/features/platform/instagram/actions";
import type { ExportRatio } from "../editor/exportCarousel";
import type { CutLayerTree } from "../types/layer";

/**
 * 원클릭 발행·자동 예약(INSTAGRAM_PUBLISH_ENABLED 일 때만 보인다).
 * 브라우저가 말풍선까지 합성한 JPEG 를 만들어 올리고, 서버 큐가 정한 시각에 발행한다.
 */

const STATUS_LABEL: Record<PublishJobView["status"], string> = {
  queued: "예약됨",
  running: "발행 중",
  published: "게시됨",
  failed: "실패",
  canceled: "취소됨",
};

export function InstagramPublishPanel(props: {
  episodeId: string;
  trees: CutLayerTree[];
  ratio: ExportRatio;
  captionCheck: CaptionCheck | null;
  firstComment: string;
  /** 컷 이미지가 빠진 장이 있으면 발행하지 않는다. */
  missingCuts: number;
}) {
  const [state, setState] = useState<InstagramPublishState | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reload = useCallback(async () => {
    setState(await getInstagramPublishStateAction(props.episodeId));
  }, [props.episodeId]);

  useEffect(() => {
    let alive = true;
    getInstagramPublishStateAction(props.episodeId).then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, [props.episodeId]);

  // 발행 중이거나 곧 꺼낼 작업이 있으면 10초마다 상태를 따라간다.
  const jobs = state?.jobs;
  useEffect(() => {
    if (!jobs?.some((j) => j.status === "running" || j.status === "queued")) return;
    const t = setInterval(() => {
      const soon = jobs.some(
        (j) => j.status === "running" || (j.status === "queued" && Date.parse(j.scheduledAt) - Date.now() < 120_000),
      );
      if (soon) void reload();
    }, 10_000);
    return () => clearInterval(t);
  }, [jobs, reload]);

  if (!state) return null;

  if (!state.account) {
    return (
      <div className="flex items-center justify-between gap-2 text-caption">
        <span className="text-[11px] text-ink-muted">인스타그램 프로페셔널(비즈니스·크리에이터) 계정을 연결하면 바로 발행할 수 있어요.</span>
        <ButtonLink href="/api/instagram/connect" variant="secondary" size="sm" className="shrink-0 text-[11px] font-semibold">
          인스타그램 연결
        </ButtonLink>
      </div>
    );
  }

  const problems = props.captionCheck?.problems ?? [];
  const blocked = props.missingCuts > 0 || props.trees.length === 0 || problems.length > 0;

  function publish(at: string | null) {
    setMessage(null);
    start(async () => {
      try {
        const { renderCutJpeg } = await import("../editor/exportCarousel");
        const form = new FormData();
        form.set("episodeId", props.episodeId);
        for (const [i, tree] of props.trees.entries()) {
          const jpeg = await renderCutJpeg(tree, { ratio: props.ratio, watermark: false });
          form.append("image", new File([jpeg], `${String(i + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" }));
        }
        const up = await uploadPublishImagesAction(form);
        if (!up.ok) return setMessage(up.message);
        const r = await schedulePublishAction({
          episodeId: props.episodeId,
          imagePaths: up.paths,
          caption: props.captionCheck?.text ?? "",
          firstComment: props.firstComment,
          scheduledAt: at ? new Date(at).toISOString() : null,
        });
        if (!r.ok) return setMessage(r.message);
        setMessage(at ? "예약했어요. 정한 시각에 자동으로 올라가요." : "발행을 시작했어요. 1~2분 안에 올라가요.");
        setScheduledAt("");
        await reload();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "발행하지 못했어요.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption font-semibold text-ink">@{state.account.username}</span>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          aria-label="예약 시각"
          className="h-8 rounded-lg border border-border bg-surface-card px-2 text-xs text-ink focus:border-brand focus:outline-none"
        />
        <Button size="sm" variant="primary" loading={pending} disabled={blocked} onClick={() => publish(scheduledAt || null)}>
          {scheduledAt ? "예약 발행" : "지금 발행"}
        </Button>
      </div>
      {props.missingCuts > 0 && <p className="text-[11px] text-danger">이미지가 없는 컷이 있어 발행할 수 없어요.</p>}
      {problems.map((p) => (
        <p key={p} className="text-[11px] text-danger">
          {p}
        </p>
      ))}
      {message && <p className="text-[11px] font-medium text-brand">{message}</p>}

      {state.jobs.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-border/60 pt-2">
          {state.jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-ink-muted tabular-nums">
                {new Date(j.publishedAt ?? j.scheduledAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
              </span>
              <span
                className={cn(
                  "font-semibold",
                  j.status === "published" ? "text-brand" : j.status === "failed" ? "text-danger" : "text-ink",
                )}
              >
                {STATUS_LABEL[j.status]}
              </span>
              {j.permalink && (
                <a href={j.permalink} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                  게시물 보기 ↗
                </a>
              )}
              {j.status === "queued" && (
                <button
                  type="button"
                  className="cursor-pointer text-ink-muted hover:text-danger"
                  onClick={() =>
                    start(async () => {
                      const r = await cancelPublishAction(j.id);
                      if (!r.ok) setMessage(r.message);
                      await reload();
                    })
                  }
                >
                  취소
                </button>
              )}
              {(j.error || j.commentError) && j.status !== "published" ? (
                <span className="basis-full text-danger">{j.error}</span>
              ) : j.commentError ? (
                <span className="basis-full text-ink-muted">첫 댓글은 달지 못했어요: {j.commentError}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
