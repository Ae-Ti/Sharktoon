"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { BookOpen } from "lucide-react";
import { Badge, Button, ButtonLink, Field } from "@/components/ui";
import { WebtoonComicViewer } from "@/components/ui/WebtoonComicViewer";
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
  const ratio = props.defaultRatio;
  const [newTag, setNewTag] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [published, setPublished] = useState(props.published);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [renderingViewer, setRenderingViewer] = useState(false);
  const [compositeUrls, setCompositeUrls] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const started = useRef(false);

  const [thumbnailCutId, setThumbnailCutId] = useState<string>(props.slides[0]?.cutId ?? "");
  const isFirstCutThumb = thumbnailCutId === (props.slides[0]?.cutId ?? "");

  const missing = props.slides.filter((s) => !s.tree);

  // 대사/말풍선이 합성된 완성본 썸네일/뷰어용 이미지를 백그라운드에서 점진적 합성
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { renderCutDataUrl } = await import("../editor/exportCarousel");
        for (const s of props.slides) {
          if (!active) break;
          if (s.tree && !compositeUrls[s.cutId]) {
            try {
              const url = await renderCutDataUrl(s.tree, { ratio, watermark: false });
              if (active) {
                setCompositeUrls((prev) => ({ ...prev, [s.cutId]: url }));
              }
            } catch (err) {
              console.error(`Failed to render composite for cut ${s.index}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load exportCarousel", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [props.slides, ratio]);

  const handleOpenViewer = async () => {
    setRenderingViewer(true);
    try {
      const { renderCutDataUrl } = await import("../editor/exportCarousel");
      const updates: Record<string, string> = {};
      await Promise.all(
        props.slides.map(async (s) => {
          if (compositeUrls[s.cutId]) return;
          if (s.tree) {
            try {
              const url = await renderCutDataUrl(s.tree, { ratio, watermark: false });
              updates[s.cutId] = url;
            } catch (e) {
              console.error(e);
            }
          }
        }),
      );
      if (Object.keys(updates).length > 0) {
        setCompositeUrls((prev) => ({ ...prev, ...updates }));
      }
      setViewerOpen(true);
    } catch (e) {
      console.error(e);
      setViewerOpen(true);
    } finally {
      setRenderingViewer(false);
    }
  };

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
      const thumbIndex = props.slides.findIndex((s) => s.cutId === thumbnailCutId);
      const blob = await exportCarouselZip(
        trees,
        { ratio, watermark: props.watermark },
        (done, total) => setExporting(`${done}/${total}컷`),
        thumbIndex >= 0 ? thumbIndex : 0,
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

          {/* 캐러셀 & 인스타 게시 통합 박스 */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-card p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-title font-bold text-ink">캐러셀 & 인스타 게시</h2>
                <Badge tone="brand">총 {props.slides.length}컷</Badge>
                <Badge tone="neutral">비율 {ratio}</Badge>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={renderingViewer}
                onClick={handleOpenViewer}
              >
                <BookOpen className="mr-1.5 h-3.5 w-3.5" />
                웹툰 뷰어로 보기
              </Button>
            </div>

            {/* 대표 썸네일 설정 바 */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunken/60 px-3.5 py-2.5 text-caption">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink">대표 썸네일:</span>
                <span className="font-bold text-brand">
                  {props.slides.find((s) => s.cutId === thumbnailCutId)?.index ?? 1}번째 컷
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer select-none items-center gap-1.5 font-medium text-ink hover:text-brand">
                  <input
                    type="checkbox"
                    checked={isFirstCutThumb}
                    onChange={(e) => {
                      if (e.target.checked && props.slides[0]) {
                        setThumbnailCutId(props.slides[0].cutId);
                      }
                    }}
                    className="size-4 cursor-pointer rounded accent-brand"
                  />
                  <span>1번째 컷을 썸네일로 사용</span>
                </label>
                <span className="text-ink-subtle">|</span>
                <span className="text-ink-subtle">원하는 컷을 클릭해 썸네일 변경 가능</span>
              </div>
            </div>

            {/* 캐러셀 컷 슬라이드 */}
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {props.slides.map((s) => {
                const isThumb = s.cutId === thumbnailCutId;
                const thumbSrc = compositeUrls[s.cutId] || s.imageUrl;
                return (
                  <figure
                    key={s.cutId}
                    onClick={() => setThumbnailCutId(s.cutId)}
                    className="group relative flex w-32 shrink-0 cursor-pointer flex-col gap-1.5 transition-all"
                  >
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-lg border bg-skeleton transition-all",
                        ratio === "4:5" ? "aspect-[4/5]" : "aspect-square",
                        isThumb
                          ? "border-brand ring-2 ring-brand shadow-sm"
                          : "border-border group-hover:border-ink-muted/50",
                      )}
                    >
                      {thumbSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbSrc} alt={`${s.index}컷`} className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-caption text-ink-subtle">
                          아직 없음
                        </span>
                      )}
                      {isThumb && (
                        <span className="absolute left-1.5 top-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-on-brand shadow-2xs">
                          썸네일
                        </span>
                      )}
                    </div>
                    <figcaption className="flex items-center justify-between text-caption">
                      <span className={cn(isThumb ? "font-bold text-brand" : "text-ink-muted")}>
                        {s.index}컷
                      </span>
                      {isThumb ? (
                        <span className="text-[11px] font-bold text-brand">대표</span>
                      ) : (
                        <span className="text-[10px] text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100">
                          선택
                        </span>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>

            <p className="text-caption text-ink-subtle">
              대사·말풍선이 합성된 완성본 미리보기예요. 웹툰 뷰어에서 인스타 피드/웹툰 스크롤로 감상하고 ZIP으로 내려받으실 수 있어요. 대표 썸네일은 ZIP 내 <code className="rounded bg-surface-sunken px-1 font-mono text-[11px]">thumbnail.png</code>로도 함께 저장돼요.
            </p>

            {/* 인스타 게시 액션 영역 */}
            <div className="border-t border-border/80 pt-4">
              {published ? (
                <div className="flex flex-col gap-3 rounded-xl border border-brand/30 bg-brand-subtle/30 p-4">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand">
                      ✓
                    </span>
                    <h3 className="text-label font-semibold text-ink">인스타그램에 게시 완료되었어요!</h3>
                  </div>
                  <p className="text-body-sm text-ink-muted">
                    시리즈 타임라인에 게시된 화로 등록되었어요. 다음 화는 같은 캐릭터로 사연만 적으면 돼요.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <ButtonLink href={`/series/${props.seriesId}`} variant="primary" size="md">
                      시리즈에서 다음 화 만들기
                    </ButtonLink>
                    <Button
                      variant="secondary"
                      size="md"
                      loading={exporting !== null}
                      onClick={downloadZip}
                    >
                      ZIP 다시 다운로드
                    </Button>
                    <ButtonLink
                      href="https://www.instagram.com/"
                      target="_blank"
                      rel="noreferrer"
                      variant="ghost"
                      size="md"
                    >
                      인스타그램 가기 ↗
                    </ButtonLink>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {missing.length > 0 && (
                    <p className="rounded-lg bg-warning-tint px-3 py-2 text-body-sm text-warning">
                      {missing.map((m) => m.index).join(", ")}컷 이미지가 아직 없어요. 생성 화면에서 다시 만든 뒤 내보낼 수 있어요.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="secondary"
                      size="md"
                      loading={exporting !== null}
                      onClick={downloadZip}
                      disabled={missing.length > 0}
                      className="flex-1 min-w-[160px] justify-center font-bold"
                    >
                      {exporting ? exporting : `${ratio} ZIP 다운로드`}
                    </Button>

                    <ButtonLink
                      href="https://www.instagram.com/"
                      target="_blank"
                      rel="noreferrer"
                      variant="secondary"
                      size="md"
                      className="flex-1 min-w-[160px] justify-center text-center font-bold"
                    >
                      인스타그램 열기 ↗
                    </ButtonLink>

                    <Button
                      variant="primary"
                      size="md"
                      loading={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await markPublishedAction(props.episodeId);
                          if (r.ok) setPublished(true);
                          else setNotice(r.message);
                        })
                      }
                      className="flex-1 min-w-[160px] justify-center font-bold"
                    >
                      인스타 올렸어요
                    </Button>
                  </div>

                  <p className="text-caption text-ink-subtle">
                    모든 이미지에 AI 생성 메타데이터가 포함됩니다.
                    {props.watermark && " 무료 요금제는 오른쪽 아래에 작은 워터마크가 붙어요."}
                  </p>
                </div>
              )}
            </div>
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

                {/* 새 해시태그 직접 추가 */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = newTag.trim().replace(/^#+/, "");
                    if (!trimmed) return;
                    if (
                      !pkg.hashtags.dynamic.includes(trimmed) &&
                      !pkg.hashtags.fixed.includes(trimmed)
                    ) {
                      edit({
                        ...pkg,
                        hashtags: {
                          ...pkg.hashtags,
                          dynamic: [...pkg.hashtags.dynamic, trimmed],
                        },
                      });
                    }
                    setNewTag("");
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="새 해시태그 추가 (예: 일상툰)"
                    maxLength={30}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface-card px-2.5 text-xs text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    disabled={!newTag.trim()}
                  >
                    추가
                  </Button>
                </form>
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

      <WebtoonComicViewer
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={`${props.seriesTitle} - ${props.episodeTitle}`}
        caption={pkg ? pkg.captions[caption] : undefined}
        hashtags={tags}
        cuts={props.slides.map((s) => ({
          cutId: s.cutId,
          imageUrl: compositeUrls[s.cutId] || s.imageUrl || undefined,
          index: s.index,
        }))}
      />
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
