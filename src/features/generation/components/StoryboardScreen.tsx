"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Film,
  Sparkles,
  BookOpen,
  Plus,
  Check,
  AlertCircle,
  Camera,
  Lightbulb,
  Clapperboard,
  Smile,
  MapPin,
  MessageSquare,
  Scroll,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  PenSquare,
  ArrowUp,
  ArrowDown,
  Trash2,
  RefreshCw,
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
import { extractStoryFromImageAction } from "@/features/platform/actions";
import { SeriesFormModal } from "@/features/platform/series/SeriesFormModal";
import type { SeriesSummary } from "@/features/platform/data/types";

/** 콘티 편집은 이만큼 멈추면 저장한다. 생성 버튼을 누르면 그 자리에서 한 번 더 저장된다. */
const AUTOSAVE_MS = 1500;

const EXAMPLES = [
  { chip: "회사 빌런", text: "어제 부장님이 회의 중에 내 아이디어를 자기 것처럼 말했다", emoji: "🏢" },
  { chip: "반려동물", text: "출근하려는데 고양이가 가방 위에 앉아서 안 비켜준다", emoji: "🐾" },
  { chip: "연애 빙산", text: "3개월 만난 사람이 아직 내 생일을 모른다", emoji: "💔" },
];

/** PRD 2.2 — 사연 기반 콘티 생성 & 통합 단일 워크스페이스 */
export interface StoryboardScreenProps {
  /** 저장된 콘티. 없으면 사연이 있을 때 바로 생성. */
  initial: Storyboard | null;
  /** 모델 없이 만든 목 콘티인지. */
  usedMock: boolean;
  episodeId: string;
  /** 회차에 저장된 사연 원문. */
  story: string;
  /** 시리즈 고정 캐릭터 이름. */
  fixedCharacters: string[];
  stylePreset: string;
  aspectRatio: string;
  credits: number;
  seriesTitle: string;
  episodeTitle: string;
  seriesId?: string;
  cutCount?: number;
  allSeries?: SeriesSummary[];
  isNewDraft?: boolean;
}

function normalizeStoryboardNarration(sb: Storyboard | null): Storyboard | null {
  if (!sb) return null;
  let changed = false;
  const cuts = sb.cuts.map((cut) => {
    if (cut.narration && !cut.dialogue.some((d) => !d.speakerId || d.balloon === "narration_box")) {
      changed = true;
      return {
        ...cut,
        dialogue: [
          {
            id: `line_narr_${cut.id}`,
            speakerId: null,
            text: cut.narration,
            balloon: "narration_box" as const,
          },
          ...cut.dialogue,
        ],
        narration: undefined,
      };
    }
    return cut;
  });
  return changed ? { ...sb, cuts } : sb;
}

