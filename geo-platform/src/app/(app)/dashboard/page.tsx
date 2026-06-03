import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Header from '@/components/layout/Header'
import Link from 'next/link'
import { Globe, Brain, BarChart3, Zap, TrendingUp, ArrowRight } from 'lucide-react'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  const { data: projects } = await supabase
    .from('geo_projects')
    .select('*, geo_scores(total_score, scanned_at)')
    .eq('workspace_id', workspace?.id || '')
    .order('created_at', { ascending: false })
    .limit(5)

  const { count: totalScans } = await supabase
    .from('scan_results')
    .select('id', { count: 'exact', head: true })
    .in('project_id', (projects || []).map(p => p.id))

  const { count: totalMentions } = await supabase
    .from('ai_mentions')
    .select('id', { count: 'exact', head: true })
    .in('project_id', (projects || []).map(p => p.id))

  const { count: totalContent } = await supabase
    .from('content_pieces')
    .select('id', { count: 'exact', head: true })
    .in('project_id', (projects || []).map(p => p.id))

  const avgScore = projects?.length
    ? Math.round(
        (projects || []).reduce((sum, p) => {
          const latest = p.geo_scores?.[0]?.total_score || 0
          return sum + latest
        }, 0) / projects.length
      )
    : 0

  return (
    <div className="flex flex-col flex-1">
      <Header
        title={`Welcome back${workspace ? `, ${workspace.name.replace("'s Workspace", '')}` : ''}`}
        subtitle="Here's your GEO performance overview"
        action={{ label: 'New Project', href: '/scanner' }}
      />
      <div className="flex-1 p-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Avg. GEO Score', value: avgScore || '—', icon: BarChart3, color: 'text-violet-600 bg-violet-50', sub: 'out of 100' },
            { label: 'Total Scans', value: totalScans || 0, icon: Globe, color: 'text-blue-600 bg-blue-50', sub: 'pages analyzed' },
            { label: 'AI Mentions', value: totalMentions || 0, icon: Brain, color: 'text-emerald-600 bg-emerald-50', sub: 'tracked prompts' },
            { label: 'Content Pieces', value: totalContent || 0, icon: Zap, color: 'text-amber-600 bg-amber-50', sub: 'AI-generated' },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className={`inline-flex p-2 rounded-lg mb-3 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-sm font-medium text-slate-700 mt-0.5">{label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* Projects table */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Projects</h2>
            <Link href="/scanner" className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1">
              New scan <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {!projects?.length ? (
            <div className="px-6 py-16 text-center">
              <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-medium text-slate-700 mb-1">No projects yet</h3>
              <p className="text-sm text-slate-400 mb-6">Scan a website to get your first GEO score.</p>
              <Link href="/scanner" className="inline-flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">
                Scan your first page
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.map(p => {
                const latest = p.geo_scores?.[0]
                const score = latest?.total_score
                const scoreColor = score >= 70 ? 'text-emerald-600 bg-emerald-50' : score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50'
                return (
                  <div key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{p.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{p.url}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      {score !== undefined ? (
                        <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${scoreColor}`}>
                          {score}/100
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">Not scanned</span>
                      )}
                      <Link href={`/geo-score?project=${p.id}`} className="text-sm text-violet-600 hover:text-violet-700">
                        View →
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { href: '/scanner', icon: Globe, title: 'Scan a Website', desc: 'Get a detailed GEO audit of any URL', color: 'bg-blue-600' },
            { href: '/content', icon: Zap, title: 'Generate Content', desc: 'Create AI-optimized blog posts and FAQs', color: 'bg-amber-500' },
            { href: '/mentions', icon: TrendingUp, title: 'Track Mentions', desc: 'See how AI engines cite your brand', color: 'bg-emerald-600' },
          ].map(({ href, icon: Icon, title, desc, color }) => (
            <Link key={href} href={href} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow flex gap-4 items-start">
              <div className={`p-2.5 rounded-xl ${color} flex-shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-medium text-slate-900 text-sm">{title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
