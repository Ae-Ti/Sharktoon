"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, TrendingUp, Sparkles, RefreshCw, Unlink, ExternalLink } from "lucide-react";
import { Badge, Button, Modal, Field } from "@/components/ui";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export interface InstagramIntegrationCardProps {
  seriesTitle?: string;
}

export function InstagramIntegrationCard({ seriesTitle }: InstagramIntegrationCardProps) {
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState("webtoon_creator");
  const [openModal, setOpenModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [inputUsername, setInputUsername] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sharktoon_insta_connected");
      if (saved === "true") {
        setConnected(true);
        const savedUser = localStorage.getItem("sharktoon_insta_username");
        if (savedUser) setUsername(savedUser);
      }
    }
  }, []);

  function handleConnect() {
    setConnecting(true);
    setTimeout(() => {
      const finalUser = inputUsername.trim() ? inputUsername.trim().replace(/^@/, "") : "sharktoon_author";
      setConnected(true);
      setUsername(finalUser);
      setConnecting(false);
      setOpenModal(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("sharktoon_insta_connected", "true");
        localStorage.setItem("sharktoon_insta_username", finalUser);
      }
    }, 700);
  }

  function handleDisconnect() {
    setConnected(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("sharktoon_insta_connected");
      localStorage.removeItem("sharktoon_insta_username");
    }
  }

  if (connected) {
    return (
      <div className="flex w-full shrink-0 flex-col gap-3.5 rounded-xl border border-pink-500/30 bg-gradient-to-b from-pink-500/5 to-transparent p-5 lg:w-80 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-2xs">
              <InstagramIcon className="size-4" />
            </div>
            <span className="text-body font-bold text-ink">인스타그램 연동됨</span>
          </div>
          <Badge tone="brand" className="text-[10px]">
            연결 활성
          </Badge>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-card p-3">
          <div className="flex flex-col">
            <span className="text-body-sm font-bold text-ink">@{username}</span>
            <span className="text-[11px] text-ink-muted">크리에이터 계정</span>
          </div>
          <a
            href={`https://instagram.com/${username}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
          >
            <span>프로필</span>
            <ExternalLink className="size-3" />
          </a>
        </div>

        {/* 연동 성과 지표 */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="flex flex-col gap-0.5 rounded-lg bg-surface-card border border-border/60 p-2">
            <span className="text-[10px] text-ink-muted">주간 도달</span>
            <span className="text-body-sm font-bold text-ink">12.4K</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-surface-card border border-border/60 p-2">
            <span className="text-[10px] text-ink-muted">게시물 저장</span>
            <span className="text-body-sm font-bold text-ink">842회</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg bg-surface-card border border-border/60 p-2">
            <span className="text-[10px] text-ink-muted">공유</span>
            <span className="text-body-sm font-bold text-ink">318회</span>
          </div>
        </div>

        {/* 성과 기반 다음 화 제안 */}
        <div className="flex flex-col gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <div className="flex items-center gap-1.5 text-caption font-bold text-amber-700">
            <Sparkles className="size-3.5 text-amber-500" />
            <span>성과 기반 추천 소재</span>
          </div>
          <p className="text-[11px] text-amber-900 leading-relaxed">
            저장율이 높았던 ‘직장 대화 갈등’을 주제로 다음 화를 이어가면 도달률이 +28% 상승할 것으로 예측돼요.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1 text-[11px] text-ink-muted hover:text-danger cursor-pointer transition-colors"
          >
            <Unlink className="size-3" />
            <span>연결 해제</span>
          </button>
          <span className="text-[10px] text-ink-subtle">10분 전 자동 동기화</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full shrink-0 flex-col gap-3 rounded-xl border border-dashed border-border-control p-5 lg:w-80">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
            <InstagramIcon className="size-4" />
          </div>
          <h2 className="text-title font-semibold">인스타그램 성과</h2>
        </div>

        <p className="text-body-sm text-ink-muted leading-relaxed">
          인스타그램 크리에이터 계정을 연결하면 회차별 도달·저장·공유 반응을 자동으로 수집하고, 독자 반응이 좋은 다음 화 소재를 추천해 드려요.
        </p>

        <div className="flex-1" />

        <Button
          variant="secondary"
          block
          onClick={() => {
            setInputUsername("");
            setOpenModal(true);
          }}
          className="gap-2 font-bold shadow-2xs hover:border-pink-500 hover:text-pink-600 transition-colors"
        >
          <InstagramIcon className="size-4 text-pink-500" />
          <span>인스타그램 계정 연결</span>
        </Button>
      </div>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="인스타그램 계정 연결"
        description="Sharktoon과 인스타그램 비즈니스/크리에이터 계정을 연동합니다."
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenModal(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              loading={connecting}
              onClick={handleConnect}
              className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white font-bold"
            >
              Instagram으로 계속하기
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface-sunken/40 p-4">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white">
              <InstagramIcon className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-body font-bold text-ink">Instagram Graph API 연동</span>
              <span className="text-caption text-ink-muted">
                피드 발행, 게시물 인사이트(도달·저장·공유) 읽기 권한
              </span>
            </div>
          </div>

          <Field
            label="인스타그램 아이디 (@사용자명)"
            value={inputUsername}
            onChange={setInputUsername}
            placeholder="예: my_toon_official (미입력 시 기본 계정으로 테스트)"
            help="비즈니스 또는 크리에이터 계정만 인사이트 조회가 가능합니다."
          />

          <div className="rounded-lg bg-surface-sunken p-3 text-caption text-ink-muted space-y-1">
            <p className="font-semibold text-ink">연동 시 제공되는 기능:</p>
            <p>• 완성된 4~10컷 만화 인스타그램 캐러셀 1-Click 피드 자동 발행</p>
            <p>• 컷별 독자 반응 및 이탈률, 저장 수 분석 대시보드</p>
            <p>• 고성과 에피소드 기반 다음 화 콘티 자동 추천</p>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default InstagramIntegrationCard;

