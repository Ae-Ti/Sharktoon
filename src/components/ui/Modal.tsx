"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** 버튼 줄. 주 동작을 오른쪽에 둔다. */
  footer?: ReactNode;
  /** 모바일에서 바텀시트로 붙는다. 기본 true. */
  sheetOnMobile?: boolean;
  /** 배경 클릭·ESC 로 닫을 수 있는지. 되돌릴 수 없는 확인에서는 false. 기본 true. */
  dismissible?: boolean;
  /** 데스크톱에서의 최대 너비. */
  size?: "sm" | "md";
}

/**
 * 네이티브 <dialog> 를 쓴다. 포커스 가둠, ESC, 페이지 스크롤 잠금을
 * 브라우저가 해 주므로 직접 만들지 않는다.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  sheetOnMobile = true,
  dismissible = true,
  size = "sm",
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // 한 화면에 모달이 둘 이상 있을 수 있다. 고정 id 를 쓰면 중복된다.
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // ESC. dismissible 이 아니면 브라우저 기본 닫기를 막는다.
        if (!dismissible) {
          e.preventDefault();
          return;
        }
        onClose();
      }}
      onClick={(e) => {
        if (!dismissible) return;
        // 배경(dialog 자신)을 눌렀을 때만 닫는다. 패널 안쪽 클릭은 통과시킨다.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 max-h-dvh w-full border-0 bg-transparent p-0 text-ink",
        // 모바일: 아래 붙는 시트. 데스크톱: 가운데.
        sheetOnMobile
          ? "mt-auto mb-0 sm:my-auto"
          : "my-auto",
        "sm:mx-auto",
        size === "sm" ? "sm:max-w-[420px]" : "sm:max-w-[560px]",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-4 bg-surface-card p-6 shadow-lg",
          sheetOnMobile ? "rounded-t-xl sm:rounded-xl" : "rounded-xl",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-title font-semibold">
              {title}
            </h2>
            {description && (
              <p className="text-body-sm text-ink-muted">{description}</p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              className="grid size-control-sm shrink-0 cursor-pointer place-items-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>

        {children}

        {footer && <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </dialog>
  );
}
