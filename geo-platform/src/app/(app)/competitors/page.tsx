'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Search, Loader2, Plus, Trash2, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface Competitor {
  id: string
  name: string
  url: string
  geo_score: number | null
  last_scanned_at: string | null
  scan_data: any
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => { fetchCompetitors() }, [])

  async function fetchCompetitors() {
    const res = await fetch('/api/competitors')
    if (res.ok) setCompetitors(await res.json())
    setLoading(false)
  }

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url }),
    })
    if (res.ok) {
      const data = await res.json()
      setCompetitors(c => [data, ...c])
      setName('')
      setUrl('')
      toast.success('Competitor added')
    } else {
      toast.error('Failed to add')
    }
    setAdding(false)
  }

  async function scanCompetitor(id: string) {
    setScanning(id)
    const res = await fetch(`/api/competitors/${id}/scan`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setCompetitors(c => c.map(x => x.id === id ? { ...x, ...data } : x))
      toast.success('Scan complete')
    } else {
      toast.error('Scan failed')
    }
    setScanning(null)
  }

  async function deleteCompetitor(id: string) {
    await fetch(`/api/competitors?id=${id}`, { method: 'DELETE' })
    setCompetitors(c => c.filter(x => x.id !== id))
    toast.success('Removed')
  }

  const scoreColor = (n: number | null) => {
    if (!n) return 'text-slate-400'
    return n >= 70 ? 'text-emerald-600' : n >= 50 ? 'text-amber-600' : 'text-rose-600'
  }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Competitor Analysis" subtitle="Track competitors' GEO performance" />
      <div className="flex-1 p-6 space-y-6">
        {/* Add form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Add Competitor</h2>
          <form onSubmit={addCompetitor} className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Competitor Name"
              className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 w-48"
            />
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
              placeholder="https://competitor.com"
              className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 flex-1"
            />
            <button
              type="submit"
              disabled={adding}
              className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </form>
        </div>

        {/* Competitors grid */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
        ) : competitors.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Search className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="font-medium text-slate-700 mb-1">No competitors tracked</h3>
            <p className="text-sm text-slate-400">Add competitors to compare GEO performance.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {competitors.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">{c.name}</h3>
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-violet-600 flex items-center gap-1 mt-0.5">
                      {c.url.replace(/^https?:\/\//, '').slice(0, 35)} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className={`text-2xl font-bold ${scoreColor(c.geo_score)}`}>
                    {c.geo_score ?? '—'}
                  </div>
                </div>
                {c.last_scanned_at && (
                  <p className="text-xs text-slate-400 mb-3">
                    Last scanned: {new Date(c.last_scanned_at).toLocaleDateString()}
                  </p>
                )}
                {c.scan_data && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {[
                      { label: 'Words', val: c.scan_data.word_count?.toLocaleString() },
                      { label: 'Schema', val: c.scan_data.schema_types?.length || 0 },
                      { label: 'FAQ', val: c.scan_data.has_faq ? 'Yes' : 'No' },
                      { label: 'Ext. Links', val: c.scan_data.external_links },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-slate-50 rounded-lg p-2 text-center">
                        <div className="text-xs text-slate-400">{label}</div>
                        <div className="text-sm font-semibold text-slate-900">{val ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => scanCompetitor(c.id)}
                    disabled={scanning === c.id}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-violet-50 text-violet-700 py-2 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors disabled:opacity-60"
                  >
                    {scanning === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    {scanning === c.id ? 'Scanning…' : 'Scan Now'}
                  </button>
                  <button
                    onClick={() => deleteCompetitor(c.id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
