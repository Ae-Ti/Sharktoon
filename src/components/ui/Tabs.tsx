"use client";

import { cn } from "@/lib/cn";

export interface TabItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
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
    // 좁은 화면에서는 줄바꿈 대신 가로로 밀어 본다.
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border scrollbar-none">
      {items.map((item, i) => {
        const selected = value === i;
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange?.(i)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap h-control-md cursor-pointer px-3 text-label font-semibold sm:px-4",
              "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
              selected
                ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand after:content-['']"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "hidden size-4 shrink-0 transition-colors sm:block",
                  selected ? "text-brand" : "text-ink-muted",
                )}
              />
            )}
            <span>{item.label}</span>
            {item.count != null && (
              <span className="ml-0.5 font-medium text-ink-subtle">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
