'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Bot, Plus, Trash2, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface Prompt {
  id: string
  prompt: string
  category: string
  is_active: boolean
  created_at: string
}

const CATEGORIES = ['Brand', 'Product', 'Industry', 'FAQ', 'Competitor', 'Other']

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [category, setCategory] = useState('Brand')

  useEffect(() => { fetchPrompts() }, [])

  async function fetchPrompts() {
    const res = await fetch('/api/prompts')
    if (res.ok) setPrompts(await res.json())
    setLoading(false)
  }

  async function addPrompt(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, category }),
    })
    if (res.ok) {
      const data = await res.json()
      setPrompts(p => [data, ...p])
      setText('')
      toast.success('Prompt added')
    }
    setAdding(false)
  }

  async function togglePrompt(id: string, current: boolean) {
    const res = await fetch(`/api/prompts`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !current }),
    })
    if (res.ok) setPrompts(p => p.map(x => x.id === id ? { ...x, is_active: !current } : x))
  }

  async function deletePrompt(id: string) {
    await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' })
    setPrompts(p => p.filter(x => x.id !== id))
    toast.success('Deleted')
  }

  const active = prompts.filter(p => p.is_active).length

  return (
    <div className="flex flex-col flex-1">
      <Header title="Prompt Monitoring" subtitle="Track which prompts trigger AI citations of your brand" />
      <div className="flex-1 p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Prompts', value: prompts.length },
            { label: 'Active', value: active },
            { label: 'Categories', value: [...new Set(prompts.map(p => p.category))].length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 text-center">
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-sm text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Add form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Add Prompt to Track</h2>
          <form onSubmit={addPrompt} className="flex gap-3">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              required
              rows={2}
              placeholder="What are the best GEO tools for content optimization?"
              className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
            <div className="flex flex-col gap-2">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <button
                type="submit"
                disabled={adding}
                className="flex items-center justify-center gap-1.5 bg-violet-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-60"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
          </form>
        </div>

        {/* Prompts list */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Tracked Prompts</h3>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
          ) : prompts.length === 0 ? (
            <div className="py-12 text-center">
              <Bot className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No prompts added yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {prompts.map(p => (
                <div key={p.id} className={`px-6 py-4 flex items-start gap-3 ${!p.is_active ? 'opacity-50' : ''}`}>
                  <button onClick={() => togglePrompt(p.id, p.is_active)} className="mt-0.5 flex-shrink-0">
                    {p.is_active
                      ? <ToggleRight className="w-5 h-5 text-violet-600" />
                      : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">{p.prompt}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-violet-600 font-medium bg-violet-50 px-2 py-0.5 rounded">{p.category}</span>
                      <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => deletePrompt(p.id)} className="text-slate-300 hover:text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
