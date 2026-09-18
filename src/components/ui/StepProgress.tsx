export interface StepProgressProps {
  steps: string[];
  /** 0부터 센다. */
  current: number;
  /** 현재 단계 안의 진행률(%). 기본 40. */
  partial?: number;
}

export function StepProgress({ steps, current, partial = 40 }: StepProgressProps) {
  return (
    <div role="group" aria-label="온보딩 진행" className="flex w-full flex-col gap-2">
      <div className="flex gap-1">
        {steps.map((label, i) => (
          <span
            key={label}
            className="h-1 flex-1 overflow-hidden rounded-full bg-surface-sunken"
          >
            <span
              className="block h-full rounded-full bg-brand"
              style={{ width: `${i < current ? 100 : i === current ? partial : 0}%` }}
            />
          </span>
        ))}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-label font-semibold">{steps[current]}</span>
        <span className="text-caption tabular-nums text-ink-muted">
          {current + 1} / {steps.length}
        </span>
      </div>
    </div>
  );
}
