// ─── Profile ────────────────────────────────────────────────────────────────

export type Plan = 'free' | 'pro' | 'business'

export interface Profile {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  website: string | null
  location: string | null
  skills: string[]
  social_links: Record<string, string>
  plan: Plan
  credits: number
  followers_count: number
  following_count: number
  posts_count: number
  is_verified: boolean
  is_creator: boolean
  is_private?: boolean
  created_at: string
  updated_at: string
}

// ─── Post ────────────────────────────────────────────────────────────────────

export type PostType = 'text' | 'image' | 'video' | 'article' | 'poll'
export type PostVisibility = 'public' | 'followers' | 'private'

export interface Post {
  id: string
  author_id: string
  content: string
  media_urls: string[]
  post_type: PostType
  likes_count: number
  comments_count: number
  shares_count: number
  visibility: PostVisibility
  created_at: string
  updated_at: string
  // Joined / computed fields
  author?: Profile
  liked_by_me?: boolean
  saved_by_me?: boolean
}

// ─── Comment ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  author?: Profile
}

// ─── AI Twin ─────────────────────────────────────────────────────────────────

export interface AiTwin {
  id: string
  owner_id: string
  name: string
  avatar_url: string | null
  bio: string | null
  personality: string
  expertise: string[]
  communication_style: string
  is_public: boolean
  is_for_sale: boolean
  price: number | null
  chats_count: number
  rating: number
  created_at: string
  updated_at: string
  // Joined field
  owner?: Profile
}

// ─── Community ───────────────────────────────────────────────────────────────

export interface CommunityRule {
  title: string
  body: string
}

export interface Community {
  id: string
  owner_id: string
  name: string
  slug: string
  description: string | null
  avatar_url: string | null
  cover_url: string | null
  category: string
  tags: string[]
  rules: CommunityRule[]
  members_count: number
  posts_count: number
  is_private: boolean
  created_at: string
  updated_at: string
}

// ─── Message ─────────────────────────────────────────────────────────────────

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'voice' | 'system'

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
  user?: Profile
}

export interface Message {
  id: string
  room_id: string
  sender_id: string
  content: string
  message_type: MessageType
  created_at: string
  updated_at?: string
  // WhatsApp features
  attachment_url?: string
  attachment_name?: string
  attachment_type?: string
  duration?: number
  reply_to_id?: string
  reply_to?: Message
  is_deleted?: boolean
  deleted_at?: string
  pinned_at?: string
  reactions?: MessageReaction[]
  // Joined field
  sender?: Profile
}

export interface Room {
  id: string
  created_at: string
  updated_at?: string
  participants?: Profile[]
  last_message?: Message
  unread_count?: number
}

// ─── Notification ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'follow'
  | 'like'
  | 'comment'
  | 'share'
  | 'mention'
  | 'reply'
  | 'system'
  | 'ai_twin_chat'
  | 'community_invite'
  | 'community_post'

export interface Notification {
  id: string
  user_id: string
  actor_id: string | null
  type: NotificationType
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
}
