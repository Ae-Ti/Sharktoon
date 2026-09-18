"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface SideNavProps {
  /** 가장 최근 시리즈. 없으면 시리즈 항목을 감춘다. */
  seriesHref: string | null;
}

export function SideNav({ seriesHref }: SideNavProps) {
  const path = usePathname();

  const ITEMS = [
    { href: "/home", label: "홈", match: undefined as string | undefined },
    ...(seriesHref
      ? [{ href: seriesHref, label: "시리즈", match: "/series" }]
      : []),
    { href: "/assets", label: "에셋", match: undefined },
    { href: "/admin", label: "운영", match: undefined },
  ];

  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-0.5">
      {ITEMS.map((it) => {
        const active = path.startsWith(it.match ?? it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-control-md items-center rounded-md px-2.5 text-label font-semibold",
              active ? "bg-brand-tint text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
