"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Home, BookOpen, Sparkles, User, ShieldAlert } from "lucide-react";

export interface SideNavProps {
  /** 가장 최근 시리즈. 없으면 시리즈 항목을 감춘다. */
  seriesHref: string | null;
  /** 관리자 계정에만 운영 페이지 링크를 노출한다. */
  isAdmin?: boolean;
  /** 연속 출석 일수 */
  streak?: number;
}

export function SideNav({ seriesHref, isAdmin = false, streak = 0 }: SideNavProps) {
  const path = usePathname();

  const ITEMS = [
    { href: "/home", label: "홈", icon: Home, match: undefined as string | undefined },
    ...(seriesHref
      ? [{ href: seriesHref, label: "시리즈", icon: BookOpen, match: "/series" }]
      : []),
    { href: "/assets", label: "에셋 라이브러리", icon: Sparkles, match: undefined },
    { href: "/settings", label: "마이페이지", icon: User, match: undefined },
    ...(isAdmin ? [{ href: "/admin", label: "관리자 운영", icon: ShieldAlert, match: undefined }] : []),
  ];

  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-1">
      {ITEMS.map((it) => {
        const active = path.startsWith(it.match ?? it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-control-md items-center gap-2.5 rounded-lg px-2.5 text-label font-medium transition-all",
              active ? "bg-brand-tint font-bold text-brand shadow-2xs" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-ink-muted")} />
            <span className="flex-1">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
