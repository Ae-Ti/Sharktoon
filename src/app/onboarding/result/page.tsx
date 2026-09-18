import { Badge, Button, ButtonLink } from "@/components/ui";

const CUTS = [
  { no: 1, role: "후킹" },
  { no: 2, role: "전개" },
  { no: 3, role: "전개" },
  { no: 4, role: "전환" },
  { no: 5, role: "감정" },
  { no: 6, role: "CTA" },
];

export default function Page() {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-display font-bold tracking-[-0.015em]">
          첫 화가 완성됐어요
        </h1>
        <p className="text-body-sm text-ink-muted">
          인스타 캐러셀 순서 그대로예요. 컷을 눌러 고칠 수 있어요.
        </p>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {CUTS.map((c) => (
          <a
            key={c.no}
            href={`/episodes/ep_001/editor?cut=${c.no}`}
            className="flex w-44 shrink-0 flex-col gap-1.5"
          >
            <span className="grid h-55 place-items-center rounded-lg border border-border bg-skeleton text-caption text-ink-subtle">
              {c.no}컷 · {c.role}
            </span>
            <span className="text-caption text-ink-muted">
              {c.no} / {CUTS.length}
            </span>
          </a>
        ))}
      </div>

      {/* AI 라벨은 이미지 위에 얹지 않고 바로 아래 메타 줄에 둔다. 작품을 가리지 않기 위해서다. */}
      <div>
        <Badge tone="ai">AI 생성</Badge>
      </div>

      <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface-card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-label font-semibold">시리즈로 이어갈까요?</span>
          <Badge tone="brand">추천</Badge>
        </div>
        <p className="text-body-sm text-ink-muted">
          같은 캐릭터와 그림체를 저장해 두면 2화부터는 사연만 적으면 돼요.
        </p>
        <Button variant="secondary" block>
          시리즈 만들기
        </Button>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2">
        <ButtonLink href="/episodes/ep_001/editor" size="lg" block>
          게시 준비하기
        </ButtonLink>
        <ButtonLink href="/home" variant="ghost" block>
          나중에 할래요
        </ButtonLink>
      </div>
    </>
  );
}
