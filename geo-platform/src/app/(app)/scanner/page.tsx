'use client'
import { useState } from 'react'
import Header from '@/components/layout/Header'
import { Globe, Loader2, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

interface ScanData {
  url: string
  title: string
  meta_description: string
  schema_types: string[]
  has_faq: boolean
  has_how_to: boolean
  word_count: number
  reading_level: string
  internal_links: number
  external_links: number
  images_with_alt: number
  eeat_signals: Record<string, boolean>
  issues: Array<{ type: string; severity: string; message: string; fix: string }>
  heading_structure: Array<{ level: number; text: string }>
  geo_score: {
    total_score: number
    ai_readability: number
    semantic_relevance: number
    authority_signals: number
    content_structure: number
    schema_implementation: number
    faq_optimization: number
    external_mentions: number
    citation_quality: number
    recommendations: Array<{ category: string; priority: string; title: string; description: string; impact: number }>
  }
}

export default function ScannerPage() {
  const [url, setUrl] = useState('')
  const [keywords, setKeywords] = useState('')
  const [brand, setBrand] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScanData | null>(null)
  const [showHeadings, setShowHeadings] = useState(false)

  async function handleScan(e: React.FormEvent) {
    e.preventDefault()
    if (!url) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          brand: brand || url,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      toast.error(err.message || 'Scan failed')
    }
    setLoading(false)
  }

  const severityIcon = (s: string) =>
    s === 'error' ? <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
    : s === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
    : <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />

  const scoreColor = (n: number) =>
    n >= 70 ? 'text-emerald-600' : n >= 50 ? 'text-amber-600' : 'text-rose-600'

  const scoreBg = (n: number) =>
    n >= 70 ? 'bg-emerald-500' : n >= 50 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <div className="flex flex-col flex-1">
      <Header title="GEO Scanner" subtitle="Deep-scan any URL for AI citation readiness" />
      <div className="flex-1 p-6 space-y-6 max-w-4xl">
        {/* Scan form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <form onSubmit={handleScan} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Website URL</label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/blog/your-article"
                required
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand name</label>
                <input
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target keywords <span className="text-slate-400">(comma-separated)</span></label>
                <input
                  type="text"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="GEO optimization, AI search, ..."
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-violet-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {loading ? 'Scanning…' : 'Scan URL'}
            </button>
          </form>
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Score hero */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-slate-900">{result.title || result.url}</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{result.url}</p>
                </div>
                <div className="text-right">
                  <div className={`text-5xl font-bold ${scoreColor(result.geo_score.total_score)}`}>
                    {result.geo_score.total_score}
                  </div>
                  <div className="text-xs text-slate-400">GEO Score / 100</div>
                </div>
              </div>

              {/* Sub-scores */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'AI Readability', val: result.geo_score.ai_readability },
                  { label: 'Semantic Relevance', val: result.geo_score.semantic_relevance },
                  { label: 'Authority', val: result.geo_score.authority_signals },
                  { label: 'Structure', val: result.geo_score.content_structure },
                  { label: 'Schema', val: result.geo_score.schema_implementation },
                  { label: 'FAQ', val: result.geo_score.faq_optimization },
                  { label: 'Ext. Mentions', val: result.geo_score.external_mentions },
                  { label: 'Citations', val: result.geo_score.citation_quality },
                ].map(({ label, val }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-500 mb-1">{label}</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${scoreBg(val)}`} style={{ width: `${val}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${scoreColor(val)}`}>{val}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Page metrics */}
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { label: 'Word Count', value: result.word_count.toLocaleString(), good: result.word_count >= 800 },
                { label: 'Reading Level', value: result.reading_level, good: true },
                { label: 'Internal Links', value: result.internal_links, good: result.internal_links >= 3 },
                { label: 'External Links', value: result.external_links, good: result.external_links >= 2 },
                { label: 'Schema Types', value: result.schema_types.join(', ') || 'None', good: result.schema_types.length > 0 },
                { label: 'Has FAQ', value: result.has_faq ? 'Yes' : 'No', good: result.has_faq },
              ].map(({ label, value, good }) => (
                <div key={label} className={`bg-white rounded-xl border p-4 ${good ? 'border-slate-200' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="text-xs text-slate-500 mb-1">{label}</div>
                  <div className={`text-sm font-semibold ${good ? 'text-slate-900' : 'text-amber-700'}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Issues Found ({result.issues.length})</h3>
                <div className="space-y-3">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                      {severityIcon(issue.severity)}
                      <div>
                        <div className="text-sm font-medium text-slate-900">{issue.message}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{issue.fix}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Recommendations</h3>
              <div className="space-y-3">
                {result.geo_score.recommendations.map((r, i) => (
                  <div key={i} className="flex gap-4 p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="text-center flex-shrink-0">
                      <div className="text-xs text-slate-400">Impact</div>
                      <div className="text-lg font-bold text-violet-600">+{r.impact}</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-slate-900">{r.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.priority === 'high' ? 'bg-rose-100 text-rose-700' : r.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {r.priority}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto">{r.category}</span>
                      </div>
                      <p className="text-xs text-slate-500">{r.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Headings */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => setShowHeadings(!showHeadings)}
              >
                <h3 className="font-semibold text-slate-900">Heading Structure ({result.heading_structure.length})</h3>
                {showHeadings ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showHeadings && (
                <div className="mt-4 space-y-1">
                  {result.heading_structure.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm" style={{ paddingLeft: `${(h.level - 1) * 16}px` }}>
                      <span className="text-xs font-mono text-slate-400 w-6">H{h.level}</span>
                      <span className="text-slate-700">{h.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
