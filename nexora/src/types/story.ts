import type { Profile } from './index'

// ─── Story ───────────────────────────────────────────────────────────────────

export type StoryType = 'image' | 'video' | 'text'

export interface Story {
  id: string
  author_id: string
  media_url: string | null
  content: string | null
  story_type: StoryType
  bg_color: string | null
  views_count: number
  expires_at: string
  created_at: string
  // Joined field
  author?: Profile
}

// ─── StoryGroup ──────────────────────────────────────────────────────────────

/**
 * Groups all active stories belonging to a single author.
 * Used to render the story-ring row at the top of the feed.
 */
export interface StoryGroup {
  author: Profile
  stories: Story[]
}
