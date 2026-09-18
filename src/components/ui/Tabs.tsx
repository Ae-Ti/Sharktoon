"use client";

import { cn } from "@/lib/cn";

export interface TabItem {
  label: string;
  /** 비어 있는 탭을 눌러보고 나서야 알게 되지 않도록 항상 준다. 0 도 보여준다. */
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value?: number;
  onChange?: (index: number) => void;
}

export function Tabs({ items, value = 0, onChange }: TabsProps) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-border">
      {items.map((item, i) => {
        const selected = value === i;
        return (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange?.(i)}
            className={cn(
              "relative h-control-md cursor-pointer px-4 text-label font-semibold",
              "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
              selected
                ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand after:content-['']"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
            {item.count != null && (
              <span className="ml-1 font-medium text-ink-subtle">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
