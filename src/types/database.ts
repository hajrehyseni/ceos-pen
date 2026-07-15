export interface Post {
  id: string;
  content: string;
  pillar: string;
  format: string;
  status: string;
  engagement_estimate: string | null;
  suggested_time: string | null;
  edit_notes: string | null;
  rejection_reason: string | null;
  source_material: any;
  created_at: string;
  approved_at: string | null;
  published_at: string | null;
  rejected_at: string | null;
  verification_status?: string | null;
  verification_notes?: any;
  verification_evidence?: any;
  virality_score?: number | null;
  voice_score?: number | null;
  score_breakdown?: any;
  cta_id?: string | null;
  first_comment_text?: string | null;
  first_comment_posted_at?: string | null;
  hook_pattern?: string | null;
}

export interface WeeklyBrief {
  id: string;
  week_start: string;
  summary_md: string;
  metrics: {
    this_week_posts?: number;
    last_week_posts?: number;
    this_week_engaged?: number;
    last_week_engaged?: number;
    this_week_impressions?: number;
    this_week_cost_usd?: number;
    last_week_cost_usd?: number;
    cost_per_engaged_this_week?: number | null;
    cost_per_engaged_last_week?: number | null;
  };
  recommendations: string[];
  created_at: string;
}

export interface CeoContext {
  id: string;
  bio: string;
  worldview: string;
  recurring_stories: string;
  forbidden_phrases: string;
  lead_magnet_url: string;
  auto_first_comment: boolean;
  hard_cta_ratio: number;
  competitor_urls: string[];
  trend_keywords: string[];
  updated_at: string;
}

export interface CtaItem {
  id: string;
  copy: string;
  cta_type: "soft" | "hard";
  weight: number;
  enabled: boolean;
  times_used: number;
  estimated_clicks: number;
  created_at: string;
}

export interface PostMetrics {
  id: string;
  post_id: string;
  likes: number;
  comments: number;
  reposts: number;
  profile_views: number;
  impressions: number;
  checked_at: string;
}

export interface AgentLog {
  id: string;
  action: string;
  details: any;
  api_cost_usd: number;
  tokens_used: number;
  created_at: string;
}
