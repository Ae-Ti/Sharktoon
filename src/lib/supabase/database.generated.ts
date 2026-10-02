export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      asset_references: {
        Row: {
          asset_id: string
          episode_id: string
        }
        Insert: {
          asset_id: string
          episode_id: string
        }
        Update: {
          asset_id?: string
          episode_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_references_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_references_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["asset_kind"]
          name: string
          owner_id: string
          reference_paths: string[]
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["asset_kind"]
          name: string
          owner_id: string
          reference_paths?: string[]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["asset_kind"]
          name?: string
          owner_id?: string
          reference_paths?: string[]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attended_on: string
          created_at: string
          streak: number
          user_id: string
        }
        Insert: {
          attended_on: string
          created_at?: string
          streak: number
          user_id: string
        }
        Update: {
          attended_on?: string
          created_at?: string
          streak?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_accounts: {
        Row: {
          balance: number
          held: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          held?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          held?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_hold_lots: {
        Row: {
          amount: number
          hold_id: string
          lot_id: string
        }
        Insert: {
          amount: number
          hold_id: string
          lot_id: string
        }
        Update: {
          amount?: number
          hold_id?: string
          lot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_hold_lots_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "credit_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_hold_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "credit_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_holds: {
        Row: {
          amount: number
          created_at: string
          id: string
          job_id: string
          reason: Database["public"]["Enums"]["credit_spend_reason"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["credit_hold_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          job_id: string
          reason: Database["public"]["Enums"]["credit_spend_reason"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["credit_hold_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          job_id?: string
          reason?: Database["public"]["Enums"]["credit_spend_reason"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["credit_hold_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_holds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_lots: {
        Row: {
          amount: number
          created_at: string
          earn_reason: Database["public"]["Enums"]["credit_earn_reason"]
          expires_at: string | null
          id: string
          is_rollover: boolean
          kind: Database["public"]["Enums"]["credit_lot_kind"]
          payment_id: string | null
          remaining: number
          unit_price: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          earn_reason: Database["public"]["Enums"]["credit_earn_reason"]
          expires_at?: string | null
          id?: string
          is_rollover?: boolean
          kind: Database["public"]["Enums"]["credit_lot_kind"]
          payment_id?: string | null
          remaining: number
          unit_price?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          earn_reason?: Database["public"]["Enums"]["credit_earn_reason"]
          expires_at?: string | null
          id?: string
          is_rollover?: boolean
          kind?: Database["public"]["Enums"]["credit_lot_kind"]
          payment_id?: string | null
          remaining?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_lots_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_lots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_policy: {
        Row: {
          attendance_daily: number
          attendance_monthly_cap: number
          attendance_streak_bonus: number
          attendance_streak_days: number
          free_credit_days: number
          id: boolean
          purchase_credit_years: number
          refund_fee_rate: number
          signup_bonus: number
          updated_at: string
        }
        Insert: {
          attendance_daily?: number
          attendance_monthly_cap?: number
          attendance_streak_bonus?: number
          attendance_streak_days?: number
          free_credit_days?: number
          id?: boolean
          purchase_credit_years?: number
          refund_fee_rate?: number
          signup_bonus?: number
          updated_at?: string
        }
        Update: {
          attendance_daily?: number
          attendance_monthly_cap?: number
          attendance_streak_bonus?: number
          attendance_streak_days?: number
          free_credit_days?: number
          id?: boolean
          purchase_credit_years?: number
          refund_fee_rate?: number
          signup_bonus?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          earn_reason: Database["public"]["Enums"]["credit_earn_reason"] | null
          hold_id: string | null
          id: number
          spend_reason:
            | Database["public"]["Enums"]["credit_spend_reason"]
            | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          earn_reason?: Database["public"]["Enums"]["credit_earn_reason"] | null
          hold_id?: string | null
          id?: never
          spend_reason?:
            | Database["public"]["Enums"]["credit_spend_reason"]
            | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          earn_reason?: Database["public"]["Enums"]["credit_earn_reason"] | null
          hold_id?: string | null
          id?: never
          spend_reason?:
            | Database["public"]["Enums"]["credit_spend_reason"]
            | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "credit_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cuts: {
        Row: {
          created_at: string
          cut_id: string
          episode_id: string
          generation_meta: Json
          image_path: string | null
          index: number
          layer_tree: Json | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cut_id: string
          episode_id: string
          generation_meta?: Json
          image_path?: string | null
          index: number
          layer_tree?: Json | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cut_id?: string
          episode_id?: string
          generation_meta?: Json
          image_path?: string | null
          index?: number
          layer_tree?: Json | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuts_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          created_at: string
          cut_count: number
          id: string
          note: string | null
          number: number
          owner_id: string
          published_at: string | null
          series_id: string
          status: Database["public"]["Enums"]["episode_status"]
          story: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cut_count?: number
          id?: string
          note?: string | null
          number: number
          owner_id: string
          published_at?: string | null
          series_id: string
          status?: Database["public"]["Enums"]["episode_status"]
          story?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cut_count?: number
          id?: string
          note?: string | null
          number?: number
          owner_id?: string
          published_at?: string | null
          series_id?: string
          status?: Database["public"]["Enums"]["episode_status"]
          story?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          context: Json
          created_at: string
          episode_id: string
          finished_at: string | null
          id: string
          mode: string
          owner_id: string
          status: Database["public"]["Enums"]["generation_job_status"]
          updated_at: string
        }
        Insert: {
          context?: Json
          created_at?: string
          episode_id: string
          finished_at?: string | null
          id: string
          mode: string
          owner_id: string
          status?: Database["public"]["Enums"]["generation_job_status"]
          updated_at?: string
        }
        Update: {
          context?: Json
          created_at?: string
          episode_id?: string
          finished_at?: string | null
          id?: string
          mode?: string
          owner_id?: string
          status?: Database["public"]["Enums"]["generation_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_tasks: {
        Row: {
          attempt: number
          created_at: string
          cut_id: string
          episode_id: string
          error: string | null
          finished_at: string | null
          hold_id: string | null
          id: number
          image_ref: string | null
          index: number
          intent: string
          job_id: string
          lease_until: string | null
          owner_id: string
          prompt: string
          refunded: boolean
          started_at: string | null
          status: Database["public"]["Enums"]["generation_task_status"]
        }
        Insert: {
          attempt?: number
          created_at?: string
          cut_id: string
          episode_id: string
          error?: string | null
          finished_at?: string | null
          hold_id?: string | null
          id?: never
          image_ref?: string | null
          index: number
          intent?: string
          job_id: string
          lease_until?: string | null
          owner_id: string
          prompt: string
          refunded?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["generation_task_status"]
        }
        Update: {
          attempt?: number
          created_at?: string
          cut_id?: string
          episode_id?: string
          error?: string | null
          finished_at?: string | null
          hold_id?: string | null
          id?: never
          image_ref?: string | null
          index?: number
          intent?: string
          job_id?: string
          lease_until?: string | null
          owner_id?: string
          prompt?: string
          refunded?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["generation_task_status"]
        }
        Relationships: [
          {
            foreignKeyName: "generation_tasks_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_tasks_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "credit_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_krw: number
          created_at: string
          id: string
          note: string | null
          paid_at: string
          product: string
          provider: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount_krw: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          product: string
          provider: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount_krw?: number
          created_at?: string
          id?: string
          note?: string | null
          paid_at?: string
          product?: string
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_packages: {
        Row: {
          captions: Json
          created_at: string
          episode_id: string
          first_comment: string
          hashtags: Json
          owner_id: string
          updated_at: string
          used_mock: boolean
        }
        Insert: {
          captions: Json
          created_at?: string
          episode_id: string
          first_comment: string
          hashtags: Json
          owner_id: string
          updated_at?: string
          used_mock?: boolean
        }
        Update: {
          captions?: Json
          created_at?: string
          episode_id?: string
          first_comment?: string
          hashtags?: Json
          owner_id?: string
          updated_at?: string
          used_mock?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "post_packages_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: true
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_packages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deletion_requested_at: string | null
          display_name: string | null
          handle: string | null
          id: string
          is_admin: boolean
          keep_selfie_original: boolean
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          handle?: string | null
          id: string
          is_admin?: boolean
          keep_selfie_original?: boolean
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string
          is_admin?: boolean
          keep_selfie_original?: boolean
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      refund_requests: {
        Row: {
          created_at: string
          credits: number
          fee_krw: number
          gross_krw: number
          id: string
          net_krw: number
          note: string | null
          processed_at: string | null
          reason: string | null
          status: Database["public"]["Enums"]["refund_request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          credits: number
          fee_krw: number
          gross_krw: number
          id?: string
          net_krw: number
          note?: string | null
          processed_at?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          fee_krw?: number
          gross_krw?: number
          id?: string
          net_krw?: number
          note?: string | null
          processed_at?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          cover_path: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          owner_id: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      series_assets: {
        Row: {
          asset_id: string
          series_id: string
        }
        Insert: {
          asset_id: string
          series_id: string
        }
        Update: {
          asset_id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_assets_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series_rules: {
        Row: {
          aspect_ratio: string
          default_cut_count: number
          fixed_hashtags: string[]
          narration_style: Json
          series_id: string
          style_preset: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          aspect_ratio?: string
          default_cut_count?: number
          fixed_hashtags?: string[]
          narration_style?: Json
          series_id: string
          style_preset?: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          aspect_ratio?: string
          default_cut_count?: number
          fixed_hashtags?: string[]
          narration_style?: Json
          series_id?: string
          style_preset?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "series_rules_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: true
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      storyboards: {
        Row: {
          created_at: string
          data: Json
          episode_id: string
          owner_id: string
          updated_at: string
          used_mock: boolean
        }
        Insert: {
          created_at?: string
          data: Json
          episode_id: string
          owner_id: string
          updated_at?: string
          used_mock?: boolean
        }
        Update: {
          created_at?: string
          data?: Json
          episode_id?: string
          owner_id?: string
          updated_at?: string
          used_mock?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "storyboards_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: true
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storyboards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _credit_add_lot: {
        Args: {
          p_amount: number
          p_expires_at: string
          p_is_rollover?: boolean
          p_kind: Database["public"]["Enums"]["credit_lot_kind"]
          p_payment_id?: string
          p_reason: Database["public"]["Enums"]["credit_earn_reason"]
          p_unit_price: number
          p_user: string
        }
        Returns: number
      }
      _credit_expire_user: { Args: { p_user: string }; Returns: number }
      admin_funnel: {
        Args: never
        Returns: {
          step: string
          users: number
        }[]
      }
      admin_generation_stats: {
        Args: never
        Returns: {
          granted: number
          holds: number
          refunded: number
          refunded_amount: number
          spent: number
        }[]
      }
      admin_grant_purchase: {
        Args: {
          p_amount_krw: number
          p_credits: number
          p_note?: string
          p_user_id: string
        }
        Returns: number
      }
      admin_list_refund_requests: {
        Args: never
        Returns: {
          created_at: string
          credits: number
          fee_krw: number
          id: string
          net_krw: number
          reason: string
          status: Database["public"]["Enums"]["refund_request_status"]
          user_id: string
        }[]
      }
      admin_process_refund: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: undefined
      }
      admin_recent_refunds: {
        Args: { p_limit?: number }
        Returns: {
          amount: number
          created_at: string
          id: number
          user_id: string
        }[]
      }
      attendance_check_in: {
        Args: never
        Returns: {
          balance: number
          granted: number
          streak: number
        }[]
      }
      cancel_account_deletion: { Args: never; Returns: undefined }
      claim_generation_tasks: {
        Args: { p_lease_seconds?: number; p_limit?: number; p_per_job?: number }
        Returns: {
          attempt: number
          created_at: string
          cut_id: string
          episode_id: string
          error: string | null
          finished_at: string | null
          hold_id: string | null
          id: number
          image_ref: string | null
          index: number
          intent: string
          job_id: string
          lease_until: string | null
          owner_id: string
          prompt: string
          refunded: boolean
          started_at: string | null
          status: Database["public"]["Enums"]["generation_task_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "generation_tasks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      credit_commit: { Args: { p_hold_id: string }; Returns: undefined }
      credit_expire_all: { Args: never; Returns: number }
      credit_grant: {
        Args: {
          p_amount: number
          p_expires_at?: string
          p_kind: Database["public"]["Enums"]["credit_lot_kind"]
          p_payment_id?: string
          p_reason: Database["public"]["Enums"]["credit_earn_reason"]
          p_unit_price: number
          p_user_id: string
        }
        Returns: number
      }
      credit_hold: {
        Args: {
          p_amount: number
          p_job_id: string
          p_reason: Database["public"]["Enums"]["credit_spend_reason"]
          p_user_id: string
        }
        Returns: string
      }
      credit_refund: {
        Args: { p_hold_id: string; p_reason?: string }
        Returns: number
      }
      credit_refund_quote: {
        Args: never
        Returns: {
          credits: number
          fee_krw: number
          gross_krw: number
          net_krw: number
        }[]
      }
      credit_start_subscription_period: {
        Args: {
          p_amount: number
          p_payment_id: string
          p_period_end: string
          p_unit_price: number
          p_user_id: string
        }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      request_account_deletion: { Args: never; Returns: string }
      request_credit_refund: { Args: { p_reason?: string }; Returns: string }
    }
    Enums: {
      asset_kind: "character" | "location" | "prop" | "style"
      credit_earn_reason:
        | "signup_bonus"
        | "attendance_daily"
        | "attendance_streak"
        | "subscription_grant"
        | "credit_pack"
        | "generation_refund"
        | "monthly_rollover"
      credit_hold_status: "held" | "committed" | "refunded"
      credit_lot_kind: "free" | "subscription" | "purchase"
      credit_spend_reason:
        | "cut_image"
        | "partial_regenerate"
        | "animation_episode"
        | "expiry"
        | "refund_payout"
      episode_status:
        | "draft"
        | "storyboard"
        | "generating"
        | "ready"
        | "published"
      generation_job_status:
        | "queued"
        | "running"
        | "succeeded"
        | "partially_failed"
        | "failed"
      generation_task_status: "queued" | "running" | "done" | "failed"
      payment_status: "paid" | "cancelled" | "refunded" | "partially_refunded"
      plan_tier: "free" | "basic" | "pro"
      refund_request_status: "requested" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      asset_kind: ["character", "location", "prop", "style"],
      credit_earn_reason: [
        "signup_bonus",
        "attendance_daily",
        "attendance_streak",
        "subscription_grant",
        "credit_pack",
        "generation_refund",
        "monthly_rollover",
      ],
      credit_hold_status: ["held", "committed", "refunded"],
      credit_lot_kind: ["free", "subscription", "purchase"],
      credit_spend_reason: [
        "cut_image",
        "partial_regenerate",
        "animation_episode",
        "expiry",
        "refund_payout",
      ],
      episode_status: [
        "draft",
        "storyboard",
        "generating",
        "ready",
        "published",
      ],
      generation_job_status: [
        "queued",
        "running",
        "succeeded",
        "partially_failed",
        "failed",
      ],
      generation_task_status: ["queued", "running", "done", "failed"],
      payment_status: ["paid", "cancelled", "refunded", "partially_refunded"],
      plan_tier: ["free", "basic", "pro"],
      refund_request_status: ["requested", "approved", "rejected"],
    },
  },
} as const

