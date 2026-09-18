"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/home", label: "홈" },
  { href: "/series/sr_villain", label: "시리즈", match: "/series" },
  { href: "/assets", label: "에셋" },
  { href: "/admin", label: "운영" },
];

export function SideNav() {
  const path = usePathname();

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
