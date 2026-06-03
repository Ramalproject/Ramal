'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { LineChart, BarChart3, Loader2 } from 'lucide-react'
import {
  LineChart as ReLineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface AnalyticsData {
  mentionTrend: Array<{ date: string; mentioned: number; total: number }>
  topPrompts: Array<{ prompt: string; mention_rate: number }>
  geoScoreHistory: Array<{ date: string; score: number; project: string }>
  platformBreakdown: Array<{ platform: string; mentioned: number; total: number }>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('30d')

  useEffect(() => {
    fetchAnalytics()
  }, [range])

  async function fetchAnalytics() {
    setLoading(true)
    const res = await fetch(`/api/analytics?range=${range}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Analytics" subtitle="GEO performance trends and insights" />
      <div className="flex-1 p-6 space-y-6">
        {/* Range selector */}
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${range === r ? 'bg-violet-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {r === '7d' ? '7 days' : r === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>
        ) : !data || (!data.mentionTrend.length && !data.geoScoreHistory.length) ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="font-medium text-slate-700 mb-1">Not enough data yet</h3>
            <p className="text-sm text-slate-400">Scan websites and track mentions to see analytics.</p>
          </div>
        ) : (
          <>
            {/* Mention trend */}
            {data.mentionTrend.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">AI Mention Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <ReLineChart data={data.mentionTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="mentioned" name="Mentioned" stroke="#7c3aed" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="total" name="Total Checks" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                  </ReLineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* GEO score history */}
              {data.geoScoreHistory.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">GEO Score History</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <ReLineChart data={data.geoScoreHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    </ReLineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Platform breakdown */}
              {data.platformBreakdown.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Mentions by Platform</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.platformBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="mentioned" name="Mentioned" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total" name="Total" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Top prompts */}
            {data.topPrompts.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Top Performing Prompts</h3>
                <div className="space-y-3">
                  {data.topPrompts.map((p, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="text-sm text-slate-400 w-4">{i + 1}</span>
                      <div className="flex-1 text-sm text-slate-700 truncate">{p.prompt}</div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${p.mention_rate}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-600 w-8 text-right">{p.mention_rate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
