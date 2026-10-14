"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Film,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Wand2,
  Plus,
} from "lucide-react";
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
import type { GenerationTier } from "@/contracts/generation";
import {
  CAMERA_LABEL,
  EMOTION_LABEL,
  BACKGROUND_PRESET_LABEL,
  canGenerate,
  characterName,
  reindexCuts,
  type Storyboard,
  type StoryboardCut,
  type StoryboardCharacter,
  type CutEmotion,
  type CameraShot,
  type BackgroundPreset,
  type CutBackground,
} from "../types/storyboard";
import { BALLOON_LABEL, type BalloonKind } from "../types/layer";
import {
  generateStoryboardAction,
  saveStoryboardAction,
  startGenerationAction,
  type ActionResult,
} from "../actions";
import { EpisodeHeader } from "./EpisodeHeader";

/** 콘티 편집은 이만큼 멈추면 저장한다. 생성 버튼을 누르면 그 자리에서 한 번 더 저장된다. */
const AUTOSAVE_MS = 1500;

/** PRD 2.2 — 사연 기반 콘티 생성. 이미지 생성 전에 컷을 손보는 화면이다. */
export interface StoryboardScreenProps {
  /** 저장된 콘티. 없으면 열자마자 만든다. */
  initial: Storyboard | null;
  /** 모델 없이 만든 목 콘티인지. 화면 위에 알린다. */
  usedMock: boolean;
  episodeId: string;
  /** 회차에 저장된 사연 원문. */
  story: string;
  /** 시리즈 고정 캐릭터 이름. 모든 컷에 자동으로 붙는다. */
  fixedCharacters: string[];
  stylePreset: string;
  aspectRatio: string;
  credits: number;
  seriesTitle: string;
  episodeTitle: string;
}

export function StoryboardScreen(props: StoryboardScreenProps) {
  const [sb, setSb] = useState(props.initial);
  const [usedMock, setUsedMock] = useState(props.usedMock);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(props.story);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  // 콘티가 없으면 바로 만든다. 콘티 생성은 크레딧을 쓰지 않는다.
  // 사연이 비었거나 막히면 이 자리에서 고쳐 다시 만든다(attempt 가 오르면 다시 돈다).
  useEffect(() => {
    if (sb || started.current === attempt) return;
    started.current = attempt;
    void generateStoryboardAction({
      episodeId: props.episodeId,
      story: attempt === 0 ? undefined : draft,
    }).then((r) => {
      if (r.ok) {
        setSb(r.data.storyboard);
        setUsedMock(r.data.usedMock);
      } else {
        setError(r.message);
      }
    });
  }, [sb, props.episodeId, attempt, draft]);

  if (!sb) {
    return (
      <div className="min-h-dvh bg-surface-page">
        <EpisodeHeader
          episodeId={props.episodeId}
          seriesTitle={props.seriesTitle}
          episodeTitle={props.episodeTitle}
          current="storyboard"
          credits={props.credits}
        />
        <main className="mx-auto flex max-w-[720px] flex-col items-center gap-4 p-10 text-center">
          {error ? (
            <div className="flex w-full flex-col gap-3 text-left">
              <p className="text-body text-danger">{error}</p>
              <Field
                label="사연"
                multiline
                rows={5}
                value={draft}
                onChange={setDraft}
                placeholder="어제 부장님이 회의 중에 내 아이디어를 자기 것처럼 말했다"
                maxLength={500}
              />
              <Button
                disabled={draft.trim().length < 10}
                onClick={() => {
                  setError(null);
                  setAttempt((n) => n + 1);
                }}
              >
                이 사연으로 콘티 만들기
              </Button>
            </div>
          ) : (
            <>
              <span
                aria-hidden
                className="size-8 animate-spin rounded-full border-4 border-brand border-r-transparent"
              />
              <p className="text-body font-semibold text-ink">사연으로 콘티를 짜고 있어요</p>
              {draft && <p className="max-w-md text-body-sm text-ink-muted">“{draft}”</p>}
              <p className="text-caption text-ink-subtle">30초 안쪽이면 돼요. 크레딧은 쓰지 않아요.</p>
            </>
          )}
        </main>
      </div>
    );
  }

  return (
    <StoryboardEditor
      {...props}
      initial={sb}
      usedMock={usedMock}
      onReplaced={(next, mock) => {
        setSb(next);
        setUsedMock(mock);
      }}
    />
  );
}

export type StoryboardStep = "story" | "cuts" | "hook_cta";

