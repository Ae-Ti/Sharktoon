/**
 * supabase/migrations 에서 손으로 뽑은 타입.
 *
 * Supabase 프로젝트가 생기면 `supabase gen types typescript` 로 대체한다.
 * 그때까지는 마이그레이션이 원본이므로 스키마를 고치면 여기도 같이 고친다.
 */

export type AssetKind = "character" | "location" | "prop" | "style";

export type EpisodeStatus =
  | "draft"
  | "storyboard"
  | "generating"
  | "ready"
  | "published";

export type PlanTier = "free" | "basic" | "pro";

export type CreditSpendReasonDb =
  | "cut_image"
  | "partial_regenerate"
  | "animation_episode";

export type CreditEarnReasonDb =
  | "signup_bonus"
  | "attendance_daily"
  | "attendance_streak"
  | "subscription_grant"
  | "credit_pack"
  | "generation_refund"
  | "monthly_rollover";

export type CreditHoldStatus = "held" | "committed" | "refunded";

// supabase-js 제네릭이 요구하는 모양. Relationships 가 없으면 타입이 never 로 무너진다.
type Row<T> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Views: Record<string, never>;
    Enums: {
      asset_kind: AssetKind;
      episode_status: EpisodeStatus;
      plan_tier: PlanTier;
      credit_spend_reason: CreditSpendReasonDb;
      credit_earn_reason: CreditEarnReasonDb;
      credit_hold_status: CreditHoldStatus;
    };
    CompositeTypes: Record<string, never>;
    Tables: {
      profiles: Row<{
        id: string;
        handle: string | null;
        display_name: string | null;
        avatar_url: string | null;
        plan: PlanTier;
        keep_selfie_original: boolean;
        is_admin: boolean;
        created_at: string;
        updated_at: string;
      }>;
      credit_accounts: Row<{
        user_id: string;
        balance: number;
        held: number;
        updated_at: string;
      }>;
      credit_holds: Row<{
        id: string;
        user_id: string;
        amount: number;
        reason: CreditSpendReasonDb;
        job_id: string;
        status: CreditHoldStatus;
        created_at: string;
        resolved_at: string | null;
      }>;
      credit_transactions: Row<{
        id: number;
        user_id: string;
        amount: number;
        spend_reason: CreditSpendReasonDb | null;
        earn_reason: CreditEarnReasonDb | null;
        hold_id: string | null;
        balance_after: number;
        created_at: string;
      }>;
      attendance: Row<{
        user_id: string;
        attended_on: string;
        streak: number;
        created_at: string;
      }>;
      series: Row<{
        id: string;
        owner_id: string;
        title: string;
        description: string | null;
        cover_path: string | null;
        is_public: boolean;
        created_at: string;
        updated_at: string;
      }>;
      series_rules: Row<{
        series_id: string;
        style_preset: string;
        default_cut_count: number;
        aspect_ratio: "1:1" | "4:5";
        tone: string | null;
        narration_style: Record<string, unknown>;
        fixed_hashtags: string[];
        updated_at: string;
      }>;
      assets: Row<{
        id: string;
        owner_id: string;
        kind: AssetKind;
        name: string;
        description: string | null;
        tags: string[];
        reference_paths: string[];
        created_at: string;
        updated_at: string;
      }>;
      series_assets: Row<{ series_id: string; asset_id: string }>;
      episodes: Row<{
        id: string;
        series_id: string;
        owner_id: string;
        number: number;
        title: string | null;
        story: string | null;
        status: EpisodeStatus;
        cut_count: number;
        note: string | null;
        published_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      asset_references: Row<{ episode_id: string; asset_id: string }>;
    };
    Functions: {
      credit_hold: {
        Args: { p_amount: number; p_reason: CreditSpendReasonDb; p_job_id: string };
        Returns: string;
      };
      credit_commit: { Args: { p_hold_id: string }; Returns: void };
      credit_refund: {
        Args: { p_hold_id: string; p_reason?: string };
        Returns: number;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      admin_funnel: {
        Args: Record<string, never>;
        Returns: { step: string; users: number }[];
      };
      admin_generation_stats: {
        Args: Record<string, never>;
        Returns: {
          holds: number;
          refunded: number;
          spent: number;
          refunded_amount: number;
          granted: number;
        }[];
      };
      admin_recent_refunds: {
        Args: { p_limit?: number };
        Returns: {
          id: number;
          user_id: string;
          amount: number;
          created_at: string;
        }[];
      };
      attendance_check_in: {
        Args: Record<string, never>;
        Returns: { streak: number; granted: number; balance: number }[];
      };
    };
  };
}
