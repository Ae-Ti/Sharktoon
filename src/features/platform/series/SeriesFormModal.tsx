"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  createSeriesAction,
  updateSeriesRuleAction,
} from "@/features/platform/actions";
import type { SeriesRule } from "@/features/platform/data/types";

const STYLES = ["심플 라인", "파스텔", "굵은 선"];
const CUTS = [4, 6, 8];
const RATIOS: SeriesRule["aspectRatio"][] = ["1:1", "4:5"];

const DEFAULT_RULE: SeriesRule = {
  stylePreset: "심플 라인",
  defaultCutCount: 6,
  aspectRatio: "4:5",
  tone: null,
  fixedHashtags: [],
};

export interface SeriesFormModalProps {
  open: boolean;
  onClose: () => void;
  /** 있으면 생성 규칙 수정, 없으면 새 시리즈. */
  seriesId?: string;
  initialTitle?: string;
  initialRule?: SeriesRule;
}

export function SeriesFormModal({
  open,
  onClose,
  seriesId,
  initialTitle = "",
  initialRule = DEFAULT_RULE,
}: SeriesFormModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [rule, setRule] = useState<SeriesRule>(initialRule);
  const [hashtags, setHashtags] = useState(initialRule.fixedHashtags.join(" "));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const editing = Boolean(seriesId);

  function set<K extends keyof SeriesRule>(k: K, v: SeriesRule[K]) {
    setRule((r) => ({ ...r, [k]: v }));
  }

  function submit() {
    if (!editing && !title.trim()) {
      setError("시리즈 이름을 적어 주세요.");
      return;
    }
    const next: SeriesRule = {
      ...rule,
      fixedHashtags: hashtags.split(/\s+/).filter((h) => h.startsWith("#")),
    };
    start(async () => {
      const r = editing
        ? await updateSeriesRuleAction(seriesId as string, next)
        : await createSeriesAction({
            title: title.trim(),
            description: null,
            rule: next,
          });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onClose();
      if (!editing && "id" in r) router.push(`/series/${r.id}`);
    });
  }

  const pill = (active: boolean) =>
    cn(
      "h-control-md cursor-pointer rounded-md px-4 text-label font-semibold",
      active
        ? "border-2 border-brand bg-brand-tint"
        : "border border-border-control bg-surface-card",
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={editing ? "생성 규칙 수정" : "새 시리즈"}
      description={
        editing
          ? "여기서 정한 규칙이 이 시리즈의 모든 새 회차에 들어가요."
          : "규칙을 한 번 정해 두면 다음 화부터는 사연만 적으면 돼요."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button loading={pending} onClick={submit}>
            {editing ? "저장" : "만들기"}
          </Button>
        </>
      }
    >
      {!editing && (
        <Field
          label="시리즈 이름"
          value={title}
          onChange={setTitle}
          placeholder="직장 상사 빌런"
        />
      )}

      <div className="flex flex-col gap-2">
        <span className="text-label font-semibold">그림체</span>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={rule.stylePreset === s}
              onClick={() => set("stylePreset", s)}
              className={pill(rule.stylePreset === s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-label font-semibold">기본 컷 수</span>
          <div className="flex gap-2">
            {CUTS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rule.defaultCutCount === n}
                onClick={() => set("defaultCutCount", n)}
                className={pill(rule.defaultCutCount === n)}
              >
                {n}컷
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-label font-semibold">비율</span>
          <div className="flex gap-2">
            {RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={rule.aspectRatio === r}
                onClick={() => set("aspectRatio", r)}
                className={pill(rule.aspectRatio === r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Field
        label="말투"
        value={rule.tone ?? ""}
        onChange={(v) => set("tone", v || null)}
        placeholder="반말 · 자조적"
        help="대사와 캡션이 이 말투를 따라가요."
        optional
      />

      <Field
        label="고정 해시태그"
        value={hashtags}
        onChange={setHashtags}
        placeholder="#직장상사빌런 #샥툰"
        help="매 화 캡션에 자동으로 붙어요. 화별 해시태그와는 구분돼요."
        optional
      />

      {error && <p className="text-body-sm text-danger">{error}</p>}
    </Modal>
  );
}
