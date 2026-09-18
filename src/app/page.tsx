import Link from "next/link";

export default function Page() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-[40px] leading-none font-extrabold tracking-[-0.04em]">
          샥툰
        </h1>
        <p className="text-body text-ink-muted">사연 한 줄로, 오늘 저녁 첫 인스타툰</p>
      </div>
      <p className="text-body-sm text-ink-muted">
        아직 화면이 붙지 않았습니다. 온보딩은 <code className="font-mono">src/features/platform</code>,
        생성·편집은 <code className="font-mono">src/features/generation</code> 아래에 만듭니다.
      </p>
      <Link
        href="/design"
        className="inline-flex h-control-md w-fit items-center rounded-md bg-brand px-5 text-label font-semibold text-on-brand"
      >
        공통 컴포넌트 보기
      </Link>
    </main>
  );
}
