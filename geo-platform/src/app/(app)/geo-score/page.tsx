'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { BarChart3, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'
import { format } from 'date-fns'

interface Project {
  id: string
  name: string
  url: string
  geo_scores: Array<{
    id: string
    total_score: number
    ai_readability: number
    semantic_relevance: number
    authority_signals: number
    content_structure: number
    schema_implementation: number
    faq_optimization: number
    external_mentions: number
    citation_quality: number
    scanned_at: string
    recommendations: Array<{ title: string; priority: string; impact: number; description: string }>
  }>
}

export default function GeoScorePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data)
        if (data.length) setSelected(data[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  const project = projects.find(p => p.id === selected)
  const scores = project?.geo_scores || []
  const latest = scores[0]

  const radarData = latest ? [
    { subject: 'Readability', score: latest.ai_readability },
    { subject: 'Relevance', score: latest.semantic_relevance },
    { subject: 'Authority', score: latest.authority_signals },
    { subject: 'Structure', score: latest.content_structure },
    { subject: 'Schema', score: latest.schema_implementation },
    { subject: 'FAQ', score: latest.faq_optimization },
    { subject: 'Mentions', score: latest.external_mentions },
    { subject: 'Citations', score: latest.citation_quality },
  ] : []

  const trendData = [...scores].reverse().map(s => ({
    date: format(new Date(s.scanned_at), 'MMM d'),
    score: s.total_score,
  }))

  const trend = scores.length >= 2 ? scores[0].total_score - scores[1].total_score : null

  const scoreColor = (n: number) =>
    n >= 70 ? 'text-emerald-600' : n >= 50 ? 'text-amber-600' : 'text-rose-600'

  return (
    <div className="flex flex-col flex-1">
      <Header title="GEO Score" subtitle="Track your AI citation readiness over time" />
      <div className="flex-1 p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="font-medium text-slate-700 mb-1">No scores yet</h3>
            <p className="text-sm text-slate-400">Scan a website first to see your GEO scores.</p>
          </div>
        ) : (
          <>
            {/* Project selector */}
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {latest && (
              <>
                {/* Score summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 col-span-2 lg:col-span-1 flex flex-col items-center justify-center">
                    <div className={`text-6xl font-bold ${scoreColor(latest.total_score)}`}>{latest.total_score}</div>
                    <div className="text-sm text-slate-400 mt-1">GEO Score</div>
                    {trend !== null && (
                      <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {trend >= 0 ? '+' : ''}{trend} since last scan
                      </div>
                    )}
                  </div>
                  {[
                    { label: 'AI Readability', val: latest.ai_readability },
                    { label: 'Authority', val: latest.authority_signals },
                    { label: 'Schema', val: latest.schema_implementation },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-white rounded-xl border border-slate-200 p-5">
                      <div className="text-xs text-slate-500 mb-2">{label}</div>
                      <div className={`text-3xl font-bold ${scoreColor(val)}`}>{val}</div>
                      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${val >= 70 ? 'bg-emerald-500' : val >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Trend */}
                  {trendData.length > 1 && (
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                      <h3 className="font-semibold text-slate-900 mb-4">Score History</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Radar */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Score Breakdown</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                        <Radar name="Score" dataKey="score" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recommendations */}
                {latest.recommendations?.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Top Recommendations</h3>
                    <div className="space-y-3">
                      {latest.recommendations.map((r, i) => (
                        <div key={i} className="flex gap-4 p-4 bg-slate-50 rounded-xl">
                          <div className="text-center flex-shrink-0 w-12">
                            <div className="text-xs text-slate-400">Impact</div>
                            <div className="text-lg font-bold text-violet-600">+{r.impact}</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{r.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
