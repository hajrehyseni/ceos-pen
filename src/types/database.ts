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
