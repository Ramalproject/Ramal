export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  plan: 'free' | 'pro' | 'agency' | 'enterprise'
  credits: number
  created_at: string
}

export interface Workspace {
  id: string
  name: string
  owner_id: string
  plan: string
  created_at: string
}

export interface GeoProject {
  id: string
  workspace_id: string
  name: string
  website_url: string
  brand_name: string
  keywords: string[]
  geo_score: number | null
  last_scanned: string | null
  created_at: string
}

export interface GeoScore {
  id: string
  project_id: string
  total_score: number
  ai_readability: number
  semantic_relevance: number
  authority_signals: number
  content_structure: number
  schema_implementation: number
  faq_optimization: number
  external_mentions: number
  citation_quality: number
  recommendations: Recommendation[]
  scanned_at: string
}

export interface Recommendation {
  category: string
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  impact: number
}

export interface AiMention {
  id: string
  project_id: string
  engine: 'chatgpt' | 'gemini' | 'perplexity' | 'copilot'
  prompt: string
  mentioned: boolean
  position: number | null
  snippet: string | null
  competitors_mentioned: string[]
  checked_at: string
}

export interface TrackedPrompt {
  id: string
  project_id: string
  prompt_text: string
  category: string
  engines: string[]
  frequency: 'daily' | 'weekly' | 'monthly'
  last_checked: string | null
  created_at: string
}

export interface ScanResult {
  url: string
  title: string
  meta_description: string
  schema_types: string[]
  has_faq: boolean
  has_how_to: boolean
  heading_structure: HeadingNode[]
  word_count: number
  reading_level: string
  internal_links: number
  external_links: number
  images_with_alt: number
  page_speed_score: number | null
  eeat_signals: EeatSignals
  issues: ScanIssue[]
}

export interface HeadingNode {
  level: number
  text: string
}

export interface EeatSignals {
  has_author: boolean
  has_date: boolean
  has_citations: boolean
  has_about_page: boolean
  has_contact_page: boolean
  has_privacy_policy: boolean
}

export interface ScanIssue {
  type: string
  severity: 'error' | 'warning' | 'info'
  message: string
  fix: string
}

export interface Competitor {
  id: string
  project_id: string
  name: string
  website_url: string
  geo_score: number | null
  ai_visibility_score: number | null
  mention_count: number
  last_analyzed: string | null
}

export interface ContentPiece {
  id: string
  project_id: string
  type: 'blog' | 'faq' | 'comparison' | 'snippet' | 'product'
  title: string
  content: string
  geo_optimized: boolean
  score: number | null
  created_at: string
}

export interface AuthoritySignal {
  platform: string
  type: string
  url: string
  domain_authority: number | null
  status: 'active' | 'pending' | 'opportunity'
}

export interface DashboardStats {
  geo_score: number
  geo_score_change: number
  ai_visibility: number
  ai_visibility_change: number
  total_mentions: number
  mentions_change: number
  tracked_prompts: number
  competitor_count: number
}

export interface MentionTrend {
  date: string
  chatgpt: number
  gemini: number
  perplexity: number
  copilot: number
}

export interface PlanFeature {
  name: string
  free: boolean | string
  pro: boolean | string
  agency: boolean | string
  enterprise: boolean | string
}