function StoryboardEditor({
  initial,
  usedMock,
  fixedCharacters,
  stylePreset,
  aspectRatio,
  credits,
  seriesTitle,
  episodeTitle,
  onReplaced,
}: Omit<StoryboardScreenProps, "initial"> & {
  initial: Storyboard;
  onReplaced: (sb: Storyboard, usedMock: boolean) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<StoryboardStep>("cuts");
  const [sb, setSb] = useState(initial);
  const [story, setStory] = useState(initial.story);
  const [tier, setTier] = useState<GenerationTier>("pro");
  const [notice, setNotice] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<{ required: number; available: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.cuts[0]?.id ?? null,
  );
  const [customLocations, setCustomLocations] = useState<string[]>([]);

  const allCustomLocations = useMemo(() => {
    const set = new Set(customLocations);
    for (const cut of sb.cuts) {
      if (cut.background?.customName) {
        set.add(cut.background.customName);
      }
    }
    return Array.from(set);
  }, [customLocations, sb.cuts]);

  const selected = sb.cuts.find((c) => c.id === selectedId) ?? null;
  const ready = canGenerate(sb);
  const unitCost = tier === "pro" ? CREDIT_COST.cutImagePro : CREDIT_COST.cutImage;
  const cost = sb.cuts.length * unitCost;

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

  // 편집 자동 저장. 순서·추가·삭제·대사·후킹·CTA 를 고칠 때마다 1.5초 뒤 보낸다.
  const [saveNote, setSaveNote] = useState<string | null>(null);
  /** 서버에 있는 것과 같으면 보내지 않는다. 열자마자 "저장 대기 중"이 뜨지 않게. */
  const lastSaved = useRef(JSON.stringify(initial));
  useEffect(() => {
    const body = JSON.stringify(sb);
    if (body === lastSaved.current) return;
    const timer = setTimeout(async () => {
      setSaveNote("저장 중");
      const r = await saveStoryboardAction(sb);
      if (r.ok) lastSaved.current = body;
      setSaveNote(r.ok ? "저장됨" : r.message);
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [sb]);

  /** PRD 2.2 — 사연을 고쳐서 콘티를 다시 만든다. 크레딧을 쓰지 않는다. */
  function regenerateStoryboard() {
    startTransition(async () => {
      const data = handle(
        await generateStoryboardAction({ episodeId: sb.episodeId, story }),
      );
      if (data) {
        lastSaved.current = JSON.stringify(data.storyboard);
        setSb(data.storyboard);
        onReplaced(data.storyboard, data.usedMock);
      }
    });
  }

  /** PRD 3.1.1 — 전체 생성을 큐에 등록하고 라이브 스튜디오(에디터) 화면으로 넘긴다. */
  function startGeneration() {
    startTransition(async () => {
      const job = handle(await startGenerationAction(sb, tier));
      if (job) router.push(`/episodes/${sb.episodeId}/editor?job=${job.id}`);
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
        id: `cut_${crypto.randomUUID().slice(0, 12)}`,
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

  const hasCoverCut = sb.cuts.some((c) => c.isCover);

  function toggleCoverCut(enable: boolean) {
    setSb((s) => {
      if (enable) {
        if (s.cuts.some((c) => c.isCover)) return s;
        const hookText = s.hookOptions.find((h) => h.id === s.selectedHookId)?.text || "새로운 이야기";
        const coverCut: StoryboardCut = {
          id: `cut_cover_${Date.now()}`,
          index: 1,
          isCover: true,
          scene: `[표지/타이틀 커버] "${hookText}" - 에피소드의 전체적인 테마와 주인공의 대표적인 매력을 보여주는 시선 강탈 표지 일러스트. 인스타 피드 썸네일 전용.`,
          characterIds: s.characters.map((c) => c.key).slice(0, 1),
          emotion: "joy",
          camera: "medium",
          dialogue: [],
          narration: "",
        };
        const next = [coverCut, ...s.cuts];
        return { ...s, cuts: reindexCuts(next), includeCover: true };
      } else {
        const withoutCover = s.cuts.filter((c) => !c.isCover);
        return { ...s, cuts: reindexCuts(withoutCover), includeCover: false };
      }
    });
  }

  function addCharacter(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSb((s) => {
      if (s.characters.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
        return s;
      }
      const key = `ch_${crypto.randomUUID().slice(0, 8)}`;
      return {
        ...s,
        characters: [...s.characters, { key, name: trimmed }],
      };
    });
  }

  function removeCharacter(key: string) {
    setSb((s) => {
      const nextCharacters = s.characters.filter((c) => c.key !== key);
      const nextCuts = s.cuts.map((cut) => ({
        ...cut,
        characterIds: cut.characterIds.filter((id) => id !== key),
        dialogue: cut.dialogue.map((d) => (d.speakerId === key ? { ...d, speakerId: null } : d)),
      }));
      return {
        ...s,
        characters: nextCharacters,
        cuts: nextCuts,
      };
    });
  }

  return (
    <div className="min-h-dvh bg-surface-page">
      <EpisodeHeader
        episodeId={sb.episodeId}
        seriesTitle={seriesTitle}
        episodeTitle={episodeTitle}
        current="storyboard"
        credits={credits}
        hideActionOnMobile
        action={
          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              aria-label="생성 품질"
              className="flex items-center rounded-lg border border-border bg-surface-sunken p-0.5 text-xs font-semibold"
            >
              <button
                type="button"
                role="radio"
                aria-checked={tier === "standard"}
                onClick={() => setTier("standard")}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 transition-all",
                  tier === "standard"
                    ? "bg-surface-card text-ink shadow-2xs font-bold"
                    : "text-ink-muted hover:text-ink",
                )}
                title="⚡ 일반 모드: 빠른 생성 (컷당 1 크레딧)"
              >
                ⚡ 일반 (1C)
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={tier === "pro"}
                onClick={() => setTier("pro")}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 transition-all",
                  tier === "pro"
                    ? "bg-brand text-on-brand shadow-2xs font-bold"
                    : "text-ink-muted hover:text-ink",
                )}
                title="💎 Pro 모드: 더 좋은 고화질과 캐릭터 디테일 유지 (컷당 2 크레딧)"
              >
                💎 Pro (2C)
              </button>
            </div>

            <Button
              size="sm"
              cost={cost}
              disabled={!ready}
              // 실제로는 CreditLedger.hold 가 먼저 가고, 모자라면 충전 시트가 열린다.
              title={ready ? undefined : "모든 컷의 장면 묘사를 먼저 입력하세요"}
              loading={pending}
              onClick={startGeneration}
            >
              {tier === "pro" ? "💎 Pro 이미지 생성" : "⚡ 일반 이미지 생성"}
            </Button>
          </div>
        }
      />

      {/* 3단계 스텝 네비게이션 탭 바 */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[880px] items-center justify-between px-4 py-2.5">
          <nav aria-label="콘티 제작 단계" className="flex items-center gap-1 sm:gap-2">
            {/* 1단계 */}
            <button
              type="button"
              onClick={() => setStep("story")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                step === "story"
                  ? "bg-brand text-on-brand shadow-2xs font-bold"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[11px] font-bold",
                  step === "story"
                    ? "bg-white/20 text-white"
                    : "bg-surface-sunken text-ink-muted",
                )}
              >
                1
              </span>
              <span>사연 & 캐릭터</span>
            </button>

            <span className="text-ink-subtle select-none font-bold">›</span>

            {/* 2단계 */}
            <button
              type="button"
              onClick={() => setStep("cuts")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                step === "cuts"
                  ? "bg-brand text-on-brand shadow-2xs font-bold"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[11px] font-bold",
                  step === "cuts"
                    ? "bg-white/20 text-white"
                    : "bg-surface-sunken text-ink-muted",
                )}
              >
                2
              </span>
              <span>컷별 콘티</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                  step === "cuts"
                    ? "bg-white/20 text-white"
                    : "bg-surface-sunken text-ink-muted",
                )}
              >
                {sb.cuts.length}컷
              </span>
            </button>

            <span className="text-ink-subtle select-none font-bold">›</span>

            {/* 3단계 */}
            <button
              type="button"
              onClick={() => setStep("hook_cta")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
                step === "hook_cta"
                  ? "bg-brand text-on-brand shadow-2xs font-bold"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[11px] font-bold",
                  step === "hook_cta"
                    ? "bg-white/20 text-white"
                    : "bg-surface-sunken text-ink-muted",
                )}
              >
                3
              </span>
              <span>후킹 & CTA</span>
            </button>
          </nav>

          {/* 우측 자동 저장 알림 */}
          {saveNote && (
            <span
              aria-live="polite"
              className="text-caption text-ink-subtle hidden sm:inline-block"
            >
              {saveNote}
            </span>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-[880px] p-4 pb-28 lg:pb-16 flex flex-col gap-5">
        {saveNote && (
          <p aria-live="polite" className="text-right text-caption text-ink-subtle sm:hidden">
            {saveNote}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-body-sm text-danger">
            {notice}
          </p>
        )}

        {/* 1단계: 사연 & 캐릭터 */}
        {step === "story" && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-brand-tint text-base font-bold text-brand">
                    📝
                  </span>
                  <div>
                    <h2 className="text-label font-bold text-ink">1단계 · 원본 사연 & 등장인물 설정</h2>
                    <p className="text-caption text-ink-muted">
                      사연을 다듬거나 등장인물을 등록하세요. 사연을 수정하면 콘티를 새로 짤 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-col gap-4">
                <Field
                  label="사연 내용"
                  multiline
                  rows={8}
                  value={story}
                  onChange={setStory}
                  help={`이 사연을 바탕으로 현재 총 ${sb.cuts.length}컷의 콘티가 구성되어 있습니다.`}
                  maxLength={1000}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <p className="text-caption text-ink-subtle">
                    다시 만들면 편집한 대사는 초기화됩니다. 콘티 재생성은 크레딧이 들지 않아요.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={pending}
                    onClick={regenerateStoryboard}
                    className="self-end sm:self-auto shrink-0"
                  >
                    🔄 사연으로 콘티 다시 짜기
                  </Button>
                </div>
              </div>
            </div>

            {/* 등장인물 관리 카드 */}
            <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5 shadow-2xs flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-surface-sunken text-base font-bold">
                    👥
                  </span>
                  <div>
                    <h3 className="text-label font-bold text-ink">등장인물 관리</h3>
                    <p className="text-caption text-ink-muted">
                      대사에서 말풍선 화자로 지정할 수 있는 인물 목록입니다.
                    </p>
                  </div>
                </div>
                <Badge tone="neutral">{sb.characters.length}명</Badge>
              </div>

              <StoryCharacterManager
                characters={sb.characters}
                onAddCharacter={addCharacter}
                onRemoveCharacter={removeCharacter}
              />
            </div>

            {/* 다음 단계 버튼 */}
            <div className="flex justify-end pt-2">
              <Button
                size="lg"
                onClick={() => setStep("cuts")}
                className="font-bold px-6"
              >
                다음: 컷별 콘티 다듬기 ({sb.cuts.length}컷) ➡️
              </Button>
            </div>
          </div>
        )}

        {/* 2단계: 컷별 콘티 */}
        {step === "cuts" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border bg-surface-card px-4 py-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-brand-tint text-base font-bold text-brand">
                  🎬
                </span>
                <div>
                  <h2 className="text-label font-bold text-ink">2단계 · 컷별 콘티 상세 연출 ({sb.cuts.length}컷)</h2>
                  <p className="text-caption text-ink-muted">
                    각 컷의 대사, 감정, 배경 및 구도를 검토하고 편집하세요.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("story")}
                className="text-ink-muted hover:text-ink text-xs self-end sm:self-auto"
              >
                사연 다시 보기
              </Button>
            </div>

            {usedMock && (
              <p className="rounded-lg bg-surface-sunken px-3 py-2 text-caption text-ink-muted">
                모델 키(ANTHROPIC_API_KEY)가 없어 사연 문장으로 콘티 틀만 짰어요. 키를 넣으면 작가처럼 다시 써 드려요.
              </p>
            )}

            {/* 인스타 피드 전용 독립 표지(커버) 컷 토글 바 */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-card px-4 py-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-brand-tint text-base font-bold text-brand">
                  🌟
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-label font-bold text-ink">독립 표지(커버) 컷 포함</span>
                    {hasCoverCut ? (
                      <Badge tone="brand">포함됨 (피드 썸네일)</Badge>
                    ) : (
                      <Badge tone="neutral">미포함 (1컷이 표지)</Badge>
                    )}
                  </div>
                  <span className="text-caption text-ink-muted">
                    인스타 피드 썸네일로 활용할 독립된 타이틀 표지 컷을 맨 앞에 추가합니다.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={hasCoverCut}
                  onChange={(e) => toggleCoverCut(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-sunken peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
              </label>
            </div>

            {sb.cuts.length === 0 ? (
              <EmptyState
                title="컷이 하나도 없어요"
                description="1단계에서 사연을 다시 넣으면 컷을 새로 만들어 드려요."
                actionLabel="1단계 사연으로 가기"
                onAction={() => setStep("story")}
              />
            ) : (
              sb.cuts.map((cut) => (
                <CutCard
                  key={cut.id}
                  cut={cut}
                  hasCoverCut={hasCoverCut}
                  characters={sb.characters}
                  allCustomLocations={allCustomLocations}
                  nameOf={(key) => characterName(sb, key)}
                  total={sb.cuts.length}
                  selected={cut.id === selectedId}
                  onSelect={() => setSelectedId((prev) => (prev === cut.id ? null : cut.id))}
                  onMove={(dir) => moveCut(cut.id, dir)}
                  onRemove={() => removeCut(cut.id)}
                  onAddAfter={() => addCutAfter(cut.id)}
                  onChangeScene={(scene) => patchCut(cut.id, { scene })}
                  onChangeEmotion={(emotion) => patchCut(cut.id, { emotion })}
                  onChangeCamera={(camera) => patchCut(cut.id, { camera })}
                  onChangeBackground={(background) => patchCut(cut.id, { background })}
                  onAddCustomLocation={(name) =>
                    setCustomLocations((prev) =>
                      prev.includes(name) ? prev : [...prev, name],
                    )
                  }
                  onAddLine={() =>
                    patchCut(cut.id, {
                      dialogue: [
                        ...cut.dialogue,
                        {
                          id: `line_${crypto.randomUUID().slice(0, 8)}`,
                          speakerId: sb.characters[0]?.key ?? null,
                          text: "",
                          balloon: "normal",
                        },
                      ],
                    })
                  }
                  onRemoveLine={(lineId) =>
                    patchCut(cut.id, {
                      dialogue: cut.dialogue.filter((l) => l.id !== lineId),
                    })
                  }
                  onChangeLine={(lineId, text) =>
                    patchCut(cut.id, {
                      dialogue: cut.dialogue.map((l) =>
                        l.id === lineId ? { ...l, text } : l,
                      ),
                    })
                  }
                  onChangeLineSpeaker={(lineId, speakerId) => {
                    setSb((s) => {
                      const nextCuts = s.cuts.map((c) => {
                        if (c.id !== cut.id) return c;
                        const nextCharIds =
                          speakerId && !c.characterIds.includes(speakerId)
                            ? [...c.characterIds, speakerId]
                            : c.characterIds;
                        const nextDialogue = c.dialogue.map((l) =>
                          l.id === lineId ? { ...l, speakerId } : l,
                        );
                        return {
                          ...c,
                          characterIds: nextCharIds,
                          dialogue: nextDialogue,
                        };
                      });
                      return { ...s, cuts: nextCuts };
                    });
                  }}
                  onChangeLineBalloon={(lineId, balloon) =>
                    patchCut(cut.id, {
                      dialogue: cut.dialogue.map((l) =>
                        l.id === lineId ? { ...l, balloon } : l,
                      ),
                    })
                  }
                  onAddNarration={() => patchCut(cut.id, { narration: "" })}
                  onRemoveNarration={() => patchCut(cut.id, { narration: undefined })}
                  onChangeNarration={(narration) => patchCut(cut.id, { narration })}
                />
              ))
            )}

            {/* 단계 이동 네비게이션 */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setStep("story")}
              >
                ⬅️ 1단계: 사연 & 캐릭터
              </Button>
              <Button
                size="lg"
                onClick={() => setStep("hook_cta")}
                className="font-bold px-6"
              >
                다음: 후킹 & CTA 마무리 ➡️
              </Button>
            </div>
          </div>
        )}

        {/* 3단계: 후킹 & CTA 및 생성 */}
        {step === "hook_cta" && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-brand-tint text-base font-bold text-brand">
                  🎯
                </span>
                <div>
                  <h2 className="text-label font-bold text-ink">3단계 · 후킹 & CTA 및 생성 준비</h2>
                  <p className="text-caption text-ink-muted">
                    독자의 몰입을 높이는 1컷 헤드라인과 마지막 컷 참여 유도 문구를 고른 뒤 이미지를 생성하세요.
                  </p>
                </div>
              </div>
            </div>

            <OptionPanel
              title="1컷 후킹"
              caption="첫 컷 상단 헤드라인 배너 및 인스타 캡션 첫 줄로 반영됩니다."
            >
              <div className="flex items-center justify-between pb-1">
                <span className="text-caption text-ink-muted">
                  {sb.selectedHookId
                    ? "추천 문구 선택 또는 직접 수정"
                    : "후킹 문구를 사용하지 않습니다."}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSb((s) => ({
                      ...s,
                      selectedHookId: s.selectedHookId
                        ? null
                        : s.hookOptions[0]?.id ?? null,
                    }))
                  }
                  className="text-caption font-semibold text-brand hover:underline cursor-pointer"
                >
                  {sb.selectedHookId ? "후킹 끄기" : "후킹 켜기"}
                </button>
              </div>

              {sb.selectedHookId && (
                <>
                  <div className="flex flex-col gap-2">
                    {sb.hookOptions.map((o) => (
                      <ChoiceCard
                        key={o.id}
                        title={o.text}
                        selected={sb.selectedHookId === o.id}
                        onClick={() => setSb((s) => ({ ...s, selectedHookId: o.id }))}
                      />
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                    <label className="text-caption font-semibold text-ink">
                      후킹 문구 직접 수정
                    </label>
                    <input
                      value={
                        sb.hookOptions.find((h) => h.id === sb.selectedHookId)?.text ??
                        ""
                      }
                      onChange={(e) => {
                        const newText = e.target.value;
                        setSb((s) => ({
                          ...s,
                          hookOptions: s.hookOptions.map((h) =>
                            h.id === s.selectedHookId ? { ...h, text: newText } : h,
                          ),
                        }));
                      }}
                      placeholder="후킹 문구를 입력하세요"
                      className="h-control-sm rounded-md border border-border-control bg-surface-card px-3 text-label text-ink focus-visible:outline-2 focus-visible:outline-brand"
                    />
                  </div>
                </>
              )}
            </OptionPanel>

            <OptionPanel
              title="마지막 컷 CTA"
              caption="마지막 컷 하단 참여 배너 및 인스타 캡션 마무리 문구로 반영됩니다."
            >
              <div className="flex items-center justify-between pb-1">
                <span className="text-caption text-ink-muted">
                  {sb.selectedCtaId
                    ? "참여 유도 3안 중 선택 또는 직접 수정"
                    : "CTA 문구를 사용하지 않습니다."}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSb((s) => ({
                      ...s,
                      selectedCtaId: s.selectedCtaId
                        ? null
                        : s.ctaOptions[0]?.id ?? null,
                    }))
                  }
                  className="text-caption font-semibold text-brand hover:underline cursor-pointer"
                >
                  {sb.selectedCtaId ? "CTA 끄기" : "CTA 켜기"}
                </button>
              </div>

              {sb.selectedCtaId && (
                <>
                  <div className="flex flex-col gap-2">
                    {sb.ctaOptions.map((o) => (
                      <ChoiceCard
                        key={o.id}
                        title={o.text}
                        selected={sb.selectedCtaId === o.id}
                        onClick={() => setSb((s) => ({ ...s, selectedCtaId: o.id }))}
                      />
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                    <label className="text-caption font-semibold text-ink">
                      CTA 문구 직접 수정
                    </label>
                    <input
                      value={
                        sb.ctaOptions.find((c) => c.id === sb.selectedCtaId)?.text ??
                        ""
                      }
                      onChange={(e) => {
                        const newText = e.target.value;
                        setSb((s) => ({
                          ...s,
                          ctaOptions: s.ctaOptions.map((c) =>
                            c.id === s.selectedCtaId ? { ...c, text: newText } : c,
                          ),
                        }));
                      }}
                      placeholder="CTA 문구를 입력하세요"
                      className="h-control-sm rounded-md border border-border-control bg-surface-card px-3 text-label text-ink focus-visible:outline-2 focus-visible:outline-brand"
                    />
                  </div>
                </>
              )}
            </OptionPanel>

            {/* 최종 생성 확인 & 실행 카드 */}
            <div className="rounded-xl border-2 border-brand/40 bg-surface-card p-5 shadow-md flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚀</span>
                  <h3 className="text-label font-bold text-ink">이미지 생성 준비 완료</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-caption text-ink-muted">내 보유 크레딧:</span>
                  <Badge tone="brand">{credits}C</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-surface-sunken p-3 text-caption">
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-muted">총 컷수</span>
                  <span className="font-bold text-ink text-body-sm">
                    {sb.cuts.length}컷 {hasCoverCut ? "(표지 포함)" : ""}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-muted">화면 비율</span>
                  <span className="font-bold text-ink text-body-sm">{aspectRatio}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-muted">화풍 프리셋</span>
                  <span className="font-bold text-ink text-body-sm">{stylePreset}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-muted">소요 크레딧</span>
                  <span className="font-bold text-brand text-body-sm">{cost} 크레딧</span>
                </div>
              </div>

              {/* 생성 품질 토글 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex flex-col">
                  <span className="text-label font-bold text-ink">생성 품질 엔진 선택</span>
                  <span className="text-caption text-ink-muted">
                    {tier === "pro"
                      ? "💎 Pro: 캐릭터 디테일과 화질을 높인 고품질 생성 (컷당 2 크레딧)"
                      : "⚡ 일반: 표준 모델 빠른 생성 (컷당 1 크레딧)"}
                  </span>
                </div>
                <div
                  role="radiogroup"
                  aria-label="생성 품질"
                  className="flex items-center self-start sm:self-auto rounded-lg border border-border bg-surface-sunken p-0.5 text-xs font-semibold"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={tier === "standard"}
                    onClick={() => setTier("standard")}
                    className={cn(
                      "cursor-pointer rounded-md px-3 py-1.5 transition-all",
                      tier === "standard"
                        ? "bg-surface-card text-ink shadow-2xs font-bold"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    ⚡ 일반 (1C)
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={tier === "pro"}
                    onClick={() => setTier("pro")}
                    className={cn(
                      "cursor-pointer rounded-md px-3 py-1.5 transition-all",
                      tier === "pro"
                        ? "bg-brand text-on-brand shadow-2xs font-bold"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    💎 Pro (2C)
                  </button>
                </div>
              </div>

              {!ready && (
                <p className="rounded-lg bg-warning-tint px-3 py-2 text-body-sm text-warning">
                  모든 컷의 장면 묘사를 입력하면 이미지 생성을 시작할 수 있어요. (2단계 컷별 콘티를 확인해 주세요)
                </p>
              )}

              <Button
                size="lg"
                block
                cost={cost}
                disabled={!ready}
                loading={pending}
                onClick={startGeneration}
                className="text-base font-bold py-3.5 shadow-sm"
              >
                {tier === "pro" ? "💎 Pro 이미지 생성 시작" : "⚡ 일반 이미지 생성 시작"}
              </Button>
            </div>

            {/* 단계 이동 네비게이션 */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setStep("cuts")}
              >
                ⬅️ 2단계: 컷별 콘티로 돌아가기
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* 모바일 화면 하단 고정 네비게이션 바 (lg 미만) */}
      <div className="sticky bottom-0 z-30 border-t border-border/80 bg-surface-card/95 p-3 backdrop-blur-md lg:hidden shadow-lg pb-[env(safe-area-inset-bottom,14px)]">
        {step === "story" && (
          <Button
            size="md"
            block
            onClick={() => setStep("cuts")}
            className="font-bold shadow-xs"
          >
            다음: 컷별 콘티 다듬기 ({sb.cuts.length}컷) ➡️
          </Button>
        )}

        {step === "cuts" && (
          <div className="flex items-center gap-2">
            <Button
              size="md"
              variant="secondary"
              onClick={() => setStep("story")}
            >
              ⬅️ 이전
            </Button>
            <Button
              size="md"
              block
              onClick={() => setStep("hook_cta")}
              className="flex-1 font-bold shadow-xs"
            >
              다음: 후킹 & CTA ➡️
            </Button>
          </div>
        )}

        {step === "hook_cta" && (
          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              aria-label="생성 품질"
              className="flex shrink-0 items-center rounded-lg border border-border bg-surface-sunken p-0.5 text-xs font-semibold"
            >
              <button
                type="button"
                role="radio"
                aria-checked={tier === "standard"}
                onClick={() => setTier("standard")}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1.5 transition-all text-xs",
                  tier === "standard"
                    ? "bg-surface-card text-ink shadow-2xs font-bold"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                ⚡ 일반
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={tier === "pro"}
                onClick={() => setTier("pro")}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1.5 transition-all text-xs",
                  tier === "pro"
                    ? "bg-brand text-on-brand shadow-2xs font-bold"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                💎 Pro
              </button>
            </div>
            <Button
              size="md"
              block
              cost={cost}
              disabled={!ready}
              loading={pending}
              onClick={startGeneration}
              className="flex-1 font-bold shadow-xs"
            >
              {tier === "pro" ? "💎 Pro 생성" : "⚡ 일반 생성"}
            </Button>
          </div>
        )}
      </div>

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

function StoryCharacterManager({
  characters,
  onAddCharacter,
  onRemoveCharacter,
}: {
  characters: StoryboardCharacter[];
  onAddCharacter: (name: string) => void;
  onRemoveCharacter: (key: string) => void;
}) {
  const [newName, setNewName] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddCharacter(trimmed);
    setNewName("");
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 인물 추가 폼 */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 인물 이름 (예: 김팀장, 과장, 친구)"
          maxLength={15}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface-card px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={!newName.trim()}>
          인물 추가
        </Button>
      </form>

      {/* 등록된 인물 칩 목록 */}
      <div className="flex flex-wrap gap-2 pt-1">
        {characters.map((ch) => {
          const isMe = ch.key === "ch_me";
          return (
            <span
              key={ch.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isMe
                  ? "border-brand/40 bg-brand-subtle text-brand font-bold"
                  : "border-border bg-surface-sunken text-ink",
              )}
            >
              <span>{ch.name}</span>
              {characters.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveCharacter(ch.key)}
                  title={`${ch.name} 삭제`}
                  className="cursor-pointer text-ink-muted hover:text-danger text-sm leading-none ml-1"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const DEFAULT_LOCATIONS: { id: BackgroundPreset; label: string }[] = [
  { id: "living_room", label: "거실" },
  { id: "bedroom", label: "침실" },
  { id: "cafe", label: "카페" },
  { id: "office", label: "사무실" },
  { id: "vet_clinic", label: "동물병원" },
  { id: "entrance", label: "현관" },
  { id: "solid_color", label: "단색 배경" },
];

const SOLID_COLOR_PALETTE = [
  { hex: "#FFF9F0", label: "아이보리" },
  { hex: "#FEF9C3", label: "옐로우" },
  { hex: "#ECFDF5", label: "민트" },
  { hex: "#FDF2F8", label: "핑크" },
  { hex: "#EFF6FF", label: "블루" },
  { hex: "#FFFFFF", label: "화이트" },
];

/** 노션 스타일 장소/배경 태그 선택기 */
function LocationTagPicker({
  background,
  allCustomLocations,
  onSelectPreset,
  onSelectCustom,
  onSelectSolidColor,
  onAddCustomLocation,
}: {
  background?: CutBackground;
  allCustomLocations: string[];
  onSelectPreset: (preset: BackgroundPreset) => void;
  onSelectCustom: (customName: string) => void;
  onSelectSolidColor: (hex: string) => void;
  onAddCustomLocation: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isSolid = background?.preset === "solid_color";
  const custom = background?.customName;
  const currentLabel = isSolid
    ? `단색: ${SOLID_COLOR_PALETTE.find((c) => c.hex === background?.colorHex)?.label ?? "아이보리"}`
    : custom
      ? `장소: ${custom}`
      : `장소: ${DEFAULT_LOCATIONS.find((l) => l.id === background?.preset)?.label ?? "거실"}`;

  const q = query.trim().toLowerCase();
  const filteredPresets = DEFAULT_LOCATIONS.filter((l) =>
    l.label.toLowerCase().includes(q),
  );
  const filteredCustom = allCustomLocations.filter(
    (c) => c.toLowerCase().includes(q) && !DEFAULT_LOCATIONS.some((p) => p.label === c),
  );
  const hasExactMatch =
    DEFAULT_LOCATIONS.some((l) => l.label.toLowerCase() === q) ||
    allCustomLocations.some((c) => c.toLowerCase() === q);

  const canCreate = q.length > 0 && !hasExactMatch && q !== "단색 배경";

  function handleCreate() {
    if (!canCreate) return;
    const name = query.trim();
    onAddCustomLocation(name);
    onSelectCustom(name);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative inline-block" ref={popoverRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-sunken px-2 text-caption font-medium text-ink hover:border-border-control transition-colors"
      >
        {isSolid && (
          <span
            className="size-2.5 rounded-full border border-black/15"
            style={{ backgroundColor: background?.colorHex ?? "#FFF9F0" }}
          />
        )}
        <span>{currentLabel}</span>
        <span className="text-[10px] text-ink-muted">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-border bg-surface-card p-2 shadow-lg">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                if (canCreate) handleCreate();
              }
            }}
            placeholder="장소 검색 또는 새 장소 입력..."
            className="mb-2 h-7 w-full rounded border border-border bg-surface-sunken px-2 text-caption text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
          />

          {canCreate && (
            <button
              type="button"
              onClick={handleCreate}
              className="mb-1.5 flex w-full items-center justify-between rounded bg-brand-subtle px-2 py-1.5 text-left text-caption font-semibold text-brand hover:bg-brand-tint transition-colors"
            >
              <span>+ &quot;{query.trim()}&quot; 추가</span>
              <kbd className="text-[10px] font-normal text-ink-subtle">Enter</kbd>
            </button>
          )}

          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
            {filteredPresets.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (opt.id === "solid_color") {
                    onSelectSolidColor(background?.colorHex ?? "#FFF9F0");
                  } else {
                    onSelectPreset(opt.id);
                  }
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1 text-left text-caption transition-colors",
                  !custom && background?.preset === opt.id
                    ? "bg-surface-sunken font-bold text-brand"
                    : "text-ink hover:bg-surface-sunken",
                )}
              >
                <span>{opt.label}</span>
                {!custom && background?.preset === opt.id && <span>✓</span>}
              </button>
            ))}

            {filteredCustom.length > 0 && (
              <div className="my-1 border-t border-border-subtle pt-1">
                <span className="block px-2 py-0.5 text-[10px] font-bold text-ink-subtle">직접 추가한 장소</span>
                {filteredCustom.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onSelectCustom(c);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-2 py-1 text-left text-caption transition-colors",
                      custom === c
                        ? "bg-surface-sunken font-bold text-brand"
                        : "text-ink hover:bg-surface-sunken",
                    )}
                  >
                    <span>{c}</span>
                    {custom === c && <span>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isSolid && (
            <div className="mt-2 border-t border-border-subtle pt-2">
              <span className="block mb-1 px-1 text-[10px] font-bold text-ink-subtle">단색 배경 색상</span>
              <div className="grid grid-cols-6 gap-1">
                {SOLID_COLOR_PALETTE.map((pal) => (
                  <button
                    key={pal.hex}
                    type="button"
                    title={`${pal.label} (${pal.hex})`}
                    onClick={() => {
                      onSelectSolidColor(pal.hex);
                      setOpen(false);
                    }}
                    style={{ backgroundColor: pal.hex }}
                    className={cn(
                      "size-6 rounded border transition-transform hover:scale-110",
                      background?.colorHex === pal.hex
                        ? "border-brand ring-2 ring-brand"
                        : "border-border",
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 대사 인물/화자 드롭다운 (선택 및 새 인물 추가 가능) */
function SpeakerPicker({
  speakerId,
  characters,
  onSelectSpeaker,
}: {
  speakerId: string | null;
  characters: StoryboardCharacter[];
  onSelectSpeaker: (speakerId: string | null) => void;
}) {
  return (
    <select
      value={speakerId ?? ""}
      onChange={(e) => onSelectSpeaker(e.target.value ? e.target.value : null)}
      aria-label="화자 선택"
      className="h-control-sm max-w-[100px] truncate rounded border border-border bg-surface-card px-2 text-caption font-medium text-ink focus:border-brand focus:outline-none"
    >
      <option value="">화자 없음</option>
      {characters.map((ch) => (
        <option key={ch.key} value={ch.key}>
          {ch.name}
        </option>
      ))}
    </select>
  );
}

function CutCard({
  cut,
  characters,
  allCustomLocations,
  nameOf,
  total,
  selected,
  onSelect,
  onMove,
  onRemove,
  onAddAfter,
  onChangeScene,
  onChangeEmotion,
  onChangeCamera,
  onChangeBackground,
  onAddCustomLocation,
  onAddLine,
  onRemoveLine,
  onChangeLine,
  onChangeLineSpeaker,
  onChangeLineBalloon,
  onAddNarration,
  onRemoveNarration,
  onChangeNarration,
  hasCoverCut,
}: {
  cut: StoryboardCut;
  characters: StoryboardCharacter[];
  allCustomLocations: string[];
  nameOf: (key: string | null) => string;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onAddAfter: () => void;
  onChangeScene: (scene: string) => void;
  onChangeEmotion: (emotion: CutEmotion) => void;
  onChangeCamera: (camera: CameraShot) => void;
  onChangeBackground: (bg: CutBackground) => void;
  onAddCustomLocation: (name: string) => void;
  onAddLine: () => void;
  onRemoveLine: (lineId: string) => void;
  onChangeLine: (lineId: string, text: string) => void;
  onChangeLineSpeaker: (lineId: string, speakerId: string | null) => void;
  onChangeLineBalloon: (lineId: string, balloon: BalloonKind) => void;
  onAddNarration: () => void;
  onRemoveNarration: () => void;
  onChangeNarration: (text: string) => void;
  hasCoverCut?: boolean;
}) {
  const bgLabel =
    cut.background?.preset === "solid_color"
      ? "단색 배경"
      : cut.background?.customName
        ? cut.background.customName
        : DEFAULT_LOCATIONS.find((l) => l.id === cut.background?.preset)?.label ?? "거실";

  if (!selected) {
    return (
      <article
        onClick={onSelect}
        className={cn(
          "group flex cursor-pointer flex-col gap-2 rounded-xl border bg-surface-card p-3.5 transition-all hover:border-brand/50 hover:bg-surface-sunken/20 hover:shadow-2xs",
          cut.isCover
            ? "border-brand/50 bg-brand-tint/15 shadow-2xs"
            : "border-border",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-surface-sunken text-label font-bold tabular-nums text-ink-muted">
            {cut.isCover ? "표지" : cut.index}
          </span>
          {cut.isCover ? (
            <Badge tone="brand">🌟 표지 컷 (인스타 썸네일)</Badge>
          ) : (
            <>
              {cut.index === (hasCoverCut ? 2 : 1) && <Badge tone="brand">후킹 컷</Badge>}
              {cut.index === total && <Badge tone="brand">CTA 컷</Badge>}
            </>
          )}

          <span className="rounded bg-surface-sunken px-2 py-0.5 text-caption font-medium text-ink-muted">
            {EMOTION_LABEL[cut.emotion]}
          </span>
          <span className="rounded bg-surface-sunken px-2 py-0.5 text-caption font-medium text-ink-muted">
            {CAMERA_LABEL[cut.camera]}
          </span>
          <span className="max-w-[140px] truncate rounded bg-surface-sunken px-2 py-0.5 text-caption font-medium text-ink-muted">
            {bgLabel}
          </span>

          <div
            className="ml-auto flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
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

        {/* 장면 내용 */}
        <div className="flex items-start gap-2 pt-1 text-body-sm">
          <span className="shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-bold text-ink-muted">
            장면
          </span>
          <p className="flex-1 whitespace-pre-wrap text-ink-muted leading-relaxed">
            {cut.scene ? cut.scene : <span className="italic text-ink-subtle">장면 묘사가 비어있어요.</span>}
          </p>
        </div>

        {/* 대사 목록 내용 */}
        {cut.dialogue.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-surface-sunken/40 p-2.5">
            <div className="flex items-center gap-1.5 text-caption font-semibold text-ink-muted">
              <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-[11px] font-bold text-ink-muted">
                대사
              </span>
              <span className="text-[11px] text-ink-subtle">({cut.dialogue.length})</span>
            </div>
            <ul className="flex flex-col gap-1.5">
              {cut.dialogue.map((line) => {
                const speaker = nameOf(line.speakerId);
                return (
                  <li key={line.id} className="flex items-start gap-2 text-body-sm">
                    <span className="shrink-0 text-[13px] font-semibold text-ink">
                      {speaker}:
                    </span>
                    <span className="flex-1 text-[13px] leading-snug text-ink-muted">
                      &ldquo;{line.text || "(대사 없음)"}&rdquo;
                    </span>
                    <span className="shrink-0 rounded border border-border/80 bg-surface-card px-1.5 py-0.5 text-[10px] text-ink-subtle">
                      {BALLOON_LABEL[line.balloon]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 나레이션 내용 */}
        {cut.narration && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-body-sm">
            <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
              나레이션
            </span>
            <p className="flex-1 whitespace-pre-wrap text-[13px] leading-snug text-amber-900">
              {cut.narration}
            </p>
          </div>
        )}

        {/* 카드 하단 메타 및 클릭 안내 */}
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-caption">
          <span className="text-[11px] text-ink-subtle">
            {cut.dialogue.length > 0 ? `대사 ${cut.dialogue.length}개` : "대사 없음"}
            {cut.narration ? " · 나레이션 포함" : ""}
          </span>
          <span className="text-[11px] font-semibold text-brand group-hover:underline">
            클릭하여 편집 ▾
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border-2 bg-surface-card p-[15px] shadow-sm transition-colors",
        cut.isCover ? "border-brand ring-2 ring-brand/20 bg-brand-tint/5" : "border-brand",
      )}
    >
      {/* 컷 헤더: 번호, 후킹/CTA 뱃지, 감정/카메라/장소 드롭다운, 순서/삭제 버튼 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-surface-sunken text-label font-bold tabular-nums text-ink-muted">
          {cut.isCover ? "표지" : cut.index}
        </span>
        {cut.isCover ? (
          <Badge tone="brand">🌟 표지 컷 (인스타 썸네일)</Badge>
        ) : (
          <>
            {cut.index === (hasCoverCut ? 2 : 1) && <Badge tone="brand">후킹 컷</Badge>}
            {cut.index === total && <Badge tone="brand">CTA 컷</Badge>}
          </>
        )}

        {/* 감정 선택 */}
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={cut.emotion}
            onChange={(e) => onChangeEmotion(e.target.value as CutEmotion)}
            aria-label={`${cut.index}컷 감정`}
            className="h-7 rounded-md border border-border bg-surface-sunken px-2 text-caption font-medium text-ink focus:border-brand focus:outline-none"
          >
            {Object.entries(EMOTION_LABEL).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 카메라 구도 선택 */}
        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={cut.camera}
            onChange={(e) => onChangeCamera(e.target.value as CameraShot)}
            aria-label={`${cut.index}컷 카메라 구도`}
            className="h-7 rounded-md border border-border bg-surface-sunken px-2 text-caption font-medium text-ink focus:border-brand focus:outline-none"
          >
            {Object.entries(CAMERA_LABEL).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 장소 노션 태그 선택기 */}
        <LocationTagPicker
          background={cut.background}
          allCustomLocations={allCustomLocations}
          onSelectPreset={(preset) =>
            onChangeBackground({ preset, customName: undefined })
          }
          onSelectCustom={(customName) =>
            onChangeBackground({ preset: "auto", customName })
          }
          onSelectSolidColor={(colorHex) =>
            onChangeBackground({ preset: "solid_color", colorHex })
          }
          onAddCustomLocation={onAddCustomLocation}
        />

        {/* 컷 이동 및 추가/삭제 버튼 */}
        <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onSelect}
            className="mr-1 cursor-pointer rounded px-2 py-0.5 text-caption font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
          >
            접기 ▴
          </button>
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

      {/* 장면 묘사 (그림 프롬프트 초안) - 이모티콘 없이 깔끔한 텍스트 */}
      <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <label className="text-caption font-semibold text-ink-muted">
            장면 묘사
          </label>
          <span className="text-[11px] text-ink-subtle">AI 이미지 생성 프롬프트</span>
        </div>
        <textarea
          value={cut.scene}
          onChange={(e) => onChangeScene(e.target.value)}
          placeholder="장면 묘사를 입력해주세요 (예: 카페 창가 자리에서 심각한 표정으로 스마트폰을 보는 주인공)"
          rows={2}
          aria-label={`${cut.index}컷 장면 묘사`}
          className="w-full resize-y rounded-md border border-border-control bg-surface-card p-2.5 text-body-sm text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand"
        />
      </div>

      {/* 대사 및 말풍선 관리 - 이모티콘 제거 */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border-subtle" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-caption font-semibold text-ink-muted">
            대사 {cut.dialogue.length > 0 && `(${cut.dialogue.length})`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddLine}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-caption font-semibold text-brand hover:bg-brand-tint transition-colors"
            >
              + 대사 추가
            </button>
            {cut.narration == null && (
              <button
                type="button"
                onClick={onAddNarration}
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-caption font-semibold text-ink-muted hover:bg-surface-sunken hover:text-ink transition-colors"
              >
                + 나레이션 추가
              </button>
            )}
          </div>
        </div>

        {cut.dialogue.length > 0 && (
          <ul className="flex flex-col gap-2">
            {cut.dialogue.map((line) => (
              <li key={line.id} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 rounded-lg border border-border-subtle bg-surface-sunken/40 p-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* 인물/화자 드롭다운 (선택 및 새 인물 추가 가능) */}
                  <SpeakerPicker
                    speakerId={line.speakerId}
                    characters={characters}
                    onSelectSpeaker={(speakerId) => onChangeLineSpeaker(line.id, speakerId)}
                  />

                  {/* 말풍선 종류 선택 */}
                  <select
                    value={line.balloon}
                    onChange={(e) => onChangeLineBalloon(line.id, e.target.value as BalloonKind)}
                    aria-label="말풍선 종류"
                    className="h-control-sm rounded border border-border bg-surface-card px-1.5 text-caption font-medium text-ink focus:border-brand focus:outline-none"
                  >
                    {Object.entries(BALLOON_LABEL).map(([kind, label]) => (
                      <option key={kind} value={kind}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 대사 텍스트 입력 */}
                <input
                  value={line.text}
                  onChange={(e) => onChangeLine(line.id, e.target.value)}
                  placeholder="대사를 입력하세요"
                  aria-label={`${cut.index}컷 대사`}
                  className="h-control-sm min-w-0 flex-1 rounded border border-border-control bg-surface-card px-2.5 text-body-sm text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand"
                />

                {/* 대사 삭제 버튼 */}
                <button
                  type="button"
                  onClick={() => onRemoveLine(line.id)}
                  title="대사 삭제"
                  aria-label="대사 삭제"
                  className="grid size-control-sm shrink-0 place-items-center rounded text-caption text-ink-muted hover:bg-surface-sunken hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 나레이션 박스 관리 - 이모티콘 제거 */}
        {cut.narration != null && (
          <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-border-control bg-surface-sunken p-2">
            <span className="shrink-0 text-caption font-semibold text-ink-muted">나레이션</span>
            <input
              value={cut.narration}
              onChange={(e) => onChangeNarration(e.target.value)}
              placeholder="나레이션 문구를 입력하세요"
              aria-label={`${cut.index}컷 나레이션`}
              className="h-control-sm min-w-0 flex-1 rounded border border-border-control bg-surface-card px-2.5 text-body-sm text-ink focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand"
            />
            <button
              type="button"
              onClick={onRemoveNarration}
              title="나레이션 삭제"
              aria-label="나레이션 삭제"
              className="grid size-control-sm shrink-0 place-items-center rounded text-caption text-ink-muted hover:bg-surface-sunken hover:text-danger"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </article>
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
