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
          edit_notes: string | null
          engagement_estimate: string | null
          format: string
          id: string
          pillar: string
          published_at: string | null
          rejected_at: string | null
          rejection_reason: string | null
          source_material: Json | null
          status: string
          suggested_time: string | null
          verification_notes: Json | null
          verification_status: string
        }
        Insert: {
          approved_at?: string | null
          content: string
          created_at?: string
          edit_notes?: string | null
          engagement_estimate?: string | null
          format?: string
          id?: string
          pillar: string
          published_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          source_material?: Json | null
          status?: string
          suggested_time?: string | null
          verification_notes?: Json | null
          verification_status?: string
        }
        Update: {
          approved_at?: string | null
          content?: string
          created_at?: string
          edit_notes?: string | null
          engagement_estimate?: string | null
          format?: string
          id?: string
          pillar?: string
          published_at?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          source_material?: Json | null
          status?: string
          suggested_time?: string | null
          verification_notes?: Json | null
          verification_status?: string
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
      voice_samples: {
        Row: {
          content: string | null
          created_at: string
          id: string
          notes: string | null
          performance_rating: number | null
          source: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performance_rating?: number | null
          source?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          performance_rating?: number | null
          source?: string | null
        }
        Relationships: []
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
