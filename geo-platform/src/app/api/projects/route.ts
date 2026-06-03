import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json([])

  const { data } = await supabase
    .from('geo_projects')
    .select(`
      id, name, url, keywords, brand, created_at,
      geo_scores(id, total_score, ai_readability, semantic_relevance, authority_signals, content_structure, schema_implementation, faq_optimization, external_mentions, citation_quality, scanned_at, recommendations)
    `)
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}
