import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateGeoContent } from '@/lib/ai/openai'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 200 })

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json([])

  const { data: projects } = await supabase.from('geo_projects').select('id').eq('workspace_id', workspace.id)
  const ids = (projects || []).map(p => p.id)
  if (!ids.length) return NextResponse.json([])

  const { data } = await supabase
    .from('content_pieces')
    .select('id, type, topic, content, created_at')
    .in('project_id', ids)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { type, topic, keywords = [], brand = '', tone = 'professional' } = await req.json()
    if (!topic) return NextResponse.json({ error: 'topic is required' }, { status: 400 })

    const content = await generateGeoContent({ type, topic, keywords, brand, tone })

    const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
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
          .insert({ workspace_id: workspace.id, name: brand || 'Default', url: 'https://example.com', brand })
          .select('id')
          .single()
        project = newProject
      }

      if (project) {
        await supabase.from('content_pieces').insert({ project_id: project.id, type, topic, content, keywords })
      }
    }

    return NextResponse.json({ content })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await supabase.from('content_pieces').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
