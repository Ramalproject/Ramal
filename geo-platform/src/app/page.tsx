import Link from 'next/link'
import { ArrowRight, BarChart3, Brain, Globe, Search, Shield, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-slate-900">Ramal</span>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <Link href="/features" className="hover:text-slate-900">Features</Link>
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 px-4 py-2">Log in</Link>
            <Link href="/register" className="text-sm bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 text-sm px-4 py-1.5 rounded-full mb-8 font-medium">
            <Zap className="w-4 h-4" />
            The GEO Platform for AI-Powered Search
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight tracking-tight mb-6">
            Get cited by ChatGPT,<br />
            <span className="text-violet-600">Gemini & Perplexity</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Ramal is the all-in-one GEO platform. Scan your website, track AI mentions, score your content, and generate AI-optimized pages that get quoted by the world's leading AI engines.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-violet-700 transition-colors">
              Start for free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/features" className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-slate-200 transition-colors">
              See how it works
            </Link>
          </div>
          <p className="text-sm text-slate-400 mt-4">No credit card required · Free plan available</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '10,000+', label: 'Pages Scanned' },
            { value: '94%', label: 'Avg. Citation Lift' },
            { value: '3x', label: 'More AI Mentions' },
            { value: '48hr', label: 'Avg. Time to Results' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-bold text-slate-900 mb-1">{s.value}</div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need to win AI search</h2>
            <p className="text-slate-500 text-lg">A complete toolkit for Generative Engine Optimization.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Globe,
                title: 'Website GEO Scanner',
                desc: 'Deep-scan any URL. Get instant GEO scores, schema analysis, E-E-A-T signals, and a prioritized fix list.',
                color: 'text-blue-600 bg-blue-50',
              },
              {
                icon: Brain,
                title: 'AI Mention Tracker',
                desc: 'Monitor when and how ChatGPT, Gemini, Claude, and Perplexity mention your brand across thousands of prompts.',
                color: 'text-violet-600 bg-violet-50',
              },
              {
                icon: BarChart3,
                title: 'GEO Score Engine',
                desc: 'Proprietary 8-dimensional scoring: readability, authority, schema, FAQ optimization, semantic relevance, and more.',
                color: 'text-emerald-600 bg-emerald-50',
              },
              {
                icon: Zap,
                title: 'AI Content Generator',
                desc: 'Generate blog posts, FAQs, comparison pages, and featured snippets optimized to be cited by AI engines.',
                color: 'text-amber-600 bg-amber-50',
              },
              {
                icon: Search,
                title: 'Competitor Analysis',
                desc: 'See how competitors are being cited, what questions they answer, and where you can outrank them in AI results.',
                color: 'text-rose-600 bg-rose-50',
              },
              {
                icon: Shield,
                title: 'Authority Builder',
                desc: 'Get recommendations for backlinks, citations, and E-E-A-T improvements that boost AI citation probability.',
                color: 'text-teal-600 bg-teal-50',
              },
            ].map((f) => (
              <div key={f.title} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className={`inline-flex p-3 rounded-xl mb-4 ${f.color}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Get your first GEO score in 60 seconds</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Scan your website', desc: 'Enter your URL and target keywords. Ramal analyzes your page across 8 GEO dimensions.' },
              { step: '02', title: 'Get your GEO score', desc: 'See exactly what\'s holding back your AI citations and get a prioritized action plan.' },
              { step: '03', title: 'Optimize & track', desc: 'Generate optimized content, implement fixes, and track your brand\'s rise in AI search results.' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="text-5xl font-bold text-violet-100 mb-3">{s.step}</div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">Ready to dominate AI search?</h2>
          <p className="text-slate-500 text-lg mb-8">Join thousands of brands already optimizing for the AI era.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-violet-600 text-white px-10 py-4 rounded-xl text-lg font-semibold hover:bg-violet-700 transition-colors">
            Get started free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-bold text-slate-900">Ramal</span>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/features" className="hover:text-slate-900">Features</Link>
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
            <Link href="/login" className="hover:text-slate-900">Login</Link>
          </div>
          <p className="text-sm text-slate-400">© 2025 Ramal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
