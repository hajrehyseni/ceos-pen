export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_log: {
        Row: {
          action: string | null
          api_cost_usd: number | null
          created_at: string
          details: Json | null
          id: string
          tokens_used: number | null
        }
        Insert: {
          action?: string | null
          api_cost_usd?: number | null
          created_at?: string
          details?: Json | null
          id?: string
          tokens_used?: number | null
        }
        Update: {
          action?: string | null
          api_cost_usd?: number | null
          created_at?: string
          details?: Json | null
          id?: string
          tokens_used?: number | null
        }
        Relationships: []
      }
      ceo_context: {
        Row: {
          auto_first_comment: boolean
          bio: string
          competitor_urls: string[]
          forbidden_phrases: string
          hard_cta_ratio: number
          id: string
          lead_magnet_url: string
          recurring_stories: string
          trend_keywords: string[]
          updated_at: string
          worldview: string
        }
        Insert: {
          auto_first_comment?: boolean
          bio?: string
          competitor_urls?: string[]
          forbidden_phrases?: string
          hard_cta_ratio?: number
          id?: string
          lead_magnet_url?: string
          recurring_stories?: string
          trend_keywords?: string[]
          updated_at?: string
          worldview?: string
        }
        Update: {
          auto_first_comment?: boolean
          bio?: string
          competitor_urls?: string[]
          forbidden_phrases?: string
          hard_cta_ratio?: number
          id?: string
          lead_magnet_url?: string
          recurring_stories?: string
          trend_keywords?: string[]
          updated_at?: string
          worldview?: string
        }
        Relationships: []
      }
      cta_library: {
        Row: {
          copy: string
          created_at: string
          cta_type: string
          enabled: boolean
          estimated_clicks: number
          id: string
          times_used: number
          weight: number
        }
        Insert: {
          copy: string
          created_at?: string
          cta_type?: string
          enabled?: boolean
          estimated_clicks?: number
          id?: string
          times_used?: number
          weight?: number
        }
        Update: {
          copy?: string
          created_at?: string
          cta_type?: string
          enabled?: boolean
          estimated_clicks?: number
          id?: string
          times_used?: number
          weight?: number
        }
        Relationships: []
      }
      hook_variants: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          shape: string
          text: string
          was_selected: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          shape: string
          text: string
          was_selected?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          shape?: string
          text?: string
          was_selected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "hook_variants_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          collected_at: string
          id: string
          pillar_match: string | null
          relevance_score: number | null
          source: string | null
          summary: string | null
          title: string | null
          url: string | null
          used_in_post: string | null
        }
        Insert: {
          collected_at?: string
          id?: string
          pillar_match?: string | null
          relevance_score?: number | null
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
          used_in_post?: string | null
        }
        Update: {
          collected_at?: string
          id?: string
          pillar_match?: string | null
          relevance_score?: number | null
          source?: string | null
          summary?: string | null
          title?: string | null
          url?: string | null
          used_in_post?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_items_used_in_post_fkey"
            columns: ["used_in_post"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          checked_at: string
          comments: number | null
          id: string
          impressions: number | null
          likes: number | null
          post_id: string
          profile_views: number | null
          reposts: number | null
        }
        Insert: {
          checked_at?: string
          comments?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          post_id: string
          profile_views?: number | null
          reposts?: number | null
        }
        Update: {
          checked_at?: string
          comments?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          post_id?: string
          profile_views?: number | null
          reposts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          approved_at: string | null
          content: string
          created_at: string
          cta_id: string | null
          edit_notes: string | null
          engagement_estimate: string | null
          first_comment_posted_at: string | null
          first_comment_text: string | null
          format: string
          id: string
          pillar: string
          published_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          repurposed_from_post_id: string | null
          score_breakdown: Json | null
          source_material: Json | null
          status: string
          suggested_time: string | null
          verification_evidence: Json | null
          verification_notes: Json | null
          verification_status: string
          virality_score: number | null
          voice_score: number | null
        }
        Insert: {
          approved_at?: string | null
          content: string
          created_at?: string
          cta_id?: string | null
          edit_notes?: string | null
          engagement_estimate?: string | null
          first_comment_posted_at?: string | null
          first_comment_text?: string | null
          format?: string
          id?: string
          pillar: string
          published_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          repurposed_from_post_id?: string | null
          score_breakdown?: Json | null
          source_material?: Json | null
          status?: string
          suggested_time?: string | null
          verification_evidence?: Json | null
          verification_notes?: Json | null
          verification_status?: string
          virality_score?: number | null
          voice_score?: number | null
        }
        Update: {
          approved_at?: string | null
          content?: string
          created_at?: string
          cta_id?: string | null
          edit_notes?: string | null
          engagement_estimate?: string | null
          first_comment_posted_at?: string | null
          first_comment_text?: string | null
          format?: string
          id?: string
          pillar?: string
          published_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          repurposed_from_post_id?: string | null
          score_breakdown?: Json | null
          source_material?: Json | null
          status?: string
          suggested_time?: string | null
          verification_evidence?: Json | null
          verification_notes?: Json | null
          verification_status?: string
          virality_score?: number | null
          voice_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_cta_id_fkey"
            columns: ["cta_id"]
            isOneToOne: false
            referencedRelation: "cta_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_repurposed_from_post_id_fkey"
            columns: ["repurposed_from_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      reply_drafts: {
        Row: {
          created_at: string
          id: string
          source_text: string
          variants: Json
        }
        Insert: {
          created_at?: string
          id?: string
          source_text: string
          variants?: Json
        }
        Update: {
          created_at?: string
          id?: string
          source_text?: string
          variants?: Json
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      trend_radar: {
        Row: {
          angle: string | null
          counter_take: string | null
          created_at: string
          expires_at: string
          heat_score: number
          id: string
          pillar: string | null
          source_type: string
          source_url: string | null
          summary: string
          title: string
          used_in_post_id: string | null
        }
        Insert: {
          angle?: string | null
          counter_take?: string | null
          created_at?: string
          expires_at?: string
          heat_score?: number
          id?: string
          pillar?: string | null
          source_type?: string
          source_url?: string | null
          summary: string
          title: string
          used_in_post_id?: string | null
        }
        Update: {
          angle?: string | null
          counter_take?: string | null
          created_at?: string
          expires_at?: string
          heat_score?: number
          id?: string
          pillar?: string | null
          source_type?: string
          source_url?: string | null
          summary?: string
          title?: string
          used_in_post_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_radar_used_in_post_id_fkey"
            columns: ["used_in_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      visual_assets: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          payload: Json
          post_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          payload?: Json
          post_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          payload?: Json
          post_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visual_assets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_samples: {
        Row: {
          auto_harvested: boolean
          content: string | null
          created_at: string
          id: string
          notes: string | null
          performance_rating: number | null
          source: string | null
          source_post_id: string | null
          style_tags: string[]
        }
        Insert: {
          auto_harvested?: boolean
          content?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performance_rating?: number | null
          source?: string | null
          source_post_id?: string | null
          style_tags?: string[]
        }
        Update: {
          auto_harvested?: boolean
          content?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performance_rating?: number | null
          source?: string | null
          source_post_id?: string | null
          style_tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "voice_samples_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
