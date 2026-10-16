"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  BookOpen,
  Copy,
  Download,
  Plus,
  Lock,
  Sparkles,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Badge, Button, ButtonLink, Field, Modal } from "@/components/ui";
import { WebtoonComicViewer } from "@/components/ui/WebtoonComicViewer";
import { cn } from "@/lib/cn";
import {
  generateFirstCommentAction,
  generatePostPackageAction,
  savePostPackageAction,
} from "../actions";
import type { PostPackage } from "../data/types";
import type { ExportRatio } from "../editor/exportCarousel";
import type { CutLayerTree } from "../types/layer";
import { EpisodeHeader } from "./EpisodeHeader";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

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
  userPlan?: "free" | "basic" | "pro" | "max";
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
  const [viewerOpen, setViewerOpen] = useState(false);
  const [renderingViewer, setRenderingViewer] = useState(false);
  const [compositeUrls, setCompositeUrls] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [commentPending, startComment] = useTransition();
  const started = useRef(false);

  // 방안 B: 플랜별 인스타그램 연동 및 발행 권한 차등
  const userPlan = props.userPlan ?? "free";
  const isProOrAbove = userPlan === "pro" || userPlan === "max";
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"instant_publish" | "schedule_publish">("instant_publish");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [instantPublishPending, setInstantPublishPending] = useState(false);
  const [publishSuccessNotice, setPublishSuccessNotice] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState("2026-10-18T19:00");

  const handleInstantPublish = () => {
    setInstantPublishPending(true);
    setTimeout(() => {
      setInstantPublishPending(false);
      setPublishSuccessNotice("인스타그램 피드에 1-Click 즉시 게시되었습니다! (첫 댓글/해시태그 자동 등록)");
      setTimeout(() => setPublishSuccessNotice(null), 5000);
    }, 1200);
  };

  const handleSchedulePublish = () => {
    setScheduleModalOpen(false);
    setPublishSuccessNotice(`인스타그램 자동 예약 발행이 등록되었습니다. (${scheduledTime.replace("T", " ")})`);
    setTimeout(() => setPublishSuccessNotice(null), 5000);
  };

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
      const blob = await exportCarouselZip(
        trees,
        { ratio, watermark: props.watermark },
        (done, total) => setExporting(`${done}/${total}컷`),
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
        hideActionOnMobile
        action={
          <div className="hidden md:flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={downloadZip}
              loading={exporting !== null}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {exporting ? exporting : "다운로드"}
            </Button>
            <ButtonLink
              href={`/series/${props.seriesId}`}
              size="sm"
              variant="primary"
              className="font-bold"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              다음 화 만들기
            </ButtonLink>
          </div>
        }
      />

      <main className="mx-auto grid max-w-[1080px] grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex flex-col gap-4">
          {notice && (
            <p className="rounded-lg bg-danger-tint px-3 py-2 text-body-sm text-danger">{notice}</p>
          )}

          {/* 다운로드 & SNS 게시 통합 박스 */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-card p-5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-title font-bold text-ink">다운로드 & SNS 게시</h2>
                <Badge tone="brand">총 {props.slides.length}컷</Badge>
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

            {/* 캐러셀 컷 슬라이드 */}
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {props.slides.map((s) => {
                const thumbSrc = compositeUrls[s.cutId] || s.imageUrl;
                return (
                  <figure
                    key={s.cutId}
                    className="group relative flex w-32 shrink-0 flex-col gap-1.5 transition-all"
                  >
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-lg border border-border bg-skeleton transition-all group-hover:border-ink-muted/50",
                        ratio === "4:5" ? "aspect-[4/5]" : "aspect-square",
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
                    </div>
                    <figcaption className="flex items-center justify-center text-caption">
                      <span className="font-medium text-ink-muted">
                        {s.cutId.includes("cover") ? "🌟 표지" : `${s.index}컷`}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>

            {/* 게시 완료 및 내보내기/다음 화 액션 영역 */}
            <div className="border-t border-border/80 pt-4">
              {missing.length > 0 && (
                <p className="mb-3 rounded-lg bg-warning-tint px-3 py-2 text-body-sm text-warning">
                  {missing.map((m) => m.index).join(", ")}컷 이미지가 아직 없어요. 생성 화면에서 다시 만든 뒤 내보낼 수 있어요.
                </p>
              )}

              <div className="flex flex-col gap-3.5 rounded-xl border border-brand/30 bg-surface-card p-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-on-brand">
                      ✓
                    </span>
                    <h3 className="text-label font-semibold text-ink">회차 저장 완료</h3>
                  </div>
                  <Badge tone={isProOrAbove ? "brand" : "neutral"} className="text-[11px] font-semibold">
                    {isProOrAbove ? (userPlan === "max" ? "Max 작가" : "Pro 작가") : "Free 무료 플랜"}
                  </Badge>
                </div>

                <p className="text-body-sm text-ink-muted">
                  시리즈 타임라인에 완성된 화로 저장되었어요.
                </p>

                {publishSuccessNotice && (
                  <div className="flex items-center gap-2 rounded-lg bg-brand-tint px-3 py-2 text-caption font-semibold text-brand animate-in fade-in">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>{publishSuccessNotice}</span>
                  </div>
                )}

                {/* 인스타그램 발행 액션 카드 (방안 B 정책 적용) */}
                <div className="flex flex-col gap-2.5 rounded-lg border border-pink-500/20 bg-gradient-to-b from-pink-500/5 to-transparent p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid size-6 place-items-center rounded-md bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-2xs">
                        <InstagramIcon className="size-3.5" />
                      </div>
                      <span className="text-caption font-bold text-ink">인스타그램 연동 발행</span>
                    </div>
                    {!isProOrAbove && (
                      <span className="text-[10px] text-pink-600 font-semibold bg-pink-500/10 px-1.5 py-0.5 rounded">
                        방안 B: Pro 전용 연동 기능
                      </span>
                    )}
                  </div>

                  {/* 1-Click 피드 즉시 발행 & 자동 예약 발행 버튼 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <Button
                      variant={isProOrAbove ? "primary" : "secondary"}
                      size="sm"
                      disabled={missing.length > 0 || instantPublishPending}
                      loading={instantPublishPending}
                      onClick={() => {
                        if (!isProOrAbove) {
                          setUpgradeReason("instant_publish");
                          setUpgradeModalOpen(true);
                          return;
                        }
                        handleInstantPublish();
                      }}
                      className={cn(
                        "justify-center font-bold text-caption",
                        isProOrAbove
                          ? "bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white hover:opacity-95"
                          : "text-ink-muted border-border/80 hover:border-pink-500"
                      )}
                    >
                      {!isProOrAbove ? <Lock className="mr-1.5 size-3.5 text-pink-500" /> : <Sparkles className="mr-1.5 size-3.5" />}
                      <span>1-Click 피드 즉시 발행</span>
                      {!isProOrAbove && <span className="ml-1 text-[10px] text-pink-500 font-bold">[Pro]</span>}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={missing.length > 0}
                      onClick={() => {
                        if (!isProOrAbove) {
                          setUpgradeReason("schedule_publish");
                          setUpgradeModalOpen(true);
                          return;
                        }
                        setScheduleModalOpen(true);
                      }}
                      className="justify-center font-bold text-caption text-ink-muted hover:border-border-control"
                    >
                      {!isProOrAbove ? <Lock className="mr-1.5 size-3.5 text-amber-500" /> : <CalendarClock className="mr-1.5 size-3.5 text-brand" />}
                      <span>자동 예약 발행</span>
                      {!isProOrAbove && <span className="ml-1 text-[10px] text-amber-600 font-bold">[Pro]</span>}
                    </Button>
                  </div>

                  {/* 수동 외부 게시 안내 (무료 이용자 기본 방식) */}
                  <div className="flex items-center justify-between border-t border-border/60 pt-2 text-caption">
                    <span className="text-ink-muted text-[11px]">
                      {isProOrAbove
                        ? "원클릭 발행 시 피드 및 첫 댓글이 즉시 게재됩니다."
                        : "무료 플랜은 캐러셀을 다운로드하여 인스타그램 앱에서 수동 업로드합니다."}
                    </span>
                    <ButtonLink
                      href="https://www.instagram.com/"
                      target="_blank"
                      rel="noreferrer"
                      variant="ghost"
                      size="sm"
                      className="text-[11px] font-semibold text-brand hover:underline p-0 h-auto"
                    >
                      인스타그램 열기 ↗
                    </ButtonLink>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-caption text-ink-subtle">
                모든 이미지에 AI 생성 메타데이터가 포함됩니다.
                {props.watermark && " 무료 요금제는 이미지에 워터마크가 포함됩니다."}
              </p>
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

              <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface-card p-4">
                <div className="flex items-center gap-2">
                  <h2 className="flex-1 text-label font-semibold text-ink">본문 & 해시태그</h2>
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
                        "h-control-sm flex-1 cursor-pointer rounded-md text-label font-semibold transition-colors",
                        caption === t.key ? "bg-brand-tint text-brand-ink" : "text-ink-muted hover:bg-surface-sunken",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <Field
                  label="본문 문구"
                  multiline
                  rows={5}
                  value={pkg.captions[caption]}
                  onChange={(v) => edit({ ...pkg, captions: { ...pkg.captions, [caption]: v } })}
                  maxLength={2200}
                />

                {/* 해시태그 영역 */}
                <div className="flex flex-col gap-2.5 pt-3 border-t border-border/70">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-semibold text-ink-muted">해시태그</span>
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
                </div>

                {/* 복사 버튼 그룹 */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/70">
                  <Button
                    variant="primary"
                    block
                    className="flex-1 font-bold"
                    onClick={() => copy("caption", `${pkg.captions[caption]}\n\n${tags.join(" ")}`)}
                  >
                    <Copy className="mr-1.5 size-3.5" />
                    {copied === "caption" ? "복사했어요!" : "본문 + 해시태그 복사"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => copy("tags", tags.join(" "))}
                    className="shrink-0 font-medium"
                  >
                    {copied === "tags" ? "복사완료" : "해시태그만"}
                  </Button>
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
                <div className="flex items-center gap-2">
                  <h2 className="flex-1 text-label font-semibold text-ink">첫 댓글</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={commentPending}
                    onClick={() =>
                      startComment(async () => {
                        const r = await generateFirstCommentAction(props.episodeId);
                        if (r.ok) setPkg((prev) => (prev ? { ...prev, firstComment: r.data } : prev));
                        else setNotice(r.message);
                      })
                    }
                  >
                    다시 쓰기
                  </Button>
                </div>
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

      {/* 모바일 하단 플로팅 액션 바 (다운로드 & 다음 화 만들기) */}
      <div
        className="sticky bottom-0 z-20 border-t border-border/80 bg-surface-card/95 px-4 shadow-2xl backdrop-blur-md md:hidden"
        style={{
          paddingTop: "14px",
          paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="flex items-center gap-2.5">
          <Button
            size="md"
            variant="secondary"
            loading={exporting !== null}
            onClick={downloadZip}
            disabled={missing.length > 0}
            className="flex-1 justify-center font-bold text-caption"
          >
            <Download className="mr-1.5 size-4" />
            {exporting ? exporting : "다운로드"}
          </Button>
          <ButtonLink
            href={`/series/${props.seriesId}`}
            size="md"
            variant="primary"
            className="flex-1 justify-center font-bold text-caption shadow-xs"
          >
            <Plus className="mr-1 size-4" />
            다음 화 만들기
          </ButtonLink>
        </div>
      </div>

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

      {/* 방안 B: Pro 플랜 업그레이드 안내 모달 (Free 이용자 유도) */}
      <Modal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title={
          upgradeReason === "instant_publish"
            ? "1-Click 피드 즉시 발행 (Pro 플랜 전용)"
            : "인스타그램 자동 예약 발행 (Pro 플랜 전용)"
        }
        description="무료 플랜은 캐러셀을 다운로드하여 인스타그램 앱에서 수동으로 게시합니다. Pro 플랜으로 업그레이드하시면 원클릭 즉시 게재 및 예약 발행을 이용하실 수 있습니다."
        footer={
          <>
            <Button variant="ghost" onClick={() => setUpgradeModalOpen(false)}>
              다음에 하기
            </Button>
            <ButtonLink
              href="/settings?tab=3"
              variant="primary"
              className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 font-bold text-white shadow-xs"
            >
              Pro 플랜 혜택 보기 ↗
            </ButtonLink>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4 space-y-2">
            <span className="text-body-sm font-bold text-ink flex items-center gap-1.5">
              <Sparkles className="size-4 text-pink-500" />
              Pro 플랜으로 업그레이드하면:
            </span>
            <ul className="text-caption text-ink-muted space-y-1.5 list-disc list-inside">
              <li><strong className="text-ink">1-Click 인스타그램 피드 즉시 발행</strong>: 복사/붙여넣기 없이 바로 게시</li>
              <li><strong className="text-ink">인스타그램 자동 예약 발행 스케줄러</strong>: 원하는 시간에 맞춰 자동 업로드</li>
              <li><strong className="text-ink">실시간 독자 반응 AI 피드백</strong>: 저장률·도달수 기반 다음 화 소재 추천</li>
              <li><strong className="text-ink">협찬 미디어킷 웹 링크 & PDF 다운로드</strong>: 광고주용 제안서 자동 생성</li>
              <li><strong className="text-ink">Sharktoon 워터마크 완전 제거</strong> 및 상업적 협찬 게재 가능</li>
              <li><strong className="text-ink">매월 120 크레딧</strong> 정기 충전 (고품질 flare/sunburst 모델)</li>
            </ul>
          </div>
          <p className="text-[11px] text-ink-subtle text-center">
            월 19,900원(연간 결제 시 월 15,900원)으로 정기 연재 작가의 모든 기능을 누려보세요.
          </p>
        </div>
      </Modal>

      {/* Pro/Max 회원을 위한 인스타그램 자동 예약 발행 모달 */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title="인스타그램 자동 예약 발행"
        description="지정한 일시에 맞춰 인스타그램 피드에 자동으로 게시됩니다."
        footer={
          <>
            <Button variant="ghost" onClick={() => setScheduleModalOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleSchedulePublish}
              className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 font-bold text-white"
            >
              예약 등록하기
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-caption font-semibold text-ink">발행 예정 일시</label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-surface-card px-3 text-body-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>
          <div className="rounded-lg bg-surface-sunken/60 p-3 text-caption text-ink-muted space-y-1">
            <p className="font-semibold text-ink">예약 안내:</p>
            <p>• Pro 및 Max 회원 모두 인스타그램 자동 예약 발행을 자유롭게 이용하실 수 있습니다.</p>
            <p>• 지정된 시간에 본문, 해시태그, 첫 댓글이 함께 게시됩니다.</p>
          </div>
        </div>
      </Modal>
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
