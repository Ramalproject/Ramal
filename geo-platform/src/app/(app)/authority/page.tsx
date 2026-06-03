'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Shield, Plus, Trash2, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Signal {
  id: string
  type: string
  source: string
  url: string
  description: string
  impact_score: number
  verified: boolean
  created_at: string
}

const TYPES = ['Backlink', 'Press Mention', 'Citation', 'Social Proof', 'Award', 'Partnership', 'Review', 'Expert Quote']

export default function AuthorityPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ type: 'Backlink', source: '', url: '', description: '', impact_score: 5 })

  useEffect(() => { fetchSignals() }, [])

  async function fetchSignals() {
    const res = await fetch('/api/authority')
    if (res.ok) setSignals(await res.json())
    setLoading(false)
  }

  async function addSignal(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const res = await fetch('/api/authority', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const data = await res.json()
      setSignals(s => [data, ...s])
      setForm({ type: 'Backlink', source: '', url: '', description: '', impact_score: 5 })
      toast.success('Signal added')
    }
    setAdding(false)
  }

  async function verifySignal(id: string) {
    const res = await fetch(`/api/authority`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, verified: true }),
    })
    if (res.ok) setSignals(s => s.map(x => x.id === id ? { ...x, verified: true } : x))
  }

  async function deleteSignal(id: string) {
    await fetch(`/api/authority?id=${id}`, { method: 'DELETE' })
    setSignals(s => s.filter(x => x.id !== id))
    toast.success('Removed')
  }

  const totalImpact = signals.filter(s => s.verified).reduce((sum, s) => sum + s.impact_score, 0)
  const verifiedCount = signals.filter(s => s.verified).length

  return (
    <div className="flex flex-col flex-1">
      <Header title="Authority Builder" subtitle="Track E-E-A-T signals that boost AI citation probability" />
      <div className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Signals', value: signals.length },
            { label: 'Verified', value: verifiedCount },
            { label: 'Total Impact', value: totalImpact },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 text-center">
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-sm text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Add form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Add Authority Signal</h2>
          <form onSubmit={addSignal} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
              <input
                type="text"
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                required
                placeholder="Forbes, TechCrunch, Wired..."
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
              <input
                type="url"
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Impact Score (1-10)</label>
              <input
                type="number"
                min={1} max={10}
                value={form.impact_score}
                onChange={e => setForm(f => ({ ...f, impact_score: parseInt(e.target.value) }))}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of the signal"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={adding}
                className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-60"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Signal
              </button>
            </div>
          </form>
        </div>

        {/* Signals list */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Authority Signals</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
          ) : signals.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No authority signals tracked yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {signals.map(s => (
                <div key={s.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {s.verified
                      ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                      : <Shield className="w-5 h-5 text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{s.source}</span>
                      <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded font-medium">{s.type}</span>
                      <span className="text-xs text-slate-400">Impact: {s.impact_score}/10</span>
                    </div>
                    {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline mt-0.5 block truncate">
                        {s.url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!s.verified && (
                      <button
                        onClick={() => verifySignal(s.id)}
                        className="text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        Verify
                      </button>
                    )}
                    <button onClick={() => deleteSignal(s.id)} className="text-slate-300 hover:text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
