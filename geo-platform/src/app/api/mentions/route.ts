import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzePromptVisibility } from '@/lib/ai/openai'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json([])

  const { data: projects } = await supabase.from('geo_projects').select('id').eq('workspace_id', workspace.id)
  const ids = (projects || []).map(p => p.id)
  if (!ids.length) return NextResponse.json([])

  const { data } = await supabase
    .from('ai_mentions')
    .select('*')
    .in('project_id', ids)
    .order('checked_at', { ascending: false })
    .limit(100)

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { prompt, brand, competitors = [], platform = 'ChatGPT' } = await req.json()
    if (!prompt || !brand) return NextResponse.json({ error: 'prompt and brand are required' }, { status: 400 })

    const result = await analyzePromptVisibility({ prompt, brand, competitors })

    const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()

    let projectId: string | null = null
    if (workspace) {
      let { data: project } = await supabase
        .from('geo_projects')
        .select('id')
        .eq('workspace_id', workspace.id)
        .limit(1)
        .single()

      if (!project) {
        const { data: newProject } = await supabase
          .from('geo_projects')
          .insert({ workspace_id: workspace.id, name: brand, url: 'https://example.com', brand })
          .select('id')
          .single()
        project = newProject
      }
      projectId = project?.id || null
    }

    if (!projectId) return NextResponse.json({ error: 'No project' }, { status: 400 })

    const { data: mention } = await supabase
      .from('ai_mentions')
      .insert({
        project_id: projectId,
        prompt,
        platform,
        mentioned: result.mentioned,
        position: result.position,
        snippet: result.snippet,
        competitors_mentioned: result.competitors,
      })
      .select('*')
      .single()

    return NextResponse.json(mention)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (id) await supabase.from('ai_mentions').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
