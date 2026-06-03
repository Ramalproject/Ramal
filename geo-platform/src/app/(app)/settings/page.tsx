'use client'
import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Settings, Loader2, Save, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workspace, setWorkspace] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (user) {
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id)
        .single()
      setWorkspace(ws)
      setName(ws?.name || '')
    }
    setLoading(false)
  }

  async function saveWorkspace(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('workspaces')
      .update({ name })
      .eq('id', workspace.id)
    if (error) {
      toast.error('Failed to save')
    } else {
      toast.success('Saved!')
      setWorkspace({ ...workspace, name })
    }
    setSaving(false)
  }

  async function openPortal() {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      toast.error('Could not open billing portal')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1">
        <Header title="Settings" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        </div>
      </div>
    )
  }

  const planBadgeMap: Record<string, { label: string; color: string }> = {
    free: { label: 'Free', color: 'bg-slate-100 text-slate-700' },
    starter: { label: 'Starter', color: 'bg-blue-100 text-blue-700' },
    pro: { label: 'Pro', color: 'bg-violet-100 text-violet-700' },
    agency: { label: 'Agency', color: 'bg-amber-100 text-amber-700' },
  }
  const planBadge = planBadgeMap[workspace?.plan || 'free'] || { label: 'Free', color: 'bg-slate-100 text-slate-700' }

  return (
    <div className="flex flex-col flex-1">
      <Header title="Settings" subtitle="Manage your account and workspace" />
      <div className="flex-1 p-6 max-w-2xl space-y-6">
        {/* Account */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Account</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Email</label>
              <p className="text-sm text-slate-900">{user?.email}</p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">User ID</label>
              <p className="text-xs font-mono text-slate-400">{user?.id}</p>
            </div>
          </div>
        </div>

        {/* Workspace */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Workspace</h2>
          <form onSubmit={saveWorkspace} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Workspace name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </form>
        </div>

        {/* Billing */}
        <div id="billing" className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Billing & Plan</h2>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-slate-500">Current plan</div>
              <span className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-semibold ${planBadge.color}`}>
                {planBadge.label}
              </span>
            </div>
            {workspace?.stripe_subscription_id && (
              <button
                onClick={openPortal}
                className="flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Manage billing
              </button>
            )}
          </div>
          {workspace?.plan === 'free' && (
            <a href="/pricing" className="block w-full bg-violet-600 text-white text-center py-3 rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
              Upgrade to Pro
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
