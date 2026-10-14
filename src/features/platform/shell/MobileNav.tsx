"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Home, BookOpen, Sparkles, User } from "lucide-react";

export interface MobileNavProps {
  seriesHref: string | null;
  streak?: number;
}

export function MobileNav({ seriesHref, streak = 0 }: MobileNavProps) {
  const path = usePathname();

  const ITEMS = [
    { href: "/home", label: "홈", icon: Home, match: undefined as string | undefined },
    ...(seriesHref
      ? [{ href: seriesHref, label: "시리즈", icon: BookOpen, match: "/series" }]
      : []),
    { href: "/assets", label: "에셋", icon: Sparkles, match: undefined },
    { href: "/settings", label: "마이페이지", icon: User, match: undefined },
  ];

  return (
    <nav
      aria-label="하단 모바일 메뉴"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border/80 bg-surface-card/95 px-2 backdrop-blur-md md:hidden"
    >
      {ITEMS.map((it) => {
        const active = path.startsWith(it.match ?? it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center transition-colors",
              active ? "text-brand font-bold" : "text-ink-muted hover:text-ink",
            )}
          >
            <div className="relative">
              <Icon className="size-5 shrink-0" />
              {it.href === "/settings" && streak > 0 && (
                <span className="absolute -top-1.5 -right-3 rounded-full bg-brand px-1 text-[9px] font-bold text-on-brand leading-tight">
                  {streak}
                </span>
              )}
            </div>
            <span className="text-[11px] leading-none">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

