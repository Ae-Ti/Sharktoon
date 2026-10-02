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
          created_at: string
          cuts: Json
          episode_id: string
          finished_at: string | null
          id: string
          mode: string
          owner_id: string
          status: Database["public"]["Enums"]["generation_job_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          cuts?: Json
          episode_id: string
          finished_at?: string | null
          id: string
          mode: string
          owner_id: string
          status?: Database["public"]["Enums"]["generation_job_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          cuts?: Json
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
      credit_commit: { Args: { p_hold_id: string }; Returns: undefined }
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
      is_admin: { Args: never; Returns: boolean }
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
      credit_spend_reason:
        | "cut_image"
        | "partial_regenerate"
        | "animation_episode"
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
      plan_tier: "free" | "basic" | "pro"
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
      credit_spend_reason: [
        "cut_image",
        "partial_regenerate",
        "animation_episode",
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
      plan_tier: ["free", "basic", "pro"],
    },
  },
} as const

