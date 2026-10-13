"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ScrollText,
  Layers,
  Share2,
  BookOpen,
  ArrowUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export type ViewerMode = "instagram" | "webtoon" | "slide";

export interface WebtoonComicViewerProps {
  cuts: {
    cutId: string;
    imageUrl?: string;
    index: number;
    dialogue?: string;
  }[];
  title?: string;
  caption?: string;
  hashtags?: string[];
  authorName?: string;
  open: boolean;
  onClose: () => void;
  initialPage?: number;
  initialMode?: ViewerMode;
}

export function WebtoonComicViewer({
  cuts,
  title = "4컷 웹툰 미리보기",
  caption,
  hashtags = [],
  authorName = "sharktoon_official",
  open,
  onClose,
  initialPage = 0,
  initialMode = "instagram",
}: WebtoonComicViewerProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [mode, setMode] = useState<ViewerMode>(initialMode);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [slideDirection, setSlideDirection] = useState(0);

  const validCuts = cuts.filter((c) => Boolean(c.imageUrl));
  const totalCuts = validCuts.length;

  // 키보드 단축키 지원 (ESC: 닫기, 좌/우: 컷 이동)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        setSlideDirection(-1);
        setCurrentPage((p) => Math.max(0, p - 1));
      } else if (e.key === "ArrowRight") {
        setSlideDirection(1);
        setCurrentPage((p) => Math.min(totalCuts - 1, p + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, totalCuts]);

  const handlePrev = useCallback(() => {
    if (currentPage > 0) {
      setSlideDirection(-1);
      setCurrentPage((p) => p - 1);
    }
  }, [currentPage]);

  const handleNext = useCallback(() => {
    if (currentPage < totalCuts - 1) {
      setSlideDirection(1);
      setCurrentPage((p) => p + 1);
    }
  }, [currentPage, totalCuts]);

  // 더블 클릭/탭 좋아요 인터랙션
  const handleDoubleTap = () => {
    setIsLiked(true);
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 900);
  };

  if (!open) return null;

  if (totalCuts === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl bg-surface-card p-6 text-center shadow-2xl border border-border">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-accent" />
          <h3 className="text-lg font-bold text-ink">생성된 컷이 없습니다</h3>
          <p className="mt-1 text-sm text-ink-muted">
            아직 완료된 컷 이미지가 없습니다. 생성이 완료된 후 뷰어를 열어주세요.
          </p>
          <div className="mt-5">
            <Button variant="secondary" onClick={onClose} block>
              닫기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentCut = validCuts[currentPage] || validCuts[0];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-md animate-in fade-in duration-200">
      {/* 1. 상단 글로벌 네비게이션 헤더 */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 md:px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-black text-xs shadow-md shadow-accent/30">
            ST
          </div>
          <div className="hidden sm:block">
            <h2 className="text-sm font-semibold text-white tracking-tight">{title}</h2>
            <p className="text-[11px] text-white/60">
              총 {totalCuts}컷 &bull; {mode === "instagram" ? "인스타 캐러셀" : mode === "webtoon" ? "세로 스크롤" : "슬라이드"}
            </p>
          </div>
        </div>

        {/* 뷰어 모드 전환 탭 */}
        <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setMode("instagram")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
              mode === "instagram"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-white/70 hover:text-white hover:bg-white/5",
            )}
            title="인스타그램 모바일 피드 캐러셀 뷰"
          >
            <Smartphone className="size-3.5" />
            <span className="hidden md:inline">인스타 모바일 뷰</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("webtoon")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
              mode === "webtoon"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-white/70 hover:text-white hover:bg-white/5",
            )}
            title="한국 웹툰 세로 스크롤 정주행 뷰"
          >
            <ScrollText className="size-3.5" />
            <span className="hidden md:inline">웹툰 세로 뷰</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("slide")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
              mode === "slide"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-white/70 hover:text-white hover:bg-white/5",
            )}
            title="대형 슬라이드 뷰"
          >
            <Layers className="size-3.5" />
            <span className="hidden md:inline">슬라이드 뷰</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          title="닫기 (ESC)"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* 2. 메인 뷰어 영역 */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-2 sm:p-4">
        {/* ========================================================================= */}
        {/* MODE A: 인스타그램 모바일 피드 뷰 (iPhone 16 Mockup)                       */}
        {/* ========================================================================= */}
        {mode === "instagram" && (
          <div className="relative flex h-full w-full max-w-[390px] max-h-[810px] flex-col rounded-[48px] border-[10px] border-neutral-800 bg-black shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden">
            {/* iPhone Dynamic Island */}
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 h-6 w-24 rounded-full bg-neutral-900 flex items-center justify-end pr-2.5">
              <div className="size-2.5 rounded-full bg-neutral-950 border border-neutral-800" />
            </div>

            {/* iPhone Status Bar */}
            <div className="flex h-11 shrink-0 items-center justify-between px-6 pt-1 text-[11px] font-bold text-white z-20 select-none">
              <span>9:41</span>
              <div className="flex items-center gap-1.5 opacity-90">
                <span className="text-[10px]">5G</span>
                <div className="h-2.5 w-4 rounded-xs border border-white/80 p-0.5">
                  <div className="h-full w-full bg-white rounded-2xs" />
                </div>
              </div>
            </div>

            {/* Instagram App Header */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-900 px-4 select-none">
              <span className="font-serif text-lg font-bold tracking-tight text-white">Instagram</span>
              <div className="flex items-center gap-4 text-white">
                <Heart className="size-5 cursor-pointer hover:opacity-75 transition-opacity" />
                <Send className="size-5 cursor-pointer hover:opacity-75 transition-opacity -rotate-12" />
              </div>
            </div>

            {/* Instagram Post Author Header */}
            <div className="flex h-12 shrink-0 items-center justify-between px-3 select-none">
              <div className="flex items-center gap-2.5">
                {/* 스토리 링 아바타 */}
                <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[2px]">
                  <div className="size-full rounded-full bg-neutral-950 flex items-center justify-center text-xs font-bold text-white">
                    ST
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-white">{authorName}</span>
                    <span className="text-[10px] text-white/50">&bull; 팔로우</span>
                  </div>
                  <span className="text-[10px] text-white/60">{title}</span>
                </div>
              </div>
              <MoreHorizontal className="size-4 text-white/60 cursor-pointer" />
            </div>

            {/* Instagram Carousel Image View (1:1 / 4:5 Slider) */}
            <div
              className="relative aspect-square w-full shrink-0 bg-neutral-950 overflow-hidden select-none"
              onDoubleClick={handleDoubleTap}
            >
              <AnimatePresence initial={false} custom={slideDirection} mode="wait">
                <motion.div
                  key={currentCut.cutId}
                  custom={slideDirection}
                  initial={{ opacity: 0, x: slideDirection > 0 ? 100 : -100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: slideDirection > 0 ? -100 : 100 }}
                  transition={{ type: "spring", stiffness: 350, damping: 32 }}
                  className="size-full flex items-center justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentCut.imageUrl}
                    alt={`${currentCut.index}컷`}
                    className="size-full object-contain"
                    draggable={false}
                  />
                </motion.div>
              </AnimatePresence>

              {/* 우측 상단 인디케이터 배지 (예: 1/4) */}
              <div className="absolute top-3 right-3 rounded-full bg-black/65 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md pointer-events-none">
                {currentPage + 1}/{totalCuts}
              </div>

              {/* 좌우 내비게이션 화살표 */}
              {currentPage > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-all cursor-pointer backdrop-blur-xs"
                >
                  <ChevronLeft className="size-4" />
                </button>
              )}
              {currentPage < totalCuts - 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-all cursor-pointer backdrop-blur-xs"
                >
                  <ChevronRight className="size-4" />
                </button>
              )}

              {/* 더블탭 하트 애니메이션 버스트 */}
              <AnimatePresence>
                {showHeartBurst && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    <Heart className="size-24 fill-red-500 text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Instagram Action Bar & Dots */}
            <div className="flex h-11 shrink-0 items-center justify-between px-3 select-none">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsLiked(!isLiked)}
                  className="cursor-pointer transition-transform active:scale-125"
                >
                  <Heart
                    className={cn(
                      "size-5 transition-colors",
                      isLiked ? "fill-red-500 text-red-500" : "text-white hover:opacity-75",
                    )}
                  />
                </button>
                <MessageCircle className="size-5 text-white cursor-pointer hover:opacity-75 transition-opacity" />
                <Send className="size-5 text-white cursor-pointer hover:opacity-75 transition-opacity -rotate-12" />
              </div>

              {/* 인스타그램 캐러셀 페이지 도트 인디케이터 */}
              <div className="flex items-center gap-1">
                {validCuts.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSlideDirection(idx > currentPage ? 1 : -1);
                      setCurrentPage(idx);
                    }}
                    className={cn(
                      "rounded-full transition-all cursor-pointer",
                      currentPage === idx
                        ? "size-1.5 bg-blue-500 scale-125"
                        : "size-1 bg-white/40 hover:bg-white/70",
                    )}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsBookmarked(!isBookmarked)}
                className="cursor-pointer transition-transform active:scale-125"
              >
                <Bookmark
                  className={cn(
                    "size-5 transition-colors",
                    isBookmarked ? "fill-white text-white" : "text-white hover:opacity-75",
                  )}
                />
              </button>
            </div>

            {/* Instagram Caption & Comments Scroll Area */}
            <div className="flex-1 overflow-y-auto px-3.5 pb-4 text-xs select-text">
              <p className="font-bold text-white mb-1">
                좋아요 {isLiked ? "1,429" : "1,428"}개
              </p>
              <div className="space-y-1">
                <p className="leading-snug text-neutral-200">
                  <span className="font-bold text-white mr-1.5">{authorName}</span>
                  {caption ? (
                    showFullCaption ? (
                      <span>{caption}</span>
                    ) : (
                      <span>
                        {caption.slice(0, 50)}...
                        <button
                          type="button"
                          onClick={() => setShowFullCaption(true)}
                          className="ml-1 text-neutral-400 hover:text-white cursor-pointer font-medium"
                        >
                          더 보기
                        </button>
                      </span>
                    )
                  ) : (
                    <span>{title} 오늘 저녁 첫 인스타툰 릴리즈! 💖 재미있게 봐주세요 :)</span>
                  )}
                </p>

                {/* 해시태그 목록 */}
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 text-blue-400 text-[11px]">
                    {hashtags.slice(0, 6).map((t, i) => (
                      <span key={i}>{t.startsWith("#") ? t : `#${t}`}</span>
                    ))}
                  </div>
                )}

                <p className="pt-1 text-[11px] text-neutral-500 cursor-pointer hover:text-neutral-400">
                  댓글 38개 모두 보기
                </p>
                <p className="text-[10px] text-neutral-600">2시간 전 &bull; 추천 게시물</p>
              </div>
            </div>

            {/* iPhone Home Indicator Bar */}
            <div className="flex h-5 shrink-0 items-center justify-center pb-1 z-20">
              <div className="h-1 w-28 rounded-full bg-white/40" />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE B: 한국 웹툰 세로 스크롤 정주행 뷰 (Naver/Kakao Webtoon Style)          */}
        {/* ========================================================================= */}
        {mode === "webtoon" && (
          <div className="relative flex h-full w-full max-w-[560px] flex-col rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl overflow-hidden">
            {/* 세로 웹툰 헤더 바 */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-neutral-900/80 px-4 backdrop-blur-md z-10">
              <span className="text-xs font-bold text-white">{title} (정주행)</span>
              <span className="text-[11px] text-white/60">총 {totalCuts}화 완결</span>
            </div>

            {/* 연속 세로 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {validCuts.map((cut, idx) => (
                <div key={cut.cutId} className="flex flex-col items-center">
                  <div className="mb-2 flex items-center gap-1.5 self-start rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/80">
                    <span>CUT {cut.index}</span>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cut.imageUrl}
                    alt={`${cut.index}컷`}
                    className="w-full rounded-xl object-contain shadow-lg border border-white/5"
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                </div>
              ))}

              {/* 회차 완독 카드 */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center mt-8">
                <p className="text-sm font-bold text-white">🎉 회차를 모두 감상했습니다!</p>
                <p className="mt-1 text-xs text-white/60">
                  인스타그램에 공유하여 독자들과 소통해 보세요.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const container = document.querySelector(".overflow-y-auto");
                      container?.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <ArrowUp className="mr-1.5 size-3.5" />
                    맨 위로
                  </Button>
                  <Button size="sm" variant="primary" onClick={onClose}>
                    닫기
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE C: 와이드 슬라이드 뷰 (Slide Carousel Mode)                           */}
        {/* ========================================================================= */}
        {mode === "slide" && (
          <div className="relative flex h-full w-full max-w-4xl flex-col items-center justify-center">
            <div className="relative flex h-full max-h-[75vh] w-full items-center justify-center">
              <AnimatePresence initial={false} custom={slideDirection} mode="wait">
                <motion.div
                  key={currentCut.cutId}
                  custom={slideDirection}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full w-full items-center justify-center p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentCut.imageUrl}
                    alt={`${currentCut.index}컷`}
                    className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
                  />
                </motion.div>
              </AnimatePresence>

              {/* 좌우 이동 버튼 */}
              {currentPage > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-all cursor-pointer"
                  aria-label="이전 컷"
                >
                  <ChevronLeft className="size-6" />
                </button>
              )}
              {currentPage < totalCuts - 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-all cursor-pointer"
                  aria-label="다음 컷"
                >
                  <ChevronRight className="size-6" />
                </button>
              )}
            </div>

            {/* 현재 페이지 인디케이터 배지 */}
            <div className="mt-3 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
              {currentPage + 1} / {totalCuts}컷
            </div>
          </div>
        )}
      </main>

      {/* 3. 하단 썸네일 스트립 네비게이터 (인스타 모드 & 슬라이드 모드 공통 지원) */}
      {mode !== "webtoon" && (
        <footer className="flex h-20 shrink-0 items-center justify-center gap-2 border-t border-white/10 bg-black/60 px-4 backdrop-blur-md">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {validCuts.map((c, idx) => (
              <button
                key={c.cutId}
                type="button"
                onClick={() => {
                  setSlideDirection(idx > currentPage ? 1 : -1);
                  setCurrentPage(idx);
                }}
                className={cn(
                  "group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all cursor-pointer",
                  currentPage === idx
                    ? "border-accent scale-105 shadow-md shadow-accent/40"
                    : "border-white/20 opacity-60 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.imageUrl}
                  alt={`${c.index}컷`}
                  className="size-full object-cover"
                />
                <span className="absolute bottom-1 right-1 rounded-md bg-black/75 px-1 text-[9px] font-bold text-white">
                  {c.index}
                </span>
              </button>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
