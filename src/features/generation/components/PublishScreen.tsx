"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Badge, Button, ButtonLink, Field } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  generatePostPackageAction,
  markPublishedAction,
  savePostPackageAction,
} from "../actions";
import type { PostPackage } from "../data/types";
import type { ExportRatio } from "../editor/exportCarousel";
import type { CutLayerTree } from "../types/layer";
import { EpisodeHeader } from "./EpisodeHeader";

export interface PublishSlide {
  cutId: string;
  index: number;
  imageUrl: string | null;
  tree: CutLayerTree | null;
}

export interface PublishScreenProps {
  episodeId: string;
  seriesId: string;
  slides: PublishSlide[];
  initialPackage: PostPackage | null;
  defaultRatio: ExportRatio;
  watermark: boolean;
  published: boolean;
  credits: number;
  seriesTitle: string;
  episodeTitle: string;
}

const CAPTION_TABS: { key: keyof PostPackage["captions"]; label: string }[] = [
  { key: "short", label: "짧게" },
  { key: "emotional", label: "감성" },
  { key: "humor", label: "유머" },
];

/** 손으로 고친 캡션은 이만큼 멈추면 저장한다. */
const AUTOSAVE_MS = 1500;

/**
 * PRD 4.1 — 인스타 게시물 패키지.
 * 본문 3안·해시태그·첫 댓글을 원클릭으로 복사하고, 캐러셀을 ZIP 으로 받는다.
 * 실제로 올린 뒤 "올렸어요"를 누르면 첫 게시로 센다(베타 출시 조건 지표).
 */
