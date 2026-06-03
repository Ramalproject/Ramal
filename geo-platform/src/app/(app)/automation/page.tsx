'use client'
import { useState } from 'react'
import Header from '@/components/layout/Header'
import { Bot, Zap, Clock, Globe, Brain } from 'lucide-react'

const automations = [
  {
    id: 'weekly-scan',
    icon: Globe,
    title: 'Weekly GEO Scan',
    desc: 'Auto-scan all your projects every Monday at 9am and email you the GEO report.',
    color: 'text-blue-600 bg-blue-50',
    status: 'Pro',
  },
  {
    id: 'mention-alert',
    icon: Brain,
    title: 'Mention Alerts',
    desc: 'Get notified instantly when your brand is (or isn\'t) cited in tracked AI prompts.',
    color: 'text-violet-600 bg-violet-50',
    status: 'Pro',
  },
  {
    id: 'content-schedule',
    icon: Zap,
    title: 'Content Scheduler',
    desc: 'Auto-generate and schedule GEO-optimized content on a weekly cadence.',
    color: 'text-amber-600 bg-amber-50',
    status: 'Agency',
  },
  {
    id: 'competitor-watch',
    icon: Clock,
    title: 'Competitor Watch',
    desc: 'Automatically scan competitor URLs weekly and alert you when their GEO score changes.',
    color: 'text-emerald-600 bg-emerald-50',
    status: 'Agency',
  },
  {
    id: 'schema-deploy',
    icon: Bot,
    title: 'Schema Auto-Deploy',
    desc: 'Automatically generate and provide schema markup via API for your CMS to consume.',
    color: 'text-rose-600 bg-rose-50',
    status: 'Agency',
  },
]

export default function AutomationPage() {
  const [upgradeShown, setUpgradeShown] = useState(false)

  return (
    <div className="flex flex-col flex-1">
      <Header title="AI Automation" subtitle="Put your GEO optimization on autopilot" />
      <div className="flex-1 p-6 space-y-6">
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 flex items-center gap-4">
          <Bot className="w-8 h-8 text-violet-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-violet-900">Automation is available on Pro and Agency plans</h3>
            <p className="text-sm text-violet-700 mt-0.5">Upgrade to enable automated GEO scans, mention alerts, and content scheduling.</p>
          </div>
          <a href="/settings#billing" className="flex-shrink-0 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors">
            Upgrade
          </a>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {automations.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-5 relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${a.status === 'Pro' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>
                  {a.status}
                </span>
              </div>
              <div className={`inline-flex p-2.5 rounded-xl mb-3 ${a.color}`}>
                <a.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1 pr-12">{a.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{a.desc}</p>
              <button
                onClick={() => setUpgradeShown(true)}
                className="mt-4 w-full bg-slate-100 text-slate-600 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              >
                Enable
              </button>
            </div>
          ))}
        </div>

        {upgradeShown && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
              <Bot className="w-12 h-12 text-violet-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Upgrade to unlock automations</h3>
              <p className="text-sm text-slate-500 mb-6">Automation features are available on Pro ($149/mo) and Agency ($399/mo) plans.</p>
              <div className="flex gap-3">
                <button onClick={() => setUpgradeShown(false)} className="flex-1 border border-slate-300 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50">
                  Cancel
                </button>
                <a href="/pricing" className="flex-1 bg-violet-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-violet-700 text-center">
                  View Plans
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
