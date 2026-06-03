import Link from 'next/link'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Free',
    price: 0,
    desc: 'Try Ramal with no commitment.',
    features: ['3 scans per month', 'Basic GEO score', '1 project', 'Community support'],
    cta: 'Get started free',
    href: '/register',
    highlight: false,
  },
  {
    name: 'Starter',
    price: 49,
    desc: 'Perfect for solopreneurs and bloggers.',
    features: ['100 scans/month', 'Full GEO score', '5 projects', 'AI content (20 pieces/mo)', 'Email support'],
    cta: 'Start Starter',
    href: '/register?plan=starter',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 149,
    desc: 'For growing brands and content teams.',
    features: ['500 scans/month', 'Advanced GEO score', '25 projects', 'AI content (100 pieces/mo)', 'Competitor tracking (10)', 'Prompt monitoring (50)', 'Priority support'],
    cta: 'Start Pro',
    href: '/register?plan=pro',
    highlight: true,
  },
  {
    name: 'Agency',
    price: 399,
    desc: 'Unlimited everything for agencies.',
    features: ['Unlimited scans', 'Full suite', 'Unlimited projects', 'Unlimited AI content', 'Unlimited competitors', 'Unlimited prompts', 'White-label reports', 'Dedicated support'],
    cta: 'Start Agency',
    href: '/register?plan=agency',
    highlight: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-100 px-6 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold text-slate-900">Ramal</Link>
        <div className="flex gap-3">
          <Link href="/login" className="text-sm text-slate-600 px-4 py-2 hover:text-slate-900">Log in</Link>
          <Link href="/register" className="text-sm bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700">Get started</Link>
        </div>
      </nav>

      <section className="py-20 px-6 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Simple, transparent pricing</h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">Start free. Upgrade when you need more power.</p>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map(p => (
            <div key={p.name} className={`rounded-2xl p-6 border ${p.highlight ? 'border-violet-500 bg-violet-50 relative' : 'border-slate-200 bg-white'}`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <div className="mb-5">
                <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{p.desc}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-slate-900">${p.price}</span>
                  {p.price > 0 && <span className="text-slate-400 text-sm">/mo</span>}
                </div>
              </div>
              <ul className="space-y-2.5 mb-6">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <Check className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors ${p.highlight ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