export function StoryboardScreen(props: StoryboardScreenProps) {
  const router = useRouter();
  const [sb, setSb] = useState<Storyboard | null>(() => normalizeStoryboardNarration(props.initial));
  const [usedMock, setUsedMock] = useState(props.usedMock);
  const [story, setStory] = useState(props.initial?.story || props.story || "");
  const [cutCount, setCutCount] = useState<number>(
    props.cutCount ?? (props.initial?.cuts.length || 4)
  );

  // 시리즈 관리 상태
  const [seriesList, setSeriesList] = useState<SeriesSummary[]>(props.allSeries ?? []);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(
    props.seriesId ?? (props.allSeries?.[0]?.id || null)
  );
  const [openNewSeriesModal, setOpenNewSeriesModal] = useState(false);
  const [openSelectSeriesModal, setOpenSelectSeriesModal] = useState(false);

  // 콘티 1, 2단계 네비게이션 상태: 초안이 이미 만들어져 있으면 2단계(컷 콘티)로 바로 진입
  const [step, setStep] = useState<"story" | "cuts">(() => {
    if (props.isNewDraft && (!props.initial || props.initial.cuts.length === 0)) {
      return "story";
    }
    return props.initial && props.initial.cuts.length > 0 ? "cuts" : "story";
  });

  // 이미지(카톡/글 캡처) OCR 추출 상태
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);

  // 컷 편집 상태
  const [tier, setTier] = useState<GenerationTier>("pro");
  const [notice, setNotice] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<{ required: number; available: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    props.initial?.cuts[0]?.id ?? null
  );
  const [customLocations, setCustomLocations] = useState<string[]>([]);

  // 초기 자동 콘티 생성: 콘티가 없고 기존에 사연이 충분히 있는 경우(예: 온보딩 직후)
  const started = useRef(-1);
  useEffect(() => {
    if (sb || started.current === 0) return;
    if (!story || story.trim().length < 10) return;
    started.current = 0;
    void generateStoryboardAction({
      episodeId: props.episodeId,
      story: story.trim(),
      cutCount,
      seriesId: selectedSeriesId ?? undefined,
    }).then((r) => {
      if (r.ok) {
        const normalized = normalizeStoryboardNarration(r.data.storyboard)!;
        setSb(normalized);
        setUsedMock(r.data.usedMock);
        setSelectedId(normalized.cuts[0]?.id ?? null);
        setStep("cuts");
      } else {
        setNotice(r.message);
      }
    });
  }, [sb, props.episodeId, story, cutCount, selectedSeriesId]);

  // 편집 자동 저장
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const lastSaved = useRef(JSON.stringify(props.initial));
  useEffect(() => {
    if (!sb) return;
    const body = JSON.stringify(sb);
    if (body === lastSaved.current) return;
    const timer = setTimeout(async () => {
      setSaveNote("저장 중...");
      const r = await saveStoryboardAction(sb);
      if (r.ok) lastSaved.current = body;
      setSaveNote(r.ok ? "저장됨" : r.message);
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [sb]);

  const allCustomLocations = useMemo(() => {
    if (!sb) return customLocations;
    const set = new Set(customLocations);
    for (const cut of sb.cuts) {
      if (cut.background?.customName) {
        set.add(cut.background.customName);
      }
    }
    return Array.from(set);
  }, [customLocations, sb]);

  const currentSeries = seriesList.find((s) => s.id === selectedSeriesId) ?? null;
  const ready = sb ? canGenerate(sb) : false;
  const unitCost = tier === "pro" ? CREDIT_COST.cutImagePro : CREDIT_COST.cutImage;
  const cost = (sb?.cuts.length ?? 0) * unitCost;

  /** 카톡 캡처 등 이미지 파일 OCR 사연 추출 */
  async function handleImageFile(file: File) {
    if (!file) return;
    setVisionError(null);
    setAnalyzingImage(true);
    setUploadedImageName(file.name);

    const previewUrl = URL.createObjectURL(file);
    setUploadedImagePreview(previewUrl);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await extractStoryFromImageAction(formData);
      if (res.ok) {
        setStory(res.story);
      } else {
        setVisionError(res.message);
      }
    } catch {
      setVisionError("이미지 분석 중 문제가 발생했습니다.");
    } finally {
      setAnalyzingImage(false);
    }
  }

  /** 사연으로 콘티 생성/재생성 (크레딧 무료) */
  function handleGenerateStoryboard() {
    if (!story.trim() || story.trim().length < 10) {
      setNotice("사연을 조금 더 적어주세요. 한두 문장이면 충분해요.");
      return;
    }
    setNotice(null);
    startTransition(async () => {
      const res = await generateStoryboardAction({
        episodeId: props.episodeId,
        story: story.trim(),
        cutCount,
        seriesId: selectedSeriesId ?? undefined,
      });
      if (res.ok) {
        const normalized = normalizeStoryboardNarration(res.data.storyboard)!;
        lastSaved.current = JSON.stringify(normalized);
        setSb(normalized);
        setUsedMock(res.data.usedMock);
        setSelectedId(normalized.cuts[0]?.id ?? null);
        setStep("cuts");
      } else {
        if (res.kind === "credit") {
          setShortfall({ required: res.required, available: res.available });
        } else {
          setNotice(res.message);
        }
      }
    });
  }

  /** 이미지 생성 실행 */
  function startGeneration() {
    if (!sb) return;
    startTransition(async () => {
      const res = await startGenerationAction(sb, tier);
      if (res.ok) {
        router.push(`/episodes/${sb.episodeId}/editor?job=${res.data.id}`);
      } else if (res.kind === "credit") {
        setShortfall({ required: res.required, available: res.available });
      } else {
        setNotice(res.message);
      }
    });
  }

  function patchCut(id: string, patch: Partial<StoryboardCut>) {
    setSb((s) => (s ? { ...s, cuts: s.cuts.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : s));
  }

  function moveCut(id: string, dir: -1 | 1) {
    setSb((s) => {
      if (!s) return s;
      const from = s.cuts.findIndex((c) => c.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= s.cuts.length) return s;
      const next = [...s.cuts];
      [next[from], next[to]] = [next[to], next[from]];
      return { ...s, cuts: reindexCuts(next) };
    });
  }

  function removeCut(id: string) {
    setSb((s) => {
      if (!s) return s;
      return { ...s, cuts: reindexCuts(s.cuts.filter((c) => c.id !== id)) };
    });
    if (selectedId === id) setSelectedId(null);
  }

  function addCutAfter(id: string) {
    setSb((s) => {
      if (!s) return s;
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

  const hasCoverCut = sb?.cuts.some((c) => c.isCover) ?? false;

  function toggleCoverCut(enable: boolean) {
    setSb((s) => {
      if (!s) return s;
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
      if (!s) return s;
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
      if (!s) return s;
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

  // 인라인 후킹 핸들러
  function toggleHook(enable: boolean) {
    setSb((s) => {
      if (!s) return s;
      if (enable) {
        const firstId = s.hookOptions[0]?.id ?? "hook_1";
        const options = s.hookOptions.length > 0
          ? s.hookOptions
          : [{ id: "hook_1", text: "새로운 이야기의 시작", rationale: "기본 후킹 문구" }];
        return { ...s, hookOptions: options, selectedHookId: firstId };
      } else {
        return { ...s, selectedHookId: null };
      }
    });
  }

  function selectHook(id: string) {
    setSb((s) => {
      if (!s) return s;
      const selected = s.hookOptions.find((h) => h.id === id);
      const text = selected?.text ?? "";
      const nextCuts = text
        ? s.cuts.map((c) => {
            if (!c.isCover) return c;
            const updatedScene = c.scene.includes("[표지/타이틀 커버]")
              ? c.scene.replace(/\[표지\/타이틀 커버\] "[^"]*"/, `[표지/타이틀 커버] "${text}"`)
              : `[표지/타이틀 커버] "${text}" - ${c.scene}`;
            return { ...c, scene: updatedScene };
          })
        : s.cuts;
      return { ...s, selectedHookId: id, cuts: nextCuts };
    });
  }

  function changeHookText(text: string) {
    setSb((s) => {
      if (!s || !s.selectedHookId) return s;
      const nextCuts = s.cuts.map((c) => {
        if (!c.isCover) return c;
        const updatedScene = c.scene.includes("[표지/타이틀 커버]")
          ? c.scene.replace(/\[표지\/타이틀 커버\] "[^"]*"/, `[표지/타이틀 커버] "${text}"`)
          : `[표지/타이틀 커버] "${text}" - ${c.scene}`;
        return { ...c, scene: updatedScene };
      });
      return {
        ...s,
        hookOptions: s.hookOptions.map((h) => (h.id === s.selectedHookId ? { ...h, text } : h)),
        cuts: nextCuts,
      };
    });
  }

  // 인라인 CTA 핸들러
  function toggleCta(enable: boolean) {
    setSb((s) => {
      if (!s) return s;
      if (enable) {
        const firstId = s.ctaOptions[0]?.id ?? "cta_1";
        const options = s.ctaOptions.length > 0
          ? s.ctaOptions
          : [{ id: "cta_1", text: "댓글로 여러분의 생각을 남겨주세요!", rationale: "기본 참여 유도 문구", kind: "question" as const }];
        return { ...s, ctaOptions: options, selectedCtaId: firstId };
      } else {
        return { ...s, selectedCtaId: null };
      }
    });
  }

  function selectCta(id: string) {
    setSb((s) => (s ? { ...s, selectedCtaId: id } : s));
  }

  function changeCtaText(text: string) {
    setSb((s) => {
      if (!s || !s.selectedCtaId) return s;
      return {
        ...s,
        ctaOptions: s.ctaOptions.map((c) => (c.id === s.selectedCtaId ? { ...c, text } : c)),
      };
    });
  }

  const charactersList = sb?.characters ?? (
    props.fixedCharacters.length > 0
      ? props.fixedCharacters.map((name, i) => ({ key: i === 0 ? "ch_me" : `ch_${i}`, name }))
      : [{ key: "ch_me", name: "나" }]
  );

  return (
    <div className="min-h-dvh bg-surface-page">
      <EpisodeHeader
        episodeId={props.episodeId}
        seriesTitle={currentSeries?.title ?? props.seriesTitle}
        episodeTitle={props.episodeTitle}
        current="storyboard"
        credits={props.credits}
      />

      {/* 1, 2단계 스텝 네비게이션 & 빠른 이미지 생성 탑 바 */}
      <div className="sticky top-0 z-20 border-b border-border bg-surface-card/95 backdrop-blur-md shadow-2xs">
        <div className="mx-auto flex max-w-[880px] items-center justify-between px-3 sm:px-4 py-2 gap-2">
          {/* 좌측: 1, 2단계 스텝 버튼 */}
          <nav aria-label="콘티 제작 단계" className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* 1단계 */}
            <button
              type="button"
              onClick={() => setStep("story")}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
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
                    : "bg-surface-sunken text-ink-muted border border-border/80",
                )}
              >
                1
              </span>
              <span>사연 & 기획</span>
            </button>

            <ChevronRight className="size-4 text-ink-subtle select-none shrink-0" />

            {/* 2단계 */}
            <button
              type="button"
              onClick={() => setStep("cuts")}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer",
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
                    : "bg-surface-sunken text-ink-muted border border-border/80",
                )}
              >
                2
              </span>
              <span>컷 콘티 편집</span>
              {sb && sb.cuts.length > 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    step === "cuts"
                      ? "bg-white/20 text-white"
                      : "bg-brand-tint text-brand border border-brand/30",
                  )}
                >
                  {sb.cuts.length}컷
                </span>
              )}
            </button>
          </nav>

          {/* 우측: 품질 토글(일반/Pro) + 이미지 생성 버튼 */}
          {sb && sb.cuts.length > 0 ? (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* 생성 품질 토글 */}
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
                    "cursor-pointer rounded-md px-2 sm:px-2.5 py-1 transition-all text-xs",
                    tier === "standard"
                      ? "bg-surface-card text-ink shadow-2xs font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                  title="표준 화질 빠른 생성 (컷당 1크레딧)"
                >
                  ⚡ 일반
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tier === "pro"}
                  onClick={() => setTier("pro")}
                  className={cn(
                    "cursor-pointer rounded-md px-2 sm:px-2.5 py-1 transition-all text-xs",
                    tier === "pro"
                      ? "bg-brand text-on-brand shadow-2xs font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                  title="고화질 디테일 생성 (컷당 2크레딧)"
                >
                  💎 Pro
                </button>
              </div>

              {/* 이미지 생성 버튼 */}
              <Button
                size="sm"
                cost={cost}
                disabled={!ready}
                loading={pending}
                onClick={startGeneration}
                className="font-bold shadow-xs px-2.5 sm:px-3.5"
              >
                <span className="hidden sm:inline">
                  {tier === "pro" ? "💎 Pro 이미지 생성" : "⚡ 일반 이미지 생성"}
                </span>
                <span className="sm:hidden">생성</span>
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-[880px] p-4 pb-28 lg:pb-16 flex flex-col gap-5">
        {saveNote && (
          <p aria-live="polite" className="text-right text-caption text-ink-subtle">
            {saveNote}
          </p>
        )}
        {notice && (
          <p className="rounded-lg bg-danger-tint px-3 py-2 text-body-sm text-danger">
            {notice}
          </p>
        )}

        {/* 1단계: 사연 & 시리즈 기획 패널 */}
        {step === "story" && (
          <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface-card p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-brand-tint text-base font-bold text-brand shadow-2xs">
                  📝
                </span>
                <div>
                  <h2 className="text-label font-bold text-ink">1단계 · 사연 & 시리즈 기획</h2>
                  <p className="text-caption text-ink-muted">
                    시리즈와 컷 수를 고르고 사연을 입력하세요. 사연을 수정하면 언제든 콘티를 새로 짤 수 있어요.
                  </p>
                </div>
              </div>
            </div>

            {/* 시리즈 선택 row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-sunken/40 p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-on-brand font-bold text-xs shadow-2xs">
                  {currentSeries?.title?.[0] ?? "툰"}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm font-bold text-ink truncate">
                      {currentSeries?.title ?? props.seriesTitle}
                    </span>
                    <Badge tone="brand" className="text-[10px]">
                      {currentSeries?.episodeCount ?? 0}화 연재 중
                    </Badge>
                  </div>
                  <span className="text-[11px] text-ink-muted truncate">
                    화풍 프리셋: {props.stylePreset} · 화면 비율: {props.aspectRatio}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpenSelectSeriesModal(true)}
                  className="text-caption font-semibold"
                >
                  시리즈 변경
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpenNewSeriesModal(true)}
                  className="text-caption font-semibold"
                >
                  + 새 시리즈
                </Button>
              </div>
            </div>

            {/* 사연 입력 섹션 */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-label font-bold text-ink">사연 내용</label>
                <label className="flex items-center gap-1.5 cursor-pointer rounded-lg border border-brand/40 bg-brand-tint px-3 py-1.5 text-caption font-bold text-brand hover:bg-brand hover:text-white transition-all shadow-2xs">
                  <Camera className="size-3.5" />
                  <span>카톡/글 캡처 올리기</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={analyzingImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageFile(file);
                    }}
                  />
                </label>
              </div>

              {/* 첨부 이미지 미리보기 & 상태 */}
              {uploadedImagePreview && (
                <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand-tint/20 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={uploadedImagePreview}
                      alt="첨부된 캡처"
                      className="size-12 rounded-lg object-cover border border-border/80 shrink-0 shadow-2xs"
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-body-sm font-bold text-ink truncate">
                          {uploadedImageName}
                        </span>
                        {analyzingImage && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand animate-pulse">
                            <Sparkles className="size-3 animate-spin" />
                            AI 텍스트 추출 중...
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-ink-muted leading-tight">
                        {analyzingImage
                          ? "이미지 속 대화와 텍스트를 AI가 분석하고 있어요."
                          : "사연 텍스트를 추출했습니다. 자유롭게 보완해 보세요!"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={analyzingImage}
                    onClick={() => {
                      setUploadedImagePreview(null);
                      setUploadedImageName(null);
                    }}
                    className="text-caption font-medium text-ink-muted hover:text-danger px-2 py-1 cursor-pointer transition-colors shrink-0"
                  >
                    삭제
                  </button>
                </div>
              )}

              {visionError && (
                <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-tint px-3 py-2 text-caption text-danger">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{visionError}</span>
                </div>
              )}

              <Field
                label=""
                multiline
                rows={5}
                value={story}
                onChange={setStory}
                placeholder="이번 회차에서 다룰 재미있는 에피소드나 대화를 적어주세요. 카톡 대화 형식도 가능해요!&#10;(우측 상단의 '카톡/글 캡처 올리기'로 캡처를 올리면 AI가 자동으로 읽어드려요)"
                maxLength={1000}
              />

              {/* 추천 에피소드 소재 칩 */}
              <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
                <div className="flex items-center gap-1.5 text-label font-semibold text-ink">
                  <Lightbulb className="size-4 text-warning" />
                  <span>추천 에피소드 소재</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((e) => (
                    <button
                      key={e.chip}
                      type="button"
                      onClick={() => setStory(e.text)}
                      className="flex items-center gap-1.5 rounded-full border border-border/80 bg-surface-sunken/60 px-3 py-1 text-label text-ink-muted hover:border-brand hover:text-ink transition-all cursor-pointer shadow-2xs"
                    >
                      <span>{e.emoji}</span>
                      <span>{e.chip}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 컷 수 선택 */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
              <label className="text-label font-semibold text-ink">컷 수 설정</label>
              <div className="flex flex-wrap items-center gap-2">
                {[4, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCutCount(num)}
                    className={cn(
                      "h-8.5 px-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs",
                      cutCount === num
                        ? "border-brand bg-brand text-on-brand shadow-xs"
                        : "border-border/80 bg-surface-card text-ink hover:border-brand/60 hover:bg-surface-sunken/40"
                    )}
                  >
                    {num}컷
                  </button>
                ))}
                <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-surface-card p-0.5 shadow-2xs">
                  <button
                    type="button"
                    disabled={cutCount <= 1}
                    onClick={() => setCutCount((c) => Math.max(1, c - 1))}
                    className="size-7 rounded-lg grid place-items-center text-ink-muted hover:text-ink hover:bg-surface-sunken disabled:opacity-30 cursor-pointer font-bold text-xs"
                  >
                    -
                  </button>
                  <span className="w-7 text-center text-xs font-bold text-ink">{cutCount}</span>
                  <button
                    type="button"
                    disabled={cutCount >= 20}
                    onClick={() => setCutCount((c) => Math.min(20, c + 1))}
                    className="size-7 rounded-lg grid place-items-center text-ink-muted hover:text-ink hover:bg-surface-sunken disabled:opacity-30 cursor-pointer font-bold text-xs"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* 등장인물 관리 */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-label font-semibold text-ink">등장인물 관리</span>
                <span className="text-caption text-ink-muted">{charactersList.length}명 등록됨</span>
              </div>
              <StoryCharacterManager
                characters={charactersList}
                onAddCharacter={addCharacter}
                onRemoveCharacter={removeCharacter}
              />
            </div>

            {/* 콘티 생성 및 컷 콘티 이동 버튼 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/70">
              <span className="text-caption text-ink-muted">
                {sb && sb.cuts.length > 0
                  ? "콘티를 다시 생성하면 대사와 연출이 초기화됩니다. (크레딧 무료)"
                  : "콘티 생성은 크레딧을 소모하지 않습니다."}
              </span>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <Button
                  size="md"
                  loading={pending}
                  onClick={handleGenerateStoryboard}
                  className="font-bold shrink-0 gap-1.5 shadow-xs"
                >
                  <RefreshCw className={cn("size-4", pending && "animate-spin")} />
                  <span>
                    {sb && sb.cuts.length > 0
                      ? `🔄 사연으로 콘티 다시 생성 (${cutCount}컷)`
                      : `✨ 이 사연으로 콘티 생성하기 (${cutCount}컷)`}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 2단계: 컷 콘티 편집 */}
        {step === "cuts" && (
          <div className="flex flex-col gap-4">

            {usedMock && (
              <p className="rounded-lg bg-surface-sunken px-3 py-2 text-caption text-ink-muted">
                모델 키(ANTHROPIC_API_KEY)가 없어 사연 문장으로 콘티 틀만 짰어요. 키를 넣으면 작가처럼 다시 써 드려요.
              </p>
            )}

            {!sb || sb.cuts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-surface-card p-12 text-center shadow-2xs">
                <div className="grid size-12 place-items-center rounded-2xl bg-brand-tint text-brand text-2xl mb-3 shadow-2xs">
                  🎬
                </div>
                <h3 className="text-body font-bold text-ink">아직 콘티가 생성되지 않았어요</h3>
                <p className="mt-1 text-body-sm text-ink-muted max-w-sm mb-4">
                  1단계에서 사연을 입력하고 콘티를 생성하면, AI가 화풍과 캐릭터를 유지한 컷별 연출과 대사를 자동으로 구성해 드려요.
                </p>
                <Button
                  size="md"
                  onClick={() => setStep("story")}
                  className="font-bold gap-1.5"
                >
                  <PenSquare className="size-4" />
                  <span>1단계: 사연 & 기획으로 가기</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
            {/* 독립 표지(커버) 컷 토글 바 */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-surface-card px-4 py-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-brand-tint text-base font-bold text-brand shadow-2xs">
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

            {/* 컷별 콘티 목록 (1컷에 후킹 인라인 통합, 마지막 컷에 CTA 인라인 통합) */}
            {sb.cuts.map((cut) => (
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
                  setCustomLocations((prev) => (prev.includes(name) ? prev : [...prev, name]))
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
                    dialogue: cut.dialogue.map((l) => (l.id === lineId ? { ...l, text } : l)),
                  })
                }
                onChangeLineSpeaker={(lineId, speakerId) => {
                  setSb((s) => {
                    if (!s) return s;
                    const nextCuts = s.cuts.map((c) => {
                      if (c.id !== cut.id) return c;
                      const nextCharIds =
                        speakerId && !c.characterIds.includes(speakerId)
                          ? [...c.characterIds, speakerId]
                          : c.characterIds;
                      const nextDialogue = c.dialogue.map((l) => {
                        if (l.id !== lineId) return l;
                        const nextBalloon: BalloonKind = !speakerId
                          ? "narration_box"
                          : l.balloon === "narration_box"
                            ? "normal"
                            : l.balloon;
                        return { ...l, speakerId, balloon: nextBalloon };
                      });
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
                    dialogue: cut.dialogue.map((l) => (l.id === lineId ? { ...l, balloon } : l)),
                  })
                }
                // 후킹 인라인 통합 props: 표지 컷이 있으면 표지 컷에, 없으면 1컷에 전달
                isHookCut={hasCoverCut ? Boolean(cut.isCover) : cut.index === 1}
                hookOptions={sb.hookOptions}
                selectedHookId={sb.selectedHookId}
                onToggleHook={toggleHook}
                onSelectHook={selectHook}
                onChangeHookText={changeHookText}
                // CTA 인라인 통합 props (마지막 컷)
                isCtaCut={cut.index === sb.cuts.length}
                ctaOptions={sb.ctaOptions}
                selectedCtaId={sb.selectedCtaId}
                onToggleCta={toggleCta}
                onSelectCta={selectCta}
                onChangeCtaText={changeCtaText}
              />
            ))}

            {/* 하단 완성 안내 및 간결한 보조 생성 바 */}
            {!ready ? (
              <p className="rounded-xl bg-warning-tint/70 border border-warning/30 px-4 py-3 text-body-sm text-warning text-center font-medium shadow-2xs">
                ⚠️ 모든 컷의 장면 묘사를 입력하면 상단에서 이미지 생성을 시작할 수 있어요.
              </p>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-surface-card p-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚀</span>
                  <span className="text-body-sm font-bold text-ink">
                    총 {sb.cuts.length}컷 콘티 완성
                  </span>
                  <span className="text-caption text-ink-muted">
                    ({props.aspectRatio} · {props.stylePreset})
                  </span>
                </div>
                <Button
                  size="md"
                  cost={cost}
                  disabled={!ready}
                  loading={pending}
                  onClick={startGeneration}
                  className="font-bold shadow-xs px-5"
                >
                  {tier === "pro" ? "💎 Pro 이미지 생성 시작" : "⚡ 일반 이미지 생성 시작"}
                </Button>
              </div>
            )}
          </div>
        )}
          </div>
        )}
      </main>

      {/* 모바일 하단 플로팅 바 (2단계 컷 콘티 편집 시) */}
      {step === "cuts" && sb && sb.cuts.length > 0 && (
        <div className="sticky bottom-0 z-30 border-t border-border/80 bg-surface-card/95 p-3 backdrop-blur-md lg:hidden shadow-lg pb-[env(safe-area-inset-bottom,14px)]">
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
        </div>
      )}

      {/* 1. 새 시리즈 만들기 모달 */}
      <SeriesFormModal
        open={openNewSeriesModal}
        onClose={() => setOpenNewSeriesModal(false)}
        onCreated={(newS) => {
          const created: SeriesSummary = {
            id: newS.id,
            title: newS.title,
            description: null,
            isPublic: true,
            episodeCount: 0,
            updatedAt: new Date().toISOString(),
          };
          setSeriesList((prev) => [created, ...prev]);
          setSelectedSeriesId(newS.id);
        }}
      />

      {/* 2. 기존 시리즈 불러오기 모달 */}
      <Modal
        open={openSelectSeriesModal}
        onClose={() => setOpenSelectSeriesModal(false)}
        title="시리즈 선택"
        description="이어서 연재할 시리즈를 선택해 주세요."
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setOpenSelectSeriesModal(false);
                setOpenNewSeriesModal(true);
              }}
            >
              + 새 시리즈 만들기
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setOpenSelectSeriesModal(false)}>
              닫기
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
          {seriesList.map((s) => {
            const isSelected = selectedSeriesId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSelectedSeriesId(s.id);
                  setOpenSelectSeriesModal(false);
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3.5 text-left transition-all cursor-pointer",
                  isSelected
                    ? "border-brand bg-brand-tint/50 shadow-xs ring-2 ring-brand/30"
                    : "border-border/80 bg-surface-card hover:border-brand/60 hover:bg-surface-sunken/40"
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-body font-bold text-ink">{s.title}</span>
                    <Badge tone={isSelected ? "brand" : "neutral"} className="text-[10px]">
                      {s.episodeCount}화
                    </Badge>
                  </div>
                  {s.description && (
                    <span className="text-caption text-ink-muted line-clamp-1">{s.description}</span>
                  )}
                </div>
                {isSelected && <Check className="size-5 text-brand stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      </Modal>

      {/* 크레딧 부족 안내 모달 */}
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
        className="flex h-8 items-center gap-1.5 rounded-full border border-border/80 bg-surface-card hover:bg-surface-sunken hover:border-border-control px-2.5 text-caption font-bold text-ink transition-all cursor-pointer shadow-2xs"
      >
        <MapPin className="size-3.5 text-ink-muted shrink-0" />
        {isSolid && (
          <span
            className="size-2.5 rounded-full border border-black/15 shrink-0"
            style={{ backgroundColor: background?.colorHex ?? "#FFF9F0" }}
          />
        )}
        <span className="max-w-[120px] truncate">{currentLabel}</span>
        <ChevronDown className="size-3 text-ink-muted shrink-0" />
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
  const isMe = speakerId === "ch_me";
  const isNarration = !speakerId;
  return (
    <div className="relative inline-flex items-center">
      <select
        value={speakerId ?? ""}
        onChange={(e) => onSelectSpeaker(e.target.value ? e.target.value : null)}
        aria-label="화자 선택"
        className={cn(
          "h-8.5 pl-3 pr-7 rounded-lg text-xs font-bold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs appearance-none",
          isNarration
            ? "bg-surface-sunken/80 border-border text-ink-muted hover:bg-surface-sunken hover:text-ink"
            : isMe
              ? "bg-brand-tint border-brand/40 text-brand"
              : "bg-surface-sunken/60 border-border text-ink hover:bg-surface-sunken"
        )}
      >
        <option value="">나레이션 (화자 없음)</option>
        {characters.map((ch) => (
          <option key={ch.key} value={ch.key}>
            {ch.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3 text-ink-muted" />
    </div>
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
  hasCoverCut,
  // 후킹 인라인 통합 props
  isHookCut,
  hookOptions = [],
  selectedHookId,
  onToggleHook,
  onSelectHook,
  onChangeHookText,
  // CTA 인라인 통합 props
  isCtaCut,
  ctaOptions = [],
  selectedCtaId,
  onToggleCta,
  onSelectCta,
  onChangeCtaText,
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
  hasCoverCut?: boolean;
  isHookCut?: boolean;
  hookOptions?: { id: string; text: string }[];
  selectedHookId?: string | null;
  onToggleHook?: (enable: boolean) => void;
  onSelectHook?: (id: string) => void;
  onChangeHookText?: (text: string) => void;
  isCtaCut?: boolean;
  ctaOptions?: { id: string; text: string }[];
  selectedCtaId?: string | null;
  onToggleCta?: (enable: boolean) => void;
  onSelectCta?: (id: string) => void;
  onChangeCtaText?: (text: string) => void;
}) {
  const bgLabel =
    cut.background?.preset === "solid_color"
      ? "단색 배경"
      : cut.background?.customName
        ? cut.background.customName
        : DEFAULT_LOCATIONS.find((l) => l.id === cut.background?.preset)?.label ?? "거실";

  const currentHookText = hookOptions.find((h) => h.id === selectedHookId)?.text ?? "";
  const currentCtaText = ctaOptions.find((c) => c.id === selectedCtaId)?.text ?? "";
  const displayCutLabel = cut.isCover ? "COVER" : `CUT ${hasCoverCut ? cut.index - 1 : cut.index}`;

  // 1. 비선택 상태 (컴팩트 & 세련된 인스타툰 컷 요약 카드)
  if (!selected) {
    return (
      <article
        onClick={onSelect}
        className={cn(
          "group flex cursor-pointer flex-col gap-3 rounded-2xl border bg-surface-card p-4 transition-all duration-200 hover:border-brand/60 hover:shadow-sm hover:bg-surface-card/95 relative overflow-hidden",
          cut.isCover
            ? "border-brand/40 bg-brand-tint/10 shadow-2xs"
            : "border-border/80 shadow-2xs"
        )}
      >
        {/* 상단 컷 인덱스 & 역할 뱃지 & 순서 툴바 */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "grid h-6.5 min-w-7 px-1.5 place-items-center rounded-md text-[11px] font-black tracking-wider shadow-2xs",
              cut.isCover ? "bg-brand text-on-brand" : "bg-ink text-surface-card"
            )}
          >
            {displayCutLabel}
          </span>

          {cut.isCover ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint border border-brand/30 px-2.5 py-0.5 text-[11px] font-bold text-brand">
              🌟 표지 컷 (인스타 썸네일)
            </span>
          ) : (
            <>
              {isHookCut && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint border border-brand/30 px-2 py-0.5 text-[11px] font-bold text-brand">
                  🔥 후킹 컷
                </span>
              )}
              {isCtaCut && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                  🎯 CTA 컷
                </span>
              )}
            </>
          )}

          {/* 연출 태그 칩 */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken/70 border border-border/60 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
              <Smile className="size-3 text-ink-subtle" />
              {EMOTION_LABEL[cut.emotion]}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken/70 border border-border/60 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
              <Camera className="size-3 text-ink-subtle" />
              {CAMERA_LABEL[cut.camera]}
            </span>
            <span className="inline-flex items-center gap-1 max-w-[130px] truncate rounded-full bg-surface-sunken/70 border border-border/60 px-2 py-0.5 text-[11px] font-medium text-ink-muted">
              <MapPin className="size-3 text-ink-subtle shrink-0" />
              <span className="truncate">{bgLabel}</span>
            </span>
          </div>

          {/* 우측 퀵 액션 툴바 */}
          <div
            className="ml-auto flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onSelect}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand-tint transition-colors cursor-pointer mr-1"
            >
              편집하기 <ChevronDown className="size-3.5" />
            </button>
            <IconButton label="위로" onClick={() => onMove(-1)} disabled={cut.index === 1}>
              <ArrowUp className="size-3.5" />
            </IconButton>
            <IconButton label="아래로" onClick={() => onMove(1)} disabled={cut.index === total}>
              <ArrowDown className="size-3.5" />
            </IconButton>
            <IconButton label="아래에 컷 추가" onClick={onAddAfter}>
              <Plus className="size-3.5" />
            </IconButton>
            <IconButton label="컷 삭제" onClick={onRemove} disabled={total === 1} danger>
              <Trash2 className="size-3.5" />
            </IconButton>
          </div>
        </div>

        {/* 후킹 / 표지 타이틀 요약 배너 (비선택 상태) */}
        {isHookCut && selectedHookId && currentHookText && (
          <div className="flex items-center gap-2 rounded-xl bg-brand-tint/30 border border-brand/30 px-3 py-1.5 text-xs">
            <span className="font-extrabold text-brand shrink-0">
              {cut.isCover ? "🌟 표지 타이틀:" : "🔥 후킹 배너:"}
            </span>
            <span className="text-ink font-semibold truncate">&ldquo;{currentHookText}&rdquo;</span>
          </div>
        )}

        {/* CTA 요약 배너 (마지막 컷 비선택 상태) */}
        {isCtaCut && selectedCtaId && currentCtaText && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs">
            <span className="font-extrabold text-amber-700 shrink-0">🎯 CTA 배너:</span>
            <span className="text-ink font-semibold truncate">&ldquo;{currentCtaText}&rdquo;</span>
          </div>
        )}

        {/* 장면 내용 지문 박스 */}
        <div className="flex items-start gap-2.5 rounded-xl bg-surface-sunken/35 p-2.5 border border-border/40">
          <div className="flex items-center gap-1 shrink-0 rounded bg-brand-tint/60 px-1.5 py-0.5 text-[10px] font-bold text-brand">
            <Clapperboard className="size-3" />
            <span>장면</span>
          </div>
          <p className="flex-1 text-body-sm text-ink-muted leading-relaxed line-clamp-2">
            {cut.scene ? (
              cut.scene
            ) : (
              <span className="italic text-ink-subtle">
                장면 묘사가 비어있어요. 클릭해서 입력해 주세요.
              </span>
            )}
          </p>
        </div>

        {/* 대사 & 나레이션 요약 미리보기 */}
        {cut.dialogue.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-xl bg-surface-sunken/25 p-2 border border-border/30">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
              <MessageSquare className="size-3 text-brand" />
              <span>대사/나레이션 {cut.dialogue.length}개</span>
            </div>
            <ul className="flex flex-col gap-1">
              {cut.dialogue.slice(0, 2).map((line) => {
                const speaker = !line.speakerId ? "나레이션" : nameOf(line.speakerId);
                return (
                  <li key={line.id} className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <span className="font-bold text-ink shrink-0">{speaker}:</span>
                    <span className="truncate text-ink-muted">&ldquo;{line.text || "(내용 없음)"}&rdquo;</span>
                    <span className="text-[10px] text-ink-subtle rounded bg-surface-card px-1 py-0.5 border border-border/50 shrink-0">
                      {BALLOON_LABEL[line.balloon]}
                    </span>
                  </li>
                );
              })}
              {cut.dialogue.length > 2 && (
                <li className="text-[10px] text-ink-subtle pl-1 font-medium">
                  외 {cut.dialogue.length - 2}개 더 보기...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* 하단 푸터 바 */}
        <div className="flex items-center border-t border-border/50 pt-2 text-caption text-[11px] text-ink-subtle">
          <span>{cut.dialogue.length > 0 ? `대사/나레이션 ${cut.dialogue.length}개` : "대사 없음"}</span>
        </div>
      </article>
    );
  }

  // 2. 선택 상태 (상세 편집 뷰)
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border-2 bg-surface-card p-5 shadow-md ring-4 ring-brand/10 transition-all",
        cut.isCover ? "border-brand ring-brand/20 bg-brand-tint/5" : "border-brand",
      )}
    >
      {/* 1. 상단 메인 헤더: 컷 넘버 & 특수 배지 & 우측 액션 버튼들 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "grid h-7 min-w-8 px-2 place-items-center rounded-lg text-xs font-black tracking-wider shadow-2xs",
              cut.isCover ? "bg-brand text-on-brand" : "bg-ink text-surface-card"
            )}
          >
            {displayCutLabel}
          </span>
          {cut.isCover ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint border border-brand/30 px-3 py-1 text-xs font-bold text-brand shadow-2xs">
              🌟 표지 컷 (인스타 썸네일)
            </span>
          ) : (
            <>
              {isHookCut && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint border border-brand/30 px-2.5 py-0.5 text-xs font-bold text-brand">
                  🔥 후킹 컷
                </span>
              )}
              {isCtaCut && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                  🎯 CTA 컷
                </span>
              )}
            </>
          )}
        </div>

        {/* 우측 접기 및 순서 이동/삭제 툴바 */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand-tint transition-colors cursor-pointer mr-1"
          >
            접기 <ChevronUp className="size-3.5" />
          </button>
          <IconButton label="위로" onClick={() => onMove(-1)} disabled={cut.index === 1}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label="아래로" onClick={() => onMove(1)} disabled={cut.index === total}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton label="아래에 컷 추가" onClick={onAddAfter}>
            <Plus className="size-4" />
          </IconButton>
          <IconButton label="컷 삭제" onClick={onRemove} disabled={total === 1} danger>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {/* 후킹 헤드라인 / 표지 타이틀 인라인 설정 섹션 */}
      {isHookCut && (
        <div
          className="flex flex-col gap-2.5 rounded-xl border border-brand/40 bg-brand-tint/15 p-3.5 shadow-2xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-lg bg-brand text-on-brand font-bold text-xs shadow-2xs">
                {cut.isCover ? "🌟" : "🔥"}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-ink">
                    {cut.isCover ? "표지 썸네일 후킹 타이틀 설정" : "1컷 후킹 헤드라인 설정"}
                  </span>
                  {selectedHookId ? (
                    <Badge tone="brand">{cut.isCover ? "타이틀 켜짐" : "배너 켜짐"}</Badge>
                  ) : (
                    <Badge tone="neutral">{cut.isCover ? "타이틀 꺼짐" : "배너 꺼짐"}</Badge>
                  )}
                </div>
                <p className="text-[11px] text-ink-muted">
                  {cut.isCover
                    ? "인스타그램 피드 썸네일 및 카드뉴스 첫 장의 메인 헤드라인 타이틀입니다."
                    : "첫 컷 상단 강조 배너 및 인스타그램 캡션 첫 줄로 자동 적용됩니다."}
                </p>
              </div>
            </div>
            {onToggleHook && (
              <button
                type="button"
                onClick={() => onToggleHook(!selectedHookId)}
                className="rounded-lg border border-brand/40 bg-surface-card px-2.5 py-1 text-caption font-bold text-brand hover:bg-brand hover:text-white transition-all cursor-pointer shadow-2xs"
              >
                {selectedHookId
                  ? cut.isCover ? "타이틀 끄기" : "후킹 끄기"
                  : cut.isCover ? "타이틀 켜기" : "후킹 켜기"}
              </button>
            )}
          </div>

          {selectedHookId && (
            <div className="flex flex-col gap-2 pt-2 border-t border-brand/20">
              <span className="text-[11px] font-bold text-ink-muted">
                {cut.isCover ? "AI 추천 표지 타이틀 선택:" : "AI 추천 후킹 문구 선택:"}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {hookOptions.map((opt) => {
                  const isSelected = selectedHookId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSelectHook?.(opt.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-2 text-left text-xs transition-all cursor-pointer",
                        isSelected
                          ? "border-brand bg-brand-tint text-brand font-bold shadow-2xs ring-1 ring-brand"
                          : "border-border/80 bg-surface-card text-ink hover:border-brand/60"
                      )}
                    >
                      <span className="truncate">{opt.text}</span>
                      {isSelected && <Check className="size-3.5 shrink-0 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-1 pt-1">
                <label className="text-[11px] font-bold text-ink-muted">
                  {cut.isCover ? "표지 타이틀 직접 수정:" : "후킹 문구 직접 수정:"}
                </label>
                <input
                  value={currentHookText}
                  onChange={(e) => onChangeHookText?.(e.target.value)}
                  placeholder={
                    cut.isCover
                      ? "인스타 피드 썸네일에 들어갈 표지 후킹 타이틀을 입력하세요"
                      : "첫 컷 상단에 들어갈 후킹 헤드라인을 입력하세요"
                  }
                  className="h-8 rounded-lg border border-border-control/80 bg-surface-card px-3 text-body-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 마지막 컷 인라인 CTA 참여 유도 설정 섹션 */}
      {isCtaCut && (
        <div
          className="flex flex-col gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 shadow-2xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-lg bg-amber-600 text-white font-bold text-xs shadow-2xs">
                🎯
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-ink">마지막 컷 CTA 참여 유도 설정</span>
                  {selectedCtaId ? (
                    <Badge tone="brand">배너 켜짐</Badge>
                  ) : (
                    <Badge tone="neutral">배너 꺼짐</Badge>
                  )}
                </div>
                <p className="text-[11px] text-ink-muted">
                  마지막 컷 하단 참여 배너 및 인스타그램 캡션 마무리 문구로 자동 적용됩니다.
                </p>
              </div>
            </div>
            {onToggleCta && (
              <button
                type="button"
                onClick={() => onToggleCta(!selectedCtaId)}
                className="rounded-lg border border-amber-500/40 bg-surface-card px-2.5 py-1 text-caption font-bold text-amber-700 hover:bg-amber-600 hover:text-white transition-all cursor-pointer shadow-2xs"
              >
                {selectedCtaId ? "CTA 끄기" : "CTA 켜기"}
              </button>
            )}
          </div>

          {selectedCtaId && (
            <div className="flex flex-col gap-2 pt-2 border-t border-amber-500/20">
              <span className="text-[11px] font-bold text-ink-muted">AI 추천 참여 유도 문구 선택:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {ctaOptions.map((opt) => {
                  const isSelected = selectedCtaId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSelectCta?.(opt.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-2 text-left text-xs transition-all cursor-pointer",
                        isSelected
                          ? "border-amber-600 bg-amber-500/20 text-amber-900 font-bold shadow-2xs ring-1 ring-amber-600"
                          : "border-border/80 bg-surface-card text-ink hover:border-amber-500/60"
                      )}
                    >
                      <span className="truncate">{opt.text}</span>
                      {isSelected && <Check className="size-3.5 shrink-0 stroke-[3] text-amber-700" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-1 pt-1">
                <label className="text-[11px] font-bold text-ink-muted">CTA 문구 직접 수정:</label>
                <input
                  value={currentCtaText}
                  onChange={(e) => onChangeCtaText?.(e.target.value)}
                  placeholder="마지막 컷 하단에 들어갈 참여 유도 문구를 입력하세요 (예: 댓글로 여러분의 생각을 알려주세요!)"
                  className="h-8 rounded-lg border border-border-control/80 bg-surface-card px-3 text-body-sm text-ink focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. 연출 파라미터 서브바 (감정, 구도, 장소) */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-sunken/45 p-2.5 border border-border/70"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] font-bold text-ink-muted flex items-center gap-1 mr-1">
          <Clapperboard className="size-3.5 text-brand" /> 연출 설정
        </span>

        {/* 감정 선택 */}
        <div className="relative inline-flex items-center">
          <Smile className="pointer-events-none absolute left-2.5 size-3.5 text-ink-muted" />
          <select
            value={cut.emotion}
            onChange={(e) => onChangeEmotion(e.target.value as CutEmotion)}
            aria-label={`${cut.index}컷 감정`}
            className="h-8 pl-8 pr-7 rounded-full border border-border/80 bg-surface-card text-caption font-bold text-ink hover:border-border-control focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all cursor-pointer shadow-2xs appearance-none"
          >
            {Object.entries(EMOTION_LABEL).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3 text-ink-muted" />
        </div>

        {/* 카메라 구도 선택 */}
        <div className="relative inline-flex items-center">
          <Camera className="pointer-events-none absolute left-2.5 size-3.5 text-ink-muted" />
          <select
            value={cut.camera}
            onChange={(e) => onChangeCamera(e.target.value as CameraShot)}
            aria-label={`${cut.index}컷 카메라 구도`}
            className="h-8 pl-8 pr-7 rounded-full border border-border/80 bg-surface-card text-caption font-bold text-ink hover:border-border-control focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all cursor-pointer shadow-2xs appearance-none"
          >
            {Object.entries(CAMERA_LABEL).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3 text-ink-muted" />
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
      </div>

      {/* 3. 장면 묘사 입력 박스 (핵심 시각 연출 지문) */}
      <div
        className="flex flex-col gap-2 rounded-xl border border-border bg-surface-sunken/30 p-3.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 focus-within:bg-surface-card transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Film className="size-4 text-brand" />
            <label className="text-body-sm font-bold text-ink">
              장면 묘사
            </label>
            <span className="text-[11px] text-ink-muted font-normal">
              (만화 연출 지문)
            </span>
          </div>
          <span className="rounded-full bg-brand-tint border border-brand/20 px-2 py-0.5 text-[10px] font-bold text-brand shadow-2xs">
            AI 이미지 프롬프트에 자동 반영
          </span>
        </div>
        <textarea
          value={cut.scene}
          onChange={(e) => onChangeScene(e.target.value)}
          placeholder="인물의 행동, 포즈, 표정, 소품과의 상호작용 등을 묘사해주세요 (예: 카페 창가에서 심각한 표정으로 커피잔을 쥐고 스마트폰을 응시하는 주인공)"
          rows={3}
          aria-label={`${cut.index}컷 장면 묘사`}
          className="w-full resize-none rounded-lg border border-border-control/60 bg-surface-card p-3 text-body-sm text-ink leading-relaxed placeholder:text-ink-subtle focus-visible:outline-none focus:border-brand shadow-2xs"
        />
      </div>

      {/* 4. 대사 및 말풍선/나레이션 관리 */}
      <div className="flex flex-col gap-2.5 pt-1" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="size-4 text-brand" />
            <span className="text-body-sm font-bold text-ink">
              대사 & 나레이션
            </span>
            <span className="grid size-5 place-items-center rounded-full bg-brand-tint text-[10px] font-extrabold text-brand">
              {cut.dialogue.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddLine}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-tint border border-brand/30 px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand hover:text-on-brand transition-all cursor-pointer shadow-2xs"
            >
              <Plus className="size-3.5" /> 대사/나레이션 추가
            </button>
          </div>
        </div>

        {cut.dialogue.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border/80 bg-surface-sunken/30 py-3 text-caption text-ink-muted">
            대사 또는 나레이션이 없는 무음 컷입니다. (상황이나 감정 위주의 컷)
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {cut.dialogue.map((line) => (
              <li
                key={line.id}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-border/80 bg-surface-card p-2.5 shadow-2xs hover:border-brand/40 transition-all"
              >
                <div className="flex items-center gap-2 shrink-0">
                  {/* 인물 화자 선택 (화자 없음 = 나레이션) */}
                  <SpeakerPicker
                    speakerId={line.speakerId}
                    characters={characters}
                    onSelectSpeaker={(speakerId) => onChangeLineSpeaker(line.id, speakerId)}
                  />

                  {/* 말풍선 종류 선택 */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={line.balloon}
                      onChange={(e) => onChangeLineBalloon(line.id, e.target.value as BalloonKind)}
                      aria-label="말풍선 종류"
                      className="h-8.5 pl-2.5 pr-7 rounded-lg border border-border/80 bg-surface-sunken/40 text-caption font-semibold text-ink focus:border-brand focus:outline-none transition-all cursor-pointer appearance-none"
                    >
                      {Object.entries(BALLOON_LABEL).map(([kind, label]) => (
                        <option key={kind} value={kind}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-ink-muted" />
                  </div>
                </div>

                {/* 대사/나레이션 텍스트 입력 */}
                <input
                  value={line.text}
                  onChange={(e) => onChangeLine(line.id, e.target.value)}
                  placeholder={!line.speakerId ? "나레이션 문구를 입력하세요" : "대사를 입력하세요"}
                  aria-label={!line.speakerId ? `${cut.index}컷 나레이션` : `${cut.index}컷 대사`}
                  className="h-8.5 min-w-0 flex-1 rounded-lg border border-border-control/60 bg-surface-sunken/20 px-3 text-body-sm text-ink placeholder:text-ink-subtle focus:bg-surface-card focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 shadow-2xs transition-all"
                />

                {/* 삭제 버튼 */}
                <button
                  type="button"
                  onClick={() => onRemoveLine(line.id)}
                  title={!line.speakerId ? "나레이션 삭제" : "대사 삭제"}
                  aria-label={!line.speakerId ? "나레이션 삭제" : "대사 삭제"}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
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
  danger = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
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
      className={cn(
        "grid size-7.5 cursor-pointer place-items-center rounded-lg text-caption font-semibold transition-all",
        danger
          ? "text-ink-muted hover:bg-danger/10 hover:text-danger"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
        "disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}
