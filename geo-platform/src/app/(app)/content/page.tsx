'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Zap, Loader2, Copy, Check, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

type ContentType = 'blog' | 'faq' | 'comparison' | 'snippet' | 'product'

interface ContentPiece {
  id: string
  type: ContentType
  topic: string
  content: string
  created_at: string
}

export default function ContentPage() {
  const [type, setType] = useState<ContentType>('blog')
  const [topic, setTopic] = useState('')
  const [keywords, setKeywords] = useState('')
  const [brand, setBrand] = useState('')
  const [tone, setTone] = useState('professional')
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState('')
  const [history, setHistory] = useState<ContentPiece[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
    const res = await fetch('/api/content')
    if (res.ok) setHistory(await res.json())
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setGenerated('')
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          topic,
          keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
          brand,
          tone,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setGenerated(data.content)
      await fetchHistory()
    } catch (err: any) {
      toast.error(err.message || 'Generation failed')
    }
    setLoading(false)
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;top:-9999px'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  async function deleteContent(id: string) {
    await fetch(`/api/content?id=${id}`, { method: 'DELETE' })
    setHistory(h => h.filter(c => c.id !== id))
    toast.success('Deleted')
  }

  const contentTypes: { value: ContentType; label: string; desc: string }[] = [
    { value: 'blog', label: 'Blog Post', desc: '1500-2000 word GEO-optimized article' },
    { value: 'faq', label: 'FAQ Section', desc: '8-10 Q&A pairs with FAQPage schema' },
    { value: 'comparison', label: 'Comparison', desc: 'Table + pros/cons + recommendations' },
    { value: 'snippet', label: 'Featured Snippet', desc: 'Under 300 words, direct answer format' },
    { value: 'product', label: 'Product Page', desc: 'AI-optimized product description' },
  ]

  return (
    <div className="flex flex-col flex-1">
      <Header title="AI Content Generator" subtitle="Create content optimized to be cited by AI engines" />
      <div className="flex-1 p-6 grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Generate Content</h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Content Type</label>
                <div className="space-y-2">
                  {contentTypes.map(ct => (
                    <label key={ct.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${type === ct.value ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" value={ct.value} checked={type === ct.value} onChange={e => setType(e.target.value as ContentType)} className="mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-slate-900">{ct.label}</div>
                        <div className="text-xs text-slate-400">{ct.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Topic / Title</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  required
                  placeholder="Best GEO strategies for 2025"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                <input
                  type="text"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keywords</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="GEO, AI search, citation optimization"
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tone</label>
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="professional">Professional</option>
                  <option value="conversational">Conversational</option>
                  <option value="authoritative">Authoritative</option>
                  <option value="friendly">Friendly</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {loading ? 'Generating…' : 'Generate Content'}
              </button>
            </form>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Recent</h3>
              <div className="space-y-2">
                {history.slice(0, 10).map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-2 hover:bg-slate-50 rounded-lg">
                    <button className="text-sm text-left text-slate-700 truncate flex-1" onClick={() => setGenerated(c.content)}>
                      <span className="text-xs text-violet-600 font-medium uppercase mr-1">{c.type}</span>
                      {c.topic}
                    </button>
                    <button onClick={() => deleteContent(c.id)} className="text-slate-400 hover:text-rose-500 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Output */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 h-full flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Generated Content</h3>
              {generated && (
                <button
                  onClick={() => copy(generated)}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
            <div className="flex-1 p-6 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Generating AI-optimized content…</p>
                  </div>
                </div>
              ) : generated ? (
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{generated}</pre>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Zap className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Configure options and click Generate</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
