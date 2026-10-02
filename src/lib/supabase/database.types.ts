/**
 * DB 타입. 원본은 `supabase gen types` 가 뽑은 `database.generated.ts` 다.
 *
 * 스키마를 고치면 로컬 Supabase 에 마이그레이션을 적용하고 `npm run db:types` 로
 * 다시 뽑는다. 손으로 고치지 않는다. 화면이 쓰는 열거형 별칭만 여기서 꺼내 준다.
 */

import type { Database, Enums } from "./database.generated";

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database.generated";

export type AssetKind = Enums<"asset_kind">;
export type EpisodeStatus = Enums<"episode_status">;
export type PlanTier = Enums<"plan_tier">;
export type CreditSpendReasonDb = Enums<"credit_spend_reason">;
export type CreditEarnReasonDb = Enums<"credit_earn_reason">;
export type CreditHoldStatus = Enums<"credit_hold_status">;
export type GenerationJobStatusDb = Enums<"generation_job_status">;

export type PublicSchema = Database["public"];
