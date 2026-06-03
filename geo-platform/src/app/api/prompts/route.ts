import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getDefaultProjectId(supabase: any, userId: string) {
  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', userId).single()
  if (!workspace) return null
  const { data: project } = await supabase.from('geo_projects').select('id').eq('workspace_id', workspace.id).limit(1).single()
  return project?.id || null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data: workspace } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json([])
  const { data: projects } = await supabase.from('geo_projects').select('id').eq('workspace_id', workspace.id)
  const ids = (projects || []).map(p => p.id)
  if (!ids.length) return NextResponse.json([])

  const { data } = await supabase.from('tracked_prompts').select('*').in('project_id', ids).order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { prompt, category } = await req.json()
  const projectId = await getDefaultProjectId(supabase, user.id)
  if (!projectId) return NextResponse.json({ error: 'No project' }, { status: 400 })

  const { data } = await supabase.from('tracked_prompts').insert({ project_id: projectId, prompt, category }).select('*').single()
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, is_active } = await req.json()
  await supabase.from('tracked_prompts').update({ is_active }).eq('id', id)
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (id) await supabase.from('tracked_prompts').delete().eq('id', id)
  return NextResponse.json({ success: true })
}
