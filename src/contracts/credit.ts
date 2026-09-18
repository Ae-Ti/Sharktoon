/**
 * 크레딧 원장 계약 — 오너: 태일(B).
 *
 * 생성은 실패할 수 있고(목표 실패율 3% 이하, 0% 아님) 실패하면 크레딧을 자동 환불해야 한다.
 * 그래서 단순 차감이 아니라 hold → commit / refund 3단으로 간다.
 * 생성 요청 직전에 hold, 성공하면 commit, 실패하면 refund 한다.
 * 이 구조가 아니면 "차감했는데 생성이 죽은" 구간에서 원장이 틀어진다.
 */

/** 이미지 1컷 1크레딧, 부분 재생성 0.5크레딧, 애니메이션 1화 5크레딧. */
export const CREDIT_COST = {
  cutImage: 1,
  partialRegenerate: 0.5,
  animationEpisode: 5,
} as const;

/** 스토리와 캡션 생성은 크레딧을 쓰지 않는다. */
export type CreditSpendReason =
  | "cut_image"
  | "partial_regenerate"
  | "animation_episode";

export type CreditEarnReason =
  | "signup_bonus"
  | "attendance_daily"
  | "attendance_streak"
  | "subscription_grant"
  | "credit_pack"
  | "generation_refund";

export type HoldId = string & { readonly __brand: "HoldId" };

export interface CreditHold {
  id: HoldId;
  userId: string;
  amount: number;
  reason: CreditSpendReason;
  /** 이 hold 를 만든 생성 잡. 환불 추적의 키. */
  jobId: string;
  createdAt: string;
  status: "held" | "committed" | "refunded";
}

export interface CreditBalance {
  /** 쓸 수 있는 잔량. hold 중인 금액은 빠져 있다. */
  available: number;
  held: number;
  /** 미사용분은 다음 달에 50%만 이월된다. */
  expiresAt: string | null;
}

export interface CreditLedger {
  getBalance(userId: string): Promise<CreditBalance>;

  /**
   * 생성 요청 직전에 부른다. 잔량이 모자라면 InsufficientCreditError 를 던진다.
   * 버튼을 disabled 로 막는 대신 여기서 막고 충전 시트를 연다.
   */
  hold(input: {
    userId: string;
    amount: number;
    reason: CreditSpendReason;
    jobId: string;
  }): Promise<HoldId>;

  /** 생성이 성공했을 때. 실제 차감이 확정된다. */
  commit(holdId: HoldId): Promise<void>;

  /** 생성이 실패했을 때. 자동 환불이고, 사용자에게 보이게 알린다. */
  refund(holdId: HoldId, reason: string): Promise<void>;

  /** 출석·가입 보너스·구독 지급·크레딧 팩. */
  grant(input: {
    userId: string;
    amount: number;
    reason: CreditEarnReason;
  }): Promise<CreditBalance>;
}

/**
 * Postgres 함수가 돌려주는 SQLSTATE. supabase/README.md 와 같이 본다.
 * 이 코드로 분기하고, 메시지 문자열로 분기하지 않는다.
 */
export const CREDIT_SQLSTATE = {
  insufficient: "SK001",
  holdAlreadyResolved: "SK002",
  alreadyCheckedInToday: "SK003",
} as const;

export class InsufficientCreditError extends Error {
  constructor(
    readonly required: number,
    readonly available: number,
  ) {
    super(`크레딧이 부족해요. 필요: ${required}, 남음: ${available}`);
    this.name = "InsufficientCreditError";
  }
}
