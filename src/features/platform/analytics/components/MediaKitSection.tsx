"use client";

import { useState, useTransition } from "react";
import {
  FileText,
  Mail,
  Copy,
  Check,
  Download,
  Users,
  Target,
  Sparkles,
  Edit3,
} from "lucide-react";
import { Badge, Button, Field, Modal } from "@/components/ui";
import { updateMediaKitAction } from "../actions";
import type { MediaKitSummary } from "../types";

export interface MediaKitSectionProps {
  mediaKit: MediaKitSummary;
}

export function MediaKitSection({ mediaKit: initialMediaKit }: MediaKitSectionProps) {
  const [kitData, setKitData] = useState<MediaKitSummary>(initialMediaKit);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<MediaKitSummary>(initialMediaKit);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(`${window.location.origin}/mediakit/${kitData.channelName}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenEdit = () => {
    setEditForm(kitData);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    startTransition(async () => {
      const res = await updateMediaKitAction(editForm);
      if (res.ok) {
        setKitData(res.data);
        setIsEditing(false);
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3000);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {savedToast && (
        <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand-tint px-4 py-3 text-body-sm font-semibold text-brand shadow-2xs">
          <Check className="size-4 shrink-0 text-brand" />
          <span>미디어킷 정보가 저장되었어요. 제안서에 실시간 반영됩니다.</span>
        </div>
      )}

      {/* 상단 헤더 안내 */}
      <section className="flex flex-col gap-2 rounded-2xl border border-border/80 bg-surface-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
              <FileText className="size-5" />
            </div>
            <div>
              <h2 className="text-body font-bold text-ink sm:text-title">
                광고·협찬 제안용 미디어킷 (Media Kit)
              </h2>
              <p className="text-caption text-ink-muted">
                인스타그램 실측 성과 지표와 작가님의 협찬 조건을 결합해 광고주용 공식 소개서를 완성합니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenEdit}
              className="gap-1.5 font-semibold text-caption border-brand/30 text-brand hover:bg-brand-tint"
            >
              <Edit3 className="size-3.5" />
              미디어킷 정보 수정
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5 font-semibold text-caption"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? "링크 복사됨!" : "제안 링크 복사"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => alert("미디어킷 PDF 내보내기 기능은 정식 출시(v1.0)에 지원될 예정입니다.")}
              className="gap-1.5 font-bold text-caption shadow-2xs"
            >
              <Download className="size-3.5" />
              PDF 다운로드
            </Button>
          </div>
        </div>
      </section>

      {/* 미디어킷 실시간 프리뷰 카드 */}
      <div className="flex flex-col gap-6 rounded-3xl border border-border/80 bg-surface-card p-6 sm:p-8 shadow-sm">
        {/* 채널 헤더 */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Badge tone="brand" className="font-bold">
                {kitData.category}
              </Badge>
              <span className="text-caption text-ink-subtle">공식 인스타툰 채널</span>
            </div>
            <h3 className="text-title-lg font-extrabold text-ink sm:text-2xl">
              {kitData.channelName}
            </h3>
            <p className="text-body-sm text-ink-muted max-w-xl leading-relaxed pt-1">
              {kitData.bio}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 rounded-2xl bg-surface-sunken/60 p-4 border border-border/50">
            <span className="text-caption font-semibold text-ink-muted">광고·협업 문의</span>
            <span className="flex items-center gap-1.5 text-body-sm font-bold text-ink">
              <Mail className="size-4 text-brand" />
              {kitData.contactEmail}
            </span>
          </div>
        </div>

        {/* 핵심 통계 요약 (광고주가 가장 눈여겨보는 지표) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-2xl border border-border/70 bg-surface-sunken/40 p-4">
            <span className="text-caption font-semibold text-ink-muted flex items-center gap-1.5">
              <Target className="size-4 text-sky-500" />
              회차당 평균 도달
            </span>
            <span className="text-title-lg font-extrabold text-ink tabular-nums">
              {(kitData.avgReachPerEpisode / 10000).toFixed(1)}만 계정
            </span>
            <span className="text-[11px] text-ink-subtle">인스타그램 인사이트 집계</span>
          </div>

          <div className="flex flex-col gap-1 rounded-2xl border border-border/70 bg-surface-sunken/40 p-4">
            <span className="text-caption font-semibold text-ink-muted flex items-center gap-1.5">
              <Users className="size-4 text-pink-500" />
              주 타깃 오디언스
            </span>
            <span className="text-body font-bold text-ink">
              {kitData.primaryAudience.split("(")[0]}
            </span>
            <span className="text-[11px] text-ink-subtle">
              {kitData.primaryAudience.split("(")[1]?.replace(")", "") || "핵심 구독자층"}
            </span>
          </div>

          <div className="flex flex-col gap-1 rounded-2xl border border-border/70 bg-surface-sunken/40 p-4">
            <span className="text-caption font-semibold text-ink-muted flex items-center gap-1.5">
              <Sparkles className="size-4 text-amber-500" />
              표준 협찬 견적
            </span>
            <span className="text-body font-bold text-ink">
              {kitData.standardRate.split("(")[0]}
            </span>
            <span className="text-[11px] text-amber-700 font-medium">
              {kitData.standardRate.includes("(") ? kitData.standardRate.split("(")[1].replace(")", "") : "브랜드 맞춤 기획"}
            </span>
          </div>
        </div>

        {/* 협업 프로세스 안내 */}
        <div className="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand-subtle/20 p-5">
          <h4 className="text-body font-bold text-ink flex items-center gap-2">
            <Sparkles className="size-4 text-brand" />
            <span>샥툰 브랜드툰 협업 프로세스</span>
          </h4>
          <ol className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-caption text-ink-muted pt-1">
            <li className="flex flex-col gap-1 rounded-xl bg-surface-card p-3 border border-border/50">
              <span className="font-bold text-brand">1. 사연 & 콘셉트 접수</span>
              <span>브랜드 전달 메시지 및 제품 정보 확인</span>
            </li>
            <li className="flex flex-col gap-1 rounded-xl bg-surface-card p-3 border border-border/50">
              <span className="font-bold text-brand">2. AI 4~6컷 콘티 기획</span>
              <span>캐릭터와 화풍을 유지한 1차 시안 검토</span>
            </li>
            <li className="flex flex-col gap-1 rounded-xl bg-surface-card p-3 border border-border/50">
              <span className="font-bold text-brand">3. 작화 피드백 & 확정</span>
              <span>대사, 말풍선, 로고 및 광고 문구 반영</span>
            </li>
            <li className="flex flex-col gap-1 rounded-xl bg-surface-card p-3 border border-border/50">
              <span className="font-bold text-brand">4. 인스타그램 발행 & 성과 리포트</span>
              <span>게시 후 7일간의 도달·저장 반응 분석 공유</span>
            </li>
          </ol>
        </div>
      </div>

      {/* 미디어킷 등록 및 수정 모달 */}
      <Modal
        open={isEditing}
        onClose={() => setIsEditing(false)}
        size="md"
        title="미디어킷 정보 등록 & 수정"
        description="광고주에게 보낼 제안용 소개서에 표시될 채널 소개, 협찬 문의처, 표준 단가를 직접 등록하고 관리할 수 있습니다."
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              취소
            </Button>
            <Button loading={pending} onClick={handleSaveEdit}>
              저장하기
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <Field
            label="채널명 (계정 아이디 포함)"
            value={editForm.channelName}
            onChange={(v) => setEditForm((prev) => ({ ...prev, channelName: v }))}
            placeholder="예: 상어의 하루 (@sharktoon_daily)"
            help="인스타그램 채널명과 핸들을 적어주세요."
          />

          <Field
            label="대표 카테고리 / 장르"
            value={editForm.category}
            onChange={(v) => setEditForm((prev) => ({ ...prev, category: v }))}
            placeholder="예: 2030 직장인 일상툰 · 라이프스타일"
            help="광고주가 작가님의 주력 연재 분야를 한눈에 알아볼 수 있도록 적어주세요."
          />

          <Field
            label="채널 소개 (Bio)"
            multiline
            rows={3}
            value={editForm.bio}
            onChange={(v) => setEditForm((prev) => ({ ...prev, bio: v }))}
            placeholder="채널의 콘셉트, 연재 요일, 브랜드 협업 시의 강점을 적어주세요."
            help="제안서 상단에 광고주를 대상으로 한 공식 소개글로 들어갑니다."
          />

          <Field
            label="광고·협찬 문의 이메일"
            value={editForm.contactEmail}
            onChange={(v) => setEditForm((prev) => ({ ...prev, contactEmail: v }))}
            placeholder="예: yourname@gmail.com"
            help="협찬 제안서를 본 광고주 및 브랜드 담당자가 연락할 공식 이메일입니다."
          />

          <Field
            label="표준 협찬 견적 (단가 가이드)"
            value={editForm.standardRate}
            onChange={(v) => setEditForm((prev) => ({ ...prev, standardRate: v }))}
            placeholder="예: 피드 1회 게재 80~120만 원 (브랜드툰 협의 가능)"
            help="예산을 가늠할 수 있는 표준 피드 게재 비용 또는 컷당 기준을 적어주세요."
          />

          <Field
            label="주 타깃 오디언스 (성별 / 연령대)"
            value={editForm.primaryAudience}
            onChange={(v) => setEditForm((prev) => ({ ...prev, primaryAudience: v }))}
            placeholder="예: 여성 64% · 남성 36% (25~34세 직장인 비율 72%)"
            help="인스타그램 인사이트 통계 수치나 내 만화를 주로 소비하는 주 독자층을 적어주세요."
          />
        </div>
      </Modal>
    </div>
  );
}

