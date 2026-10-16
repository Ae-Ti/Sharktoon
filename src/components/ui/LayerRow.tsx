"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

export interface LayerRowProps {
  name: string;
  /** 레이어 종류 약자 (선택): 배경 / 캐릭 / 말풍 / 텍스트 / 효과. */
  kindShort?: string;
  /** 이미지에 굽지 않은 벡터 레이어. 말풍선·텍스트·나레이션·효과음에만 켠다. */
  vector?: boolean;
  selected?: boolean;
  hidden?: boolean;
  onSelect?: () => void;
  onDoubleClick?: () => void;
  onToggle?: () => void;
  /** 이름 변경 콜백. 전달되면 목록에서 더블 클릭 시 인라인 편집을 지원합니다. */
  onRename?: (newName: string) => void;
}

export function LayerRow({
  name,
  kindShort,
  vector,
  selected,
  hidden,
  onSelect,
  onDoubleClick,
  onToggle,
  onRename,
}: LayerRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(name);
  }, [name]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      onRename?.(trimmed);
    } else {
      setEditValue(name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(name);
      setIsEditing(false);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (onRename) {
      e.stopPropagation();
      setIsEditing(true);
    } else {
      onDoubleClick?.();
    }
  };

  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={isEditing ? undefined : onSelect}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "flex h-control-md cursor-pointer items-center gap-2 rounded-md px-2 transition-colors",
        selected ? "bg-brand-tint" : "hover:bg-surface-sunken",
      )}
    >
      <span aria-hidden className="cursor-grab text-label text-ink-subtle select-none">
        ≡
      </span>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          maxLength={30}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          className="h-6 min-w-0 flex-1 rounded border border-brand bg-surface-card px-1.5 text-label font-medium text-ink shadow-2xs outline-none ring-1 ring-brand"
        />
      ) : (
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-label select-none",
            hidden ? "text-ink-subtle line-through" : "text-ink",
          )}
          title="더블클릭하여 레이어 이름 변경"
        >
          {name}
        </span>
      )}

      <button
        type="button"
        aria-label={hidden ? "레이어 보이기" : "레이어 숨기기"}
        title={hidden ? "레이어 보이기" : "레이어 숨기기"}
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        className={cn(
          "grid size-7 cursor-pointer place-items-center rounded-md transition-colors",
          hidden
            ? "text-ink-subtle opacity-40 hover:opacity-100 hover:bg-surface-card hover:text-ink"
            : "text-ink-muted hover:bg-surface-card hover:text-brand",
        )}
      >
        {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
