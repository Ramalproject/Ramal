import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scanWebsite } from '@/lib/scanner/website'
import { computeGeoScore } from '@/lib/geo/scorer'

export async function POST(req: NextRequest) {
  try {
    const { url, keywords = [], brand = '' } = await req.json()
    if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const scan = await scanWebsite(url)
    const geoScore = computeGeoScore(scan, keywords)

    // Persist if authenticated
    if (user) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (workspace) {
        // Upsert project by URL
        let { data: project } = await supabase
          .from('geo_projects')
          .select('id')
          .eq('workspace_id', workspace.id)
          .eq('url', scan.url)
          .single()

        if (!project) {
          const { data: newProject } = await supabase
            .from('geo_projects')
            .insert({ workspace_id: workspace.id, name: scan.title || scan.url, url: scan.url, keywords, brand })
            .select('id')
            .single()
          project = newProject
        }

        if (project) {
          // Insert geo score
          const { data: scoreRow } = await supabase
            .from('geo_scores')
            .insert({ project_id: project.id, ...geoScore })
            .select('id')
            .single()

          // Insert scan result
          await supabase.from('scan_results').insert({
            project_id: project.id,
            geo_score_id: scoreRow?.id,
            url: scan.url,
            title: scan.title,
            meta_description: scan.meta_description,
            schema_types: scan.schema_types,
            has_faq: scan.has_faq,
            has_how_to: scan.has_how_to,
            word_count: scan.word_count,
            reading_level: scan.reading_level,
            internal_links: scan.internal_links,
            external_links: scan.external_links,
            images_with_alt: scan.images_with_alt,
            eeat_signals: scan.eeat_signals,
            issues: scan.issues,
            heading_structure: scan.heading_structure,
          })
        }
      }
    }

    return NextResponse.json({ ...scan, geo_score: geoScore })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