export function PublishScreen(props: PublishScreenProps) {
  const [pkg, setPkg] = useState(props.initialPackage);
  const [caption, setCaption] = useState<keyof PostPackage["captions"]>("short");
  const [ratio, setRatio] = useState<ExportRatio>(props.defaultRatio);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [published, setPublished] = useState(props.published);
  const [pending, start] = useTransition();
  const started = useRef(false);

  const missing = props.slides.filter((s) => !s.tree);

  // 패키지가 없으면 열자마자 만든다. 캡션 생성은 크레딧을 쓰지 않는다.
  useEffect(() => {
    if (pkg || started.current) return;
    started.current = true;
    void generatePostPackageAction(props.episodeId).then((r) => {
      if (r.ok) setPkg(r.data);
      else setNotice(r.message);
    });
  }, [pkg, props.episodeId]);

  // 손으로 고친 것 저장.
  const edited = useRef(false);
  useEffect(() => {
    if (!pkg || !edited.current) return;
    const timer = setTimeout(() => {
      void savePostPackageAction(props.episodeId, {
        captions: pkg.captions,
        hashtags: pkg.hashtags,
        firstComment: pkg.firstComment,
      });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [pkg, props.episodeId]);

  function edit(next: PostPackage) {
    edited.current = true;
    setPkg(next);
  }

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    } catch {
      setNotice("복사하지 못했어요. 글을 길게 눌러 직접 복사해 주세요.");
    }
  }

  async function downloadZip() {
    setNotice(null);
    setExporting("준비 중");
    try {
      // konva 는 window 를 쓴다. 누를 때만 불러온다.
      const { exportCarouselZip } = await import("../editor/exportCarousel");
      const trees = props.slides.map((s) => s.tree!).filter(Boolean);
      const blob = await exportCarouselZip(trees, { ratio, watermark: props.watermark }, (done, total) =>
        setExporting(`${done}/${total}컷`),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${props.seriesTitle}-${props.episodeTitle}-${ratio.replace(":", "x")}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "내보내지 못했어요");
    } finally {
      setExporting(null);
    }
  }

  const tags = pkg ? [...pkg.hashtags.fixed, ...pkg.hashtags.dynamic].map((t) => `#${t}`) : [];

  return (
    <div className="min-h-dvh bg-surface-page">
      <EpisodeHeader
        episodeId={props.episodeId}
        seriesTitle={props.seriesTitle}
        episodeTitle={props.episodeTitle}
        current="publish"
        credits={props.credits}
      />

      <main className="mx-auto grid max-w-[1080px] grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex flex-col gap-4">
          {notice && (
            <p className="rounded-lg bg-danger-tint px-3 py-2 text-body-sm text-danger">{notice}</p>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex-1 text-label font-semibold text-ink">
                캐러셀 {props.slides.length}장
              </h2>
              <div role="group" aria-label="비율" className="flex gap-1">
                {(["1:1", "4:5"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={ratio === r}
                    onClick={() => setRatio(r)}
                    className={cn(
                      "h-control-sm cursor-pointer rounded-md px-3 text-label font-semibold",
                      ratio === r ? "bg-brand text-on-brand" : "bg-surface-sunken text-ink-muted",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {props.slides.map((s) => (
                <figure key={s.cutId} className="flex w-32 shrink-0 flex-col gap-1">
                  <div
                    className={cn(
                      "overflow-hidden rounded-lg border border-border bg-skeleton",
                      ratio === "4:5" ? "aspect-[4/5]" : "aspect-square",
                    )}
                  >
                    {s.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.imageUrl} alt={`${s.index}컷`} className="size-full object-cover" />
                    ) : (
                      <span className="grid size-full place-items-center text-caption text-ink-subtle">
                        아직 없음
                      </span>
                    )}
                  </div>
                  <figcaption className="text-caption text-ink-muted">{s.index}컷</figcaption>
                </figure>
              ))}
            </div>
            <p className="text-caption text-ink-subtle">
              미리보기는 생성 이미지예요. 내려받는 PNG 에는 편집기에서 얹은 대사·말풍선이 들어가요.
            </p>

            {missing.length > 0 ? (
              <p className="rounded-lg bg-warning-tint px-3 py-2 text-body-sm text-warning">
                {missing.map((m) => m.index).join(", ")}컷 이미지가 아직 없어요. 생성 화면에서 다시 만든 뒤 내보낼 수 있어요.
              </p>
            ) : (
              <Button block loading={exporting !== null} onClick={downloadZip}>
                {exporting ? `내보내는 중 · ${exporting}` : `${ratio} PNG ZIP 내려받기`}
              </Button>
            )}
            <p className="text-caption text-ink-subtle">
              모든 이미지에 AI 생성 표시(메타데이터)가 들어가요.
              {props.watermark && " 무료 요금제는 오른쪽 아래에 작은 워터마크가 붙어요."}
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
            <h2 className="text-label font-semibold text-ink">올리고 나서</h2>
            {published ? (
              <>
                <p className="text-body text-ink">
                  게시 완료로 표시했어요. 다음 화는 같은 캐릭터로 사연만 적으면 돼요.
                </p>
                <ButtonLink href={`/series/${props.seriesId}`} variant="secondary" block>
                  시리즈에서 다음 화 만들기
                </ButtonLink>
              </>
            ) : (
              <>
                <p className="text-body-sm text-ink-muted">
                  인스타그램에 올렸으면 눌러 주세요. 시리즈 타임라인에 게시된 화로 남아요.
                </p>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href="https://www.instagram.com/" variant="ghost" target="_blank" rel="noreferrer">
                    인스타그램 열기
                  </ButtonLink>
                  <Button
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await markPublishedAction(props.episodeId);
                        if (r.ok) setPublished(true);
                        else setNotice(r.message);
                      })
                    }
                  >
                    인스타에 올렸어요
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          {!pkg ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-card p-8 text-center">
              {notice ? (
                <Button
                  onClick={() => {
                    setNotice(null);
                    started.current = false;
                    setPkg(null);
                  }}
                >
                  다시 만들기
                </Button>
              ) : (
                <>
                  <span
                    aria-hidden
                    className="size-6 animate-spin rounded-full border-4 border-brand border-r-transparent"
                  />
                  <p className="text-body-sm text-ink-muted">캡션과 해시태그를 쓰고 있어요</p>
                </>
              )}
            </div>
          ) : (
            <>
              {pkg.usedMock && (
                <p className="rounded-lg bg-surface-sunken px-3 py-2 text-caption text-ink-muted">
                  모델 키가 없어 콘티 문장으로 채운 초안이에요. 고쳐서 쓰세요.
                </p>
              )}

              <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
                <div className="flex items-center gap-2">
                  <h2 className="flex-1 text-label font-semibold text-ink">본문</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await generatePostPackageAction(props.episodeId);
                        if (r.ok) setPkg(r.data);
                        else setNotice(r.message);
                      })
                    }
                  >
                    다시 쓰기
                  </Button>
                </div>
                <div role="tablist" className="flex gap-1">
                  {CAPTION_TABS.map((t) => (
                    <button
                      key={t.key}
                      role="tab"
                      type="button"
                      aria-selected={caption === t.key}
                      onClick={() => setCaption(t.key)}
                      className={cn(
                        "h-control-sm flex-1 cursor-pointer rounded-md text-label font-semibold",
                        caption === t.key ? "bg-brand-tint text-brand-ink" : "text-ink-muted hover:bg-surface-sunken",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <Field
                  label="본문"
                  multiline
                  rows={6}
                  value={pkg.captions[caption]}
                  onChange={(v) => edit({ ...pkg, captions: { ...pkg.captions, [caption]: v } })}
                  maxLength={2200}
                />
                <Button
                  variant="secondary"
                  block
                  onClick={() => copy("caption", `${pkg.captions[caption]}\n\n${tags.join(" ")}`)}
                >
                  {copied === "caption" ? "복사했어요" : "본문 + 해시태그 복사"}
                </Button>
              </section>

              <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
                <div className="flex items-center gap-2">
                  <h2 className="flex-1 text-label font-semibold text-ink">해시태그</h2>
                  <span className="text-caption tabular-nums text-ink-muted">{tags.length}개</span>
                </div>
                {pkg.hashtags.fixed.length > 0 && (
                  <TagGroup
                    title="시리즈 고정"
                    tags={pkg.hashtags.fixed}
                    tone="brand"
                    onRemove={(t) =>
                      edit({ ...pkg, hashtags: { ...pkg.hashtags, fixed: pkg.hashtags.fixed.filter((x) => x !== t) } })
                    }
                  />
                )}
                <TagGroup
                  title="이번 화"
                  tags={pkg.hashtags.dynamic}
                  onRemove={(t) =>
                    edit({ ...pkg, hashtags: { ...pkg.hashtags, dynamic: pkg.hashtags.dynamic.filter((x) => x !== t) } })
                  }
                />
                <Button variant="secondary" block onClick={() => copy("tags", tags.join(" "))}>
                  {copied === "tags" ? "복사했어요" : "해시태그만 복사"}
                </Button>
              </section>

              <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
                <h2 className="text-label font-semibold text-ink">첫 댓글</h2>
                <Field
                  label="첫 댓글"
                  multiline
                  rows={2}
                  value={pkg.firstComment}
                  onChange={(v) => edit({ ...pkg, firstComment: v })}
                  maxLength={2200}
                />
                <Button variant="secondary" block onClick={() => copy("comment", pkg.firstComment)}>
                  {copied === "comment" ? "복사했어요" : "첫 댓글 복사"}
                </Button>
              </section>
            </>
          )}
        </aside>
      </main>
    </div>
  );
}

function TagGroup({
  title,
  tags,
  tone,
  onRemove,
}: {
  title: string;
  tags: string[];
  tone?: "brand";
  onRemove: (tag: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-semibold text-ink-muted">{title}</span>
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onRemove(t)}
            title="빼기"
            className="cursor-pointer"
          >
            <Badge tone={tone}>#{t} ✕</Badge>
          </button>
        ))}
        {tags.length === 0 && <span className="text-caption text-ink-subtle">없음</span>}
      </div>
    </div>
  );
}
