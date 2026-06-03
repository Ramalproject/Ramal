'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Brain, Loader2, CheckCircle, XCircle, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Mention {
  id: string
  prompt: string
  platform: string
  mentioned: boolean
  position: number | null
  snippet: string
  competitors_mentioned: string[]
  checked_at: string
}

const PLATFORMS = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity']

export default function MentionsPage() {
  const [prompt, setPrompt] = useState('')
  const [brand, setBrand] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [platform, setPlatform] = useState('ChatGPT')
  const [loading, setLoading] = useState(false)
  const [mentions, setMentions] = useState<Mention[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    fetchMentions()
  }, [])

  async function fetchMentions() {
    setFetching(true)
    const res = await fetch('/api/mentions')
    if (res.ok) setMentions(await res.json())
    setFetching(false)
  }

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          brand,
          competitors: competitors.split(',').map(c => c.trim()).filter(Boolean),
          platform,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setMentions(m => [data, ...m])
      toast.success(data.mentioned ? 'Brand mentioned!' : 'Brand not mentioned')
    } catch (err: any) {
      toast.error(err.message || 'Check failed')
    }
    setLoading(false)
  }

  async function deleteMention(id: string) {
    await fetch(`/api/mentions?id=${id}`, { method: 'DELETE' })
    setMentions(m => m.filter(x => x.id !== id))
  }

  const mentionRate = mentions.length ? Math.round(mentions.filter(m => m.mentioned).length / mentions.length * 100) : 0

  return (
    <div className="flex flex-col flex-1">
      <Header title="AI Mention Tracker" subtitle="See when AI engines cite your brand" />
      <div className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Checks', value: mentions.length },
            { label: 'Mentioned', value: mentions.filter(m => m.mentioned).length },
            { label: 'Mention Rate', value: `${mentionRate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 text-center">
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-sm text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Check Prompt</h2>
              <form onSubmit={handleCheck} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Platform</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlatform(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${platform === p ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prompt to test</label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    required
                    rows={4}
                    placeholder="What are the best GEO tools for AI search optimization?"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Your brand</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                    required
                    placeholder="Ramal"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Competitors <span className="text-slate-400">(comma-separated)</span></label>
                  <input
                    type="text"
                    value={competitors}
                    onChange={e => setCompetitors(e.target.value)}
                    placeholder="Competitor A, Competitor B"
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                  {loading ? 'Checking…' : 'Check Mention'}
                </button>
              </form>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-slate-200 h-full">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Mention History</h3>
              </div>
              {fetching ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                </div>
              ) : mentions.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-center">
                  <div>
                    <Brain className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No mentions tracked yet</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
                  {mentions.map(m => (
                    <div key={m.id} className="p-4 flex gap-3 hover:bg-slate-50">
                      <div className="flex-shrink-0 mt-0.5">
                        {m.mentioned
                          ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                          : <XCircle className="w-5 h-5 text-slate-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-violet-600">{m.platform}</span>
                          <span className={`text-xs font-semibold ${m.mentioned ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {m.mentioned ? 'Mentioned' : 'Not mentioned'}
                          </span>
                          {m.position && <span className="text-xs text-slate-400">Position #{m.position}</span>}
                        </div>
                        <p className="text-sm text-slate-700 truncate">{m.prompt}</p>
                        {m.snippet && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 italic">"{m.snippet}"</p>
                        )}
                        {m.competitors_mentioned.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1">
                            Competitors mentioned: {m.competitors_mentioned.join(', ')}
                          </p>
                        )}
                      </div>
                      <button onClick={() => deleteMention(m.id)} className="text-slate-300 hover:text-rose-500 flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
