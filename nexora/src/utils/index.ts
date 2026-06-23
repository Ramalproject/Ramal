import type { Plan } from '@/types'

// ─── Number Formatting ───────────────────────────────────────────────────────

/**
 * Formats a large number into a compact, human-readable string.
 * Examples: 1200 → "1.2K", 1_500_000 → "1.5M", 999 → "999"
 */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    const value = n / 1_000_000
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}M`
  }
  if (n >= 1_000) {
    const value = n / 1_000
    return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}K`
  }
  return String(n)
}

// ─── Relative Time ───────────────────────────────────────────────────────────

/**
 * Returns a relative time string from a past date.
 * Examples: "2m ago", "3h ago", "Yesterday", "Jun 15"
 */
export function timeAgo(date: string | Date): string {
  const now = new Date()
  const then = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - then.getTime()

  if (diffMs < 0) return 'just now'

  const diffSeconds = Math.floor(diffMs / 1_000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return 'just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  if (diffDays === 1) {
    return 'Yesterday'
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  // Older than a week — show a date string
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: then.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

// ─── Initials ────────────────────────────────────────────────────────────────

/**
 * Returns the initials of the first two words in a name.
 * Examples: "John Doe" → "JD", "Alice" → "A", "" → "?"
 */
export function getInitials(name: string): string {
  if (!name || name.trim().length === 0) return '?'
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

// ─── Plan Helpers ────────────────────────────────────────────────────────────

/**
 * Returns the Mantine color name associated with a subscription plan.
 * Used for badge / chip coloring.
 */
export function getPlanColor(plan: Plan): string {
  switch (plan) {
    case 'pro':
      return 'violet'
    case 'business':
      return 'cyan'
    case 'free':
    default:
      return 'gray'
  }
}

/**
 * Returns the human-readable label for a subscription plan.
 */
export function getPlanLabel(plan: Plan): string {
  switch (plan) {
    case 'pro':
      return 'Pro'
    case 'business':
      return 'Business'
    case 'free':
    default:
      return 'Free'
  }
}

// ─── Misc Helpers ────────────────────────────────────────────────────────────

/**
 * Clamps a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Truncates a string to maxLength characters, appending "…" if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength).trimEnd() + '…'
}

/**
 * Generates a deterministic pastel background color from a string (e.g. username).
 * Useful for default avatars.
 */
export function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 55%)`
}
