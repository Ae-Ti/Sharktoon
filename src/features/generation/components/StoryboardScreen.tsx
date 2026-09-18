"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  ChoiceCard,
  EmptyState,
  Field,
  Modal,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { CREDIT_COST } from "@/contracts/credit";
import {
  CAMERA_LABEL,
  EMOTION_LABEL,
  canGenerate,
  reindexCuts,
  type Storyboard,
  type StoryboardCut,
} from "../types/storyboard";
import { BALLOON_LABEL } from "../types/layer";
import { MOCK_CHARACTERS } from "../mocks/storyboard";
import {
  generateStoryboardAction,
  startGenerationAction,
  type ActionResult,
} from "../actions";
import { EpisodeHeader } from "./EpisodeHeader";

/** PRD 2.2 — 사연 기반 콘티 생성. 이미지 생성 전에 컷을 손보는 화면이다. */
export interface StoryboardScreenProps {
  initial: Storyboard;
  /** 회차 컨텍스트(태일). 없으면 목으로 보고 있는 중이다. */
  seriesTitle: string;
  episodeTitle: string;
}

export function StoryboardScreen({
  initial,
  seriesTitle,
  episodeTitle,
}: StoryboardScreenProps) {
  const router = useRouter();
  const [sb, setSb] = useState(initial);
  const [story, setStory] = useState(initial.story);
  const [notice, setNotice] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<{ required: number; available: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.cuts[0]?.id ?? null,
  );

  const selected = sb.cuts.find((c) => c.id === selectedId) ?? null;
  const isFirst = selected?.index === 1;
  const isLast = selected != null && selected.index === sb.cuts.length;
  const ready = canGenerate(sb);
  const cost = sb.cuts.length * CREDIT_COST.cutImage;

  /** 액션 결과를 화면 상태로 옮긴다. 크레딧 부족만 시트를 연다. */
  function handle<T>(result: ActionResult<T>): T | null {
    if (result.ok) {
      setNotice(null);
      return result.data;
    }
    if (result.kind === "credit") {
      setShortfall({ required: result.required, available: result.available });
      return null;
    }
    setNotice(result.message);
    return null;
  }

  /** PRD 2.2 — 사연을 고쳐서 콘티를 다시 만든다. 크레딧을 쓰지 않는다. */
  function regenerateStoryboard() {
    startTransition(async () => {
      const data = handle(
        await generateStoryboardAction({
          story,
          episodeId: sb.episodeId,
          seriesId: sb.seriesId,
          cutCount: sb.cuts.length || 6,
        }),
      );
      if (data) setSb(data.storyboard);
    });
  }

  /** PRD 3.1.1 — 전체 생성을 큐에 등록하고 진행률 화면으로 넘긴다. */
  function startGeneration() {
    startTransition(async () => {
      const job = handle(await startGenerationAction(sb));
      if (job) router.push(`/episodes/${sb.episodeId}/generate?job=${job.id}`);
    });
  }

  function patchCut(id: string, patch: Partial<StoryboardCut>) {
    setSb((s) => ({
      ...s,
      cuts: s.cuts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function moveCut(id: string, dir: -1 | 1) {
    setSb((s) => {
      const from = s.cuts.findIndex((c) => c.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= s.cuts.length) return s;
      const next = [...s.cuts];
      [next[from], next[to]] = [next[to], next[from]];
      return { ...s, cuts: reindexCuts(next) };
    });
  }

  function removeCut(id: string) {
    setSb((s) => ({ ...s, cuts: reindexCuts(s.cuts.filter((c) => c.id !== id)) }));
    if (selectedId === id) setSelectedId(null);
  }

  function addCutAfter(id: string) {
    setSb((s) => {
      const at = s.cuts.findIndex((c) => c.id === id);
      const fresh: StoryboardCut = {
        id: `cut_new_${Date.now()}`,
        index: 0,
        scene: "",
        characterIds: [],
        emotion: "calm",
        camera: "medium",
        dialogue: [],
      };
      const next = [...s.cuts];
      next.splice(at + 1, 0, fresh);
      return { ...s, cuts: reindexCuts(next) };
    });
  }

  return (
    <div className="min-h-dvh bg-surface-page">
      <EpisodeHeader
        episodeId={sb.episodeId}
        seriesTitle={seriesTitle}
        episodeTitle={episodeTitle}
        current="storyboard"
        credits={12}
        action={
          <Button
            size="sm"
            cost={cost}
            disabled={!ready}
            // 실제로는 CreditLedger.hold 가 먼저 가고, 모자라면 충전 시트가 열린다.
            title={ready ? undefined : "후킹과 CTA를 먼저 고르세요"}
            loading={pending}
            onClick={startGeneration}
          >
            이미지 생성
          </Button>
        }
      />

      <main className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <StorySidebar
          story={story}
          cutCount={sb.cuts.length}
          pending={pending}
          onChange={setStory}
          onRegenerate={regenerateStoryboard}
        />

        <section aria-label="컷 목록" className="flex flex-col gap-3">
          {notice && (
            <p className="rounded-lg bg-danger-tint px-3 py-2 text-body-sm text-danger">
              {notice}
            </p>
          )}
          {sb.cuts.length === 0 ? (
            <EmptyState
              title="컷이 하나도 없어요"
              description="사연을 다시 넣으면 컷을 새로 만들어 드려요."
              actionLabel="콘티 다시 만들기"
            />
          ) : (
            sb.cuts.map((cut) => (
              <CutCard
                key={cut.id}
                cut={cut}
                total={sb.cuts.length}
                selected={cut.id === selectedId}
                hookText={
                  cut.index === 1
                    ? sb.hookOptions.find((h) => h.id === sb.selectedHookId)?.text
                    : undefined
                }
                ctaText={
                  cut.index === sb.cuts.length
                    ? sb.ctaOptions.find((c) => c.id === sb.selectedCtaId)?.text
                    : undefined
                }
                onSelect={() => setSelectedId(cut.id)}
                onMove={(dir) => moveCut(cut.id, dir)}
                onRemove={() => removeCut(cut.id)}
                onAddAfter={() => addCutAfter(cut.id)}
                onChangeLine={(lineId, text) =>
                  patchCut(cut.id, {
                    dialogue: cut.dialogue.map((l) =>
                      l.id === lineId ? { ...l, text } : l,
                    ),
                  })
                }
                onChangeNarration={(narration) => patchCut(cut.id, { narration })}
              />
            ))
          )}
        </section>

        <aside aria-label="컷 설정" className="flex flex-col gap-4">
          {isFirst && (
            <OptionPanel
              title="1컷 후킹"
              caption="첫 컷에서 멈추면 나머지 다섯 컷은 아무도 안 봅니다."
            >
              {sb.hookOptions.map((o) => (
                <ChoiceCard
                  key={o.id}
                  title={o.text}
                  description={o.rationale}
                  selected={sb.selectedHookId === o.id}
                  onClick={() => setSb((s) => ({ ...s, selectedHookId: o.id }))}
                />
              ))}
            </OptionPanel>
          )}

          {isLast && (
            <OptionPanel
              title="마지막 컷 CTA"
              caption="좋아요·다음 화·질문 중 하나만 고릅니다. 셋 다 넣으면 아무것도 안 합니다."
            >
              {sb.ctaOptions.map((o) => (
                <ChoiceCard
                  key={o.id}
                  title={o.text}
                  description={o.rationale}
                  selected={sb.selectedCtaId === o.id}
                  onClick={() => setSb((s) => ({ ...s, selectedCtaId: o.id }))}
                />
              ))}
            </OptionPanel>
          )}

          {selected && !isFirst && !isLast && (
            <OptionPanel title={`${selected.index}컷 설정`}>
              <dl className="flex flex-col gap-2 text-label">
                <Row label="감정">{EMOTION_LABEL[selected.emotion]}</Row>
                <Row label="카메라">{CAMERA_LABEL[selected.camera]}</Row>
                <Row label="등장인물">
                  {selected.characterIds.map((id) => MOCK_CHARACTERS[id]).join(", ") ||
                    "없음"}
                </Row>
              </dl>
            </OptionPanel>
          )}

          {!ready && (
            <p className="rounded-lg bg-warning-tint px-3 py-2 text-body-sm text-warning">
              후킹과 CTA를 고르면 이미지 생성으로 넘어갈 수 있어요.
            </p>
          )}
        </aside>
      </main>

      {/* 크레딧이 모자라면 버튼을 막는 대신 여기서 막고 충전으로 보낸다(credit.ts 주석). */}
      <Modal
        open={shortfall !== null}
        onClose={() => setShortfall(null)}
        title="크레딧이 모자라요"
        description={
          shortfall
            ? `이 작업에 ${shortfall.required}크레딧이 필요한데 ${shortfall.available}크레딧 남았어요.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setShortfall(null)}>
              나중에
            </Button>
            <Button onClick={() => router.push("/home")}>출석하고 받기</Button>
          </>
        }
      />
    </div>
  );
}

function StorySidebar({
  story,
  cutCount,
  pending,
  onChange,
  onRegenerate,
}: {
  story: string;
  cutCount: number;
  pending: boolean;
  onChange: (value: string) => void;
  onRegenerate: () => void;
}) {
  return (
    <aside aria-label="사연" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
        <h2 className="text-label font-semibold text-ink">입력한 사연</h2>
        <Field
          label="사연"
          multiline
          rows={7}
          value={story}
          onChange={onChange}
          help={`이 사연에서 ${cutCount}컷을 만들었어요.`}
          maxLength={500}
        />
        <Button variant="secondary" size="sm" block loading={pending} onClick={onRegenerate}>
          사연 고쳐서 다시 만들기
        </Button>
        <p className="text-caption text-ink-subtle">
          다시 만들면 지금 고친 대사는 사라져요. 콘티 생성은 크레딧을 쓰지 않아요.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-card p-4">
        <h2 className="text-label font-semibold text-ink">자동으로 붙는 것</h2>
        <p className="text-body-sm text-ink-muted">
          시리즈 그림체와 고정 캐릭터는 모든 컷에 자동으로 들어가요. 컷마다 다시 고르지
          않아도 돼요.
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.values(MOCK_CHARACTERS).map((name) => (
            <Badge key={name} tone="brand">
              {name}
            </Badge>
          ))}
          <Badge>손그림 파스텔</Badge>
          <Badge>1:1</Badge>
        </div>
      </div>
    </aside>
  );
}

function CutCard({
  cut,
  total,
  selected,
  hookText,
  ctaText,
  onSelect,
  onMove,
  onRemove,
  onAddAfter,
  onChangeLine,
  onChangeNarration,
}: {
  cut: StoryboardCut;
  total: number;
  selected: boolean;
  hookText?: string;
  ctaText?: string;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddAfter: () => void;
  onChangeLine: (lineId: string, text: string) => void;
  onChangeNarration: (text: string) => void;
}) {
  return (
    <article
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer flex-col gap-3 rounded-xl bg-surface-card p-4 transition-colors",
        selected
          ? "border-2 border-brand p-[15px]"
          : "border border-border hover:border-border-control",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-surface-sunken text-label font-bold tabular-nums text-ink-muted">
          {cut.index}
        </span>
        {cut.index === 1 && <Badge tone="brand">후킹</Badge>}
        {cut.index === total && <Badge tone="brand">CTA</Badge>}
        <Badge>{EMOTION_LABEL[cut.emotion]}</Badge>
        <Badge>{CAMERA_LABEL[cut.camera]}</Badge>

        <div className="ml-auto flex items-center gap-1">
          <IconButton label="위로" onClick={() => onMove(-1)} disabled={cut.index === 1}>
            ↑
          </IconButton>
          <IconButton
            label="아래로"
            onClick={() => onMove(1)}
            disabled={cut.index === total}
          >
            ↓
          </IconButton>
          <IconButton label="아래에 컷 추가" onClick={onAddAfter}>
            +
          </IconButton>
          <IconButton label="컷 삭제" onClick={onRemove} disabled={total === 1}>
            ✕
          </IconButton>
        </div>
      </div>

      {hookText && <Copy tone="hook" text={hookText} />}

      <p className="text-body text-ink">
        {cut.scene || (
          <span className="text-ink-subtle">장면을 적어주세요. 비어 있으면 생성하지 않아요.</span>
        )}
      </p>

      {cut.dialogue.length > 0 && (
        <ul className="flex flex-col gap-2">
          {cut.dialogue.map((line) => (
            <li key={line.id} className="flex items-start gap-2">
              <span className="mt-1 shrink-0 text-caption font-semibold text-ink-subtle">
                {line.speakerId ? MOCK_CHARACTERS[line.speakerId] : "효과음"}
                <span className="ml-1 font-normal">· {BALLOON_LABEL[line.balloon]}</span>
              </span>
              <input
                value={line.text}
                onChange={(e) => onChangeLine(line.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${cut.index}컷 대사`}
                className="h-control-sm min-w-0 flex-1 rounded-md border border-border-control bg-surface-card px-3 text-label text-ink focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand"
              />
            </li>
          ))}
        </ul>
      )}

      {cut.narration != null && (
        <input
          value={cut.narration}
          onChange={(e) => onChangeNarration(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${cut.index}컷 나레이션`}
          className="h-control-sm rounded-md border border-dashed border-border-control bg-surface-sunken px-3 text-label text-ink-muted focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand"
        />
      )}

      {ctaText && <Copy tone="cta" text={ctaText} />}
    </article>
  );
}

function Copy({ tone, text }: { tone: "hook" | "cta"; text: string }) {
  return (
    <p className="rounded-md bg-brand-tint px-3 py-2 text-body font-semibold text-brand-ink">
      {tone === "hook" ? "후킹" : "CTA"} · {text}
    </p>
  );
}

function OptionPanel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-label font-semibold text-ink">{title}</h2>
        {caption && <p className="text-caption text-ink-muted">{caption}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{children}</dd>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid size-control-sm cursor-pointer place-items-center rounded-md text-label text-ink-muted hover:bg-surface-sunken hover:text-ink disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
