import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format, subDays } from 'date-fns'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ mentionTrend: [], topPrompts: [], geoScoreHistory: [], platformBreakdown: [] })

  const range = new URL(req.url).searchParams.get('range') || '30d'
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
  const since = subDays(new Date(), days).toISOString()

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json({ mentionTrend: [], topPrompts: [], geoScoreHistory: [], platformBreakdown: [] })

  const { data: projects } = await supabase.from('geo_projects').select('id').eq('workspace_id', workspace.id)
  const ids = (projects || []).map(p => p.id)
  if (!ids.length) return NextResponse.json({ mentionTrend: [], topPrompts: [], geoScoreHistory: [], platformBreakdown: [] })

  // Mentions
  const { data: mentions } = await supabase
    .from('ai_mentions')
    .select('mentioned, platform, checked_at, prompt')
    .in('project_id', ids)
    .gte('checked_at', since)
    .order('checked_at')

  // GEO scores
  const { data: scores } = await supabase
    .from('geo_scores')
    .select('total_score, scanned_at, project_id')
    .in('project_id', ids)
    .gte('scanned_at', since)
    .order('scanned_at')

  // Build mention trend by day
  const dayMap: Record<string, { mentioned: number; total: number }> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = format(subDays(new Date(), i), 'MMM d')
    dayMap[d] = { mentioned: 0, total: 0 }
  }
  for (const m of mentions || []) {
    const d = format(new Date(m.checked_at), 'MMM d')
    if (dayMap[d]) {
      dayMap[d].total++
      if (m.mentioned) dayMap[d].mentioned++
    }
  }
  const mentionTrend = Object.entries(dayMap).map(([date, v]) => ({ date, ...v }))

  // Platform breakdown
  const platformMap: Record<string, { mentioned: number; total: number }> = {}
  for (const m of mentions || []) {
    if (!platformMap[m.platform]) platformMap[m.platform] = { mentioned: 0, total: 0 }
    platformMap[m.platform].total++
    if (m.mentioned) platformMap[m.platform].mentioned++
  }
  const platformBreakdown = Object.entries(platformMap).map(([platform, v]) => ({ platform, ...v }))

  // GEO score history
  const geoScoreHistory = (scores || []).map(s => ({
    date: format(new Date(s.scanned_at), 'MMM d'),
    score: s.total_score,
    project: s.project_id,
  }))

  // Top prompts by mention rate
  const promptMap: Record<string, { mentioned: number; total: number }> = {}
  for (const m of mentions || []) {
    if (!promptMap[m.prompt]) promptMap[m.prompt] = { mentioned: 0, total: 0 }
    promptMap[m.prompt].total++
    if (m.mentioned) promptMap[m.prompt].mentioned++
  }
  const topPrompts = Object.entries(promptMap)
    .map(([prompt, v]) => ({ prompt: prompt.slice(0, 80), mention_rate: Math.round(v.mentioned / v.total * 100) }))
    .sort((a, b) => b.mention_rate - a.mention_rate)
    .slice(0, 10)

  return NextResponse.json({ mentionTrend, topPrompts, geoScoreHistory, platformBreakdown })
}
