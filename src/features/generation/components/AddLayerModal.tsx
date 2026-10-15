"use client";

import { useState, useEffect } from "react";
import { Modal, Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  MessageSquare,
  Cloud,
  Flame,
  Scroll,
  PanelBottom,
  Zap,
  Heading,
  Type,
  Check,
} from "lucide-react";
import type { ElementPresetId } from "../editor/ElementPalette";

export interface AddLayerModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (presetId: ElementPresetId, text?: string) => void;
}

export interface LayerPresetOption {
  id: ElementPresetId;
  label: string;
  category: "말풍선" | "나레이션" | "효과음 · 텍스트";
  desc: string;
  defaultText: string;
  icon: typeof MessageSquare;
  iconBg: string;
  iconColor: string;
  badgeTone: string;
}

export const LAYER_PRESET_OPTIONS: LayerPresetOption[] = [
  {
    id: "balloon_normal",
    label: "대사 말풍선",
    category: "말풍선",
    desc: "인물의 기본 대사 및 말꼬리",
    defaultText: "대사를 적어요",
    icon: MessageSquare,
    iconBg: "bg-brand/10",
    iconColor: "text-brand",
    badgeTone: "bg-brand/15 text-brand",
  },
  {
    id: "balloon_thought",
    label: "생각 말풍선",
    category: "말풍선",
    desc: "속마음을 표현하는 방울 꼬리",
    defaultText: "속마음 생각...",
    icon: Cloud,
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-500",
    badgeTone: "bg-sky-500/15 text-sky-600",
  },
  {
    id: "balloon_shout",
    label: "외침 말풍선",
    category: "말풍선",
    desc: "놀람과 외침을 나타내는 강조 테두리",
    defaultText: "앗 깜짝이야!",
    icon: Flame,
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-500",
    badgeTone: "bg-rose-500/15 text-rose-600",
  },
  {
    id: "narration_top",
    label: "상단 나레이션",
    category: "나레이션",
    desc: "컷 상단에 고정되는 상황 설명 박스",
    defaultText: "어느 날 오후...",
    icon: Scroll,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600",
    badgeTone: "bg-amber-500/15 text-amber-700",
  },
  {
    id: "narration_bottom",
    label: "하단 나레이션",
    category: "나레이션",
    desc: "컷 하단에 배치되는 여운/설명 박스",
    defaultText: "상황을 설명하는 나레이션",
    icon: PanelBottom,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600",
    badgeTone: "bg-amber-500/15 text-amber-700",
  },
  {
    id: "sfx",
    label: "효과음 (SFX)",
    category: "효과음 · 텍스트",
    desc: "장면을 실감나게 만드는 큰 소리 글자",
    defaultText: "쿵!!",
    icon: Zap,
    iconBg: "bg-yellow-500/10",
    iconColor: "text-yellow-600",
    badgeTone: "bg-yellow-500/15 text-yellow-700",
  },
  {
    id: "title_hook",
    label: "제목 · 후킹",
    category: "효과음 · 텍스트",
    desc: "첫 컷 상단 독자 시선을 끄는 제목",
    defaultText: "첫 컷 제목 문구",
    icon: Heading,
    iconBg: "bg-brand/10",
    iconColor: "text-brand",
    badgeTone: "bg-brand/15 text-brand",
  },
  {
    id: "text",
    label: "자유 텍스트",
    category: "효과음 · 텍스트",
    desc: "배경 없이 자유롭게 배치하는 글자",
    defaultText: "여기에 글",
    icon: Type,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-600",
    badgeTone: "bg-violet-500/15 text-violet-700",
  },
];

export function AddLayerModal({ open, onClose, onAdd }: AddLayerModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<ElementPresetId>("balloon_normal");
  const [text, setText] = useState<string>("대사를 적어요");

  // 프리셋 변경 시 기본 텍스트 자동 동기화 (사용자가 변경하지 않았을 경우)
  const handleSelectPreset = (presetId: ElementPresetId) => {
    setSelectedPreset(presetId);
    const target = LAYER_PRESET_OPTIONS.find((p) => p.id === presetId);
    if (target) {
      setText(target.defaultText);
    }
  };

  const handleConfirm = () => {
    onAdd(selectedPreset, text);
    onClose();
  };

  // 모달이 새로 열릴 때 초기 상태로 리셋
  useEffect(() => {
    if (open) {
      setSelectedPreset("balloon_normal");
      setText("대사를 적어요");
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      sheetOnMobile={false}
      size="md"
      title="새 레이어 추가"
      description="원하는 레이어 종류와 문구를 선택하여 컷에 추가하세요."
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleConfirm} className="font-bold">
            + 레이어 생성
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 레이어 종류 선택 그리드 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-label font-bold text-ink">레이어 종류 선택</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[46vh] overflow-y-auto p-1.5 -m-1.5">
            {LAYER_PRESET_OPTIONS.map((item) => {
              const isSelected = selectedPreset === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectPreset(item.id)}
                  onDoubleClick={handleConfirm}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 text-left transition-all cursor-pointer focus:outline-none",
                    isSelected
                      ? "border-brand bg-brand-tint/50 shadow-xs ring-2 ring-brand/30"
                      : "border-border/80 bg-surface-card hover:border-brand/60 hover:bg-surface-sunken/40",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg shadow-2xs",
                        item.iconBg,
                        item.iconColor,
                      )}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-ink truncate">{item.label}</span>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.2 text-[9px] font-bold shrink-0",
                            item.badgeTone,
                          )}
                        >
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-ink-muted truncate">{item.desc}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="size-4.5 text-brand stroke-[2.5] shrink-0 ml-1.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 텍스트 내용 입력 필드 */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/80">
          <div className="flex items-center justify-between">
            <label className="text-label font-bold text-ink">기본 텍스트 / 문구</label>
            <span className="text-[11px] text-ink-muted">나중에 캔버스에서도 자유롭게 수정 가능해요</span>
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="추가할 문구를 입력하세요"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
              }
            }}
            className="min-h-[40px] rounded-lg border border-border-control/80 bg-surface-card px-3 py-2 text-body-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs transition-all"
          />
        </div>
      </div>
    </Modal>
  );
}
