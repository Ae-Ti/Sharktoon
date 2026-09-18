"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface FieldProps {
  label: string;
  id?: string;
  /** 지시문이 아니라 실제로 쓸 법한 예시 문장 한 토막을 넣는다. */
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** 제약은 미리 알린다. */
  help?: string;
  /** 있으면 help 를 대체하고 danger 톤이 된다. */
  error?: string;
  optional?: boolean;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
}

export function Field({
  label,
  id,
  placeholder,
  value,
  defaultValue,
  onChange,
  help,
  error,
  optional,
  multiline,
  rows = 3,
  maxLength,
}: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helpId = `${fieldId}-help`;
  const invalid = Boolean(error);

  const controlClass = cn(
    "w-full min-h-control-md rounded-md border bg-surface-card p-3",
    "text-body text-ink placeholder:text-ink-subtle",
    "focus:outline-2 focus:-outline-offset-1 focus:outline-brand",
    invalid ? "border-danger" : "border-border-control focus:border-brand",
  );

  const shared = {
    id: fieldId,
    placeholder,
    value,
    defaultValue,
    maxLength,
    "aria-invalid": invalid || undefined,
    "aria-describedby": error || help ? helpId : undefined,
    onChange: (e: { target: { value: string } }) => onChange?.(e.target.value),
    className: controlClass,
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={fieldId} className="text-label font-semibold text-ink">
          {label}
        </label>
        {optional && (
          <span className="text-caption font-medium text-ink-muted">선택</span>
        )}
      </div>

      {multiline ? (
        <textarea rows={rows} {...shared} />
      ) : (
        <input type="text" {...shared} />
      )}

      {(error || help) && (
        <div className="flex items-baseline justify-between gap-2">
          <p
            id={helpId}
            className={cn(
              "text-body-sm",
              invalid ? "text-danger" : "text-ink-muted",
            )}
          >
            {error ?? help}
          </p>
          {maxLength != null && (
            <span className="text-caption tabular-nums text-ink-muted">
              {(value ?? defaultValue ?? "").length} / {maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
