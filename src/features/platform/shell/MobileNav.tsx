"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Plus, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MobileNavProps {
  seriesHref: string | null;
}

export function MobileNav({ seriesHref }: MobileNavProps) {
  const path = usePathname();

  return (
    <nav
      aria-label="모바일 하단 메뉴"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border/80 bg-surface-card/95 px-2 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden shadow-lg"
    >
      {/* 홈 */}
      <Link
        href="/home"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors cursor-pointer",
          path === "/home" ? "text-brand font-bold" : "text-ink-muted hover:text-ink"
        )}
      >
        <Home className={cn("size-5", path === "/home" ? "stroke-[2.5]" : "stroke-2")} />
        <span className="text-[11px] leading-none">홈</span>
      </Link>

      {/* 시리즈 */}
      <Link
        href={seriesHref || "/series"}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors cursor-pointer",
          path.startsWith("/series") ? "text-brand font-bold" : "text-ink-muted hover:text-ink"
        )}
      >
        <BookOpen className={cn("size-5", path.startsWith("/series") ? "stroke-[2.5]" : "stroke-2")} />
        <span className="text-[11px] leading-none">시리즈</span>
      </Link>

      {/* 새 만화 제작 중앙 플로팅 버튼 */}
      <div className="flex flex-1 items-center justify-center">
        <Link
          href="/onboarding/character"
          aria-label="새 인스타툰 만들기"
          className="flex size-11 items-center justify-center rounded-full bg-brand text-on-brand shadow-md active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="size-6 stroke-[2.5]" />
        </Link>
      </div>

      {/* 에셋 */}
      <Link
        href="/assets"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors cursor-pointer",
          path.startsWith("/assets") ? "text-brand font-bold" : "text-ink-muted hover:text-ink"
        )}
      >
        <Sparkles className={cn("size-5", path.startsWith("/assets") ? "stroke-[2.5]" : "stroke-2")} />
        <span className="text-[11px] leading-none">에셋</span>
      </Link>

      {/* 설정 */}
      <Link
        href="/settings"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors cursor-pointer",
          path.startsWith("/settings") ? "text-brand font-bold" : "text-ink-muted hover:text-ink"
        )}
      >
        <Settings className={cn("size-5", path.startsWith("/settings") ? "stroke-[2.5]" : "stroke-2")} />
        <span className="text-[11px] leading-none">설정</span>
      </Link>
    </nav>
  );
}
