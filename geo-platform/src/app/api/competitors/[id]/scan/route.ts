import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scanWebsite } from '@/lib/scanner/website'
import { computeGeoScore } from '@/lib/geo/scorer'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: competitor } = await supabase.from('competitors').select('*').eq('id', id).single()
  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const scan = await scanWebsite(competitor.url)
  const geoScore = computeGeoScore(scan, [])

  const { data } = await supabase
    .from('competitors')
    .update({
      geo_score: geoScore.total_score,
      last_scanned_at: new Date().toISOString(),
      scan_data: { word_count: scan.word_count, schema_types: scan.schema_types, has_faq: scan.has_faq, external_links: scan.external_links },
    })
    .eq('id', id)
    .select('*')
    .single()

  return NextResponse.json(data)
}
