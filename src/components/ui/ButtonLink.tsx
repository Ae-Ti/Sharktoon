import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  BUTTON_COST,
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from "./buttonStyles";

export interface ButtonLinkProps
  extends Omit<ComponentProps<typeof Link>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** 이 이동이 쓰는 크레딧. 값이 있으면 "N크레딧"이 붙는다. */
  cost?: number;
  children?: ReactNode;
}

/**
 * 버튼처럼 보이지만 이동하는 것. 화면 이동은 <a> 여야 새 탭·뒤로가기가 동작하고
 * 스크린리더가 링크로 읽는다. <a> 안에 <button> 을 넣으면 클릭이 삼켜진다.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  block,
  cost,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...rest}>
      <span>{children}</span>
      {cost != null && (
        <span
          className={cn(
            "inline-flex h-[18px] items-center rounded-sm px-1 text-[11px] font-semibold",
            BUTTON_COST[variant],
          )}
        >
          {cost}크레딧
        </span>
      )}
    </Link>
  );
}
