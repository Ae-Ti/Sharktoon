"use client";

import { useState } from "react";
import { CreditSheet } from "@/features/platform/components/CreditSheet";
import {
  AssetCard,
  Badge,
  Button,
  ChoiceCard,
  CreditPill,
  CutProgressGrid,
  EmptyState,
  Field,
  Modal,
  LayerRow,
  StepProgress,
  Tabs,
} from "@/components/ui";

const STEPS = ["로그인", "캐릭터 만들기", "사연 입력", "첫 화 결과"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface-card p-6">
      <h2 className="text-title font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  const [choice, setChoice] = useState(0);
  const [tab, setTab] = useState(0);
  const [story, setStory] = useState("");
  const [hidden, setHidden] = useState<Record<number, boolean>>({});
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-display font-bold tracking-[-0.015em]">공통 컴포넌트</h1>
        <p className="text-body-sm text-ink-muted">
          디자인 시스템의 참조 구현을 Next.js + Tailwind 로 옮긴 것이다. 사용 규칙은 디자인 시스템
          페이지에, props 는 각 파일의 타입에 있다.
        </p>
      </header>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="lg" cost={6}>첫 화 만들기</Button>
          <Button variant="secondary">건너뛰기</Button>
          <Button variant="ghost">예시 사연 쓰기</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button loading>생성 중</Button>
          <Button variant="secondary" size="sm" cost={0.5}>이 부분만 다시</Button>
          <Button variant="danger" size="sm">시리즈 삭제</Button>
          <Button disabled>크레딧 부족</Button>
        </div>
      </Section>

      <Section title="Badge · CreditPill">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="ai">AI 생성</Badge>
          <Badge tone="success" dot>생성 완료</Badge>
          <Badge tone="brand" dot>생성 중</Badge>
          <Badge tone="danger" dot>실패</Badge>
          <Badge tone="warning">크레딧 부족</Badge>
          <Badge>초안</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <CreditPill balance={8} />
          <CreditPill balance={11} delta={3} />
          <CreditPill balance={2} />
          <CreditPill balance={194} delta={-6} />
        </div>
      </Section>

      <Section title="StepProgress">
        <StepProgress steps={STEPS} current={1} partial={60} />
      </Section>

      <Section title="ChoiceCard">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { t: "셀카로 만들기", d: "사진 1장이면 돼요. 원본은 시트를 만든 뒤 지워요." },
            { t: "특징 태그로 만들기", d: "안경, 곱슬머리처럼 5개까지." },
            { t: "기본 캐릭터 쓰기", d: "지금 정하지 않고 첫 화부터 볼래요." },
          ].map((it, i) => (
            <ChoiceCard
              key={it.t}
              title={it.t}
              description={it.d}
              selected={choice === i}
              onClick={() => setChoice(i)}
            />
          ))}
        </div>
      </Section>

      <Section title="Field">
        <Field
          label="사연 한 줄"
          multiline
          rows={2}
          value={story}
          onChange={setStory}
          placeholder="어제 부장님이 회의 중에 한 말 때문에..."
          help="한 줄만 적어도 6컷 콘티를 만들어 드려요."
          maxLength={300}
        />
        <Field
          label="캐릭터 특징 태그"
          defaultValue="안경, 곱슬머리, 후드티, 무표정, 커피, 노트북"
          error="태그는 5개까지만 넣을 수 있어요."
        />
      </Section>

      <Section title="Tabs">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { label: "캐릭터", count: 3 },
            { label: "장소", count: 5 },
            { label: "소품", count: 12 },
            { label: "스타일", count: 2 },
          ]}
        />
      </Section>

      <Section title="CutProgressGrid">
        <CutProgressGrid
          title="2화 이미지 생성 중"
          cuts={[
            { status: "done" },
            { status: "done" },
            { status: "failed" },
            { status: "running", progress: 65 },
            { status: "queued" },
            { status: "queued" },
          ]}
        />
      </Section>

      <Section title="AssetCard">
        <div className="grid gap-4 sm:grid-cols-3">
          <AssetCard name="나 (기본)" kind="캐릭터" kindTone="brand" usedIn={4} thumb="캐릭터 시트" />
          <AssetCard name="회사 탕비실" kind="장소" usedIn={3} />
          <AssetCard name="파스텔 · 굵은 선" kind="스타일" usedIn={4} thumb="프리셋" />
        </div>
      </Section>

      <Section title="LayerRow">
        <div role="listbox" aria-label="레이어" className="max-w-xs">
          {[
            { name: '효과음 "쾅"', kindShort: "효과", vector: true },
            { name: "말풍선 · 외침", kindShort: "말풍", vector: true, selected: true },
            { name: "나레이션 박스", kindShort: "나레", vector: true },
            { name: "캐릭터 · 나", kindShort: "캐릭" },
            { name: "배경 · 탕비실", kindShort: "배경" },
          ].map((r, i) => (
            <LayerRow
              key={r.name}
              {...r}
              hidden={hidden[i]}
              onToggle={() => setHidden((h) => ({ ...h, [i]: !h[i] }))}
            />
          ))}
        </div>
      </Section>

      <Section title="Modal · CreditSheet">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setModal(true)}>
            확인 모달 열기
          </Button>
          <Button variant="secondary" onClick={() => setSheet(true)}>
            크레딧 부족 시트 열기
          </Button>
        </div>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="이 시리즈를 지울까요?"
          description="회차와 생성한 컷이 모두 사라져요. 되돌릴 수 없어요."
          footer={
            <>
              <Button variant="secondary" onClick={() => setModal(false)}>
                그대로 둘게요
              </Button>
              <Button variant="danger" onClick={() => setModal(false)}>
                삭제
              </Button>
            </>
          }
        />
        <CreditSheet
          open={sheet}
          onClose={() => setSheet(false)}
          required={6}
          available={2}
          canCheckIn
          onCheckIn={() => setSheet(false)}
          onOpenPlans={() => setSheet(false)}
        />
      </Section>

      <Section title="EmptyState">
        <EmptyState
          title="아직 등록한 에셋이 없어요"
          description="캐릭터를 하나 만들어 두면 다음 화부터 같은 얼굴로 그려져요."
          actionLabel="캐릭터 만들기"
        />
      </Section>
    </main>
  );
}
