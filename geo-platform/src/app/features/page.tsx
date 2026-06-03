import Link from 'next/link'
import { Globe, Brain, BarChart3, Zap, Search, Shield, LineChart, Bot, ArrowRight } from 'lucide-react'

const features = [
  {
    icon: Globe,
    title: 'Website GEO Scanner',
    desc: 'Instantly scan any URL. Get a full GEO audit: schema markup, E-E-A-T signals, heading structure, reading level, word count, FAQ detection, and an 8-dimensional GEO score.',
    points: ['Detects all JSON-LD schema types', 'Flesch-Kincaid reading level analysis', 'E-E-A-T signal detection (author, date, citations)', 'Prioritized fix list by impact'],
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: Brain,
    title: 'AI Mention Tracker',
    desc: 'Test any prompt against ChatGPT, Gemini, Claude, or Perplexity and see exactly whether your brand is mentioned, what position it appears, and what competitors are cited.',
    points: ['Multi-platform support (ChatGPT, Gemini, Claude, Perplexity)', 'Mention position tracking', 'Competitor mention analysis', 'Snippet extraction'],
    color: 'text-violet-600 bg-violet-50',
  },
  {
    icon: BarChart3,
    title: 'Proprietary GEO Score',
    desc: 'Our 8-dimensional scoring algorithm calculates exactly how AI-citation-ready your content is, with weighted scores across readability, authority, schema, FAQ, and more.',
    points: ['AI Readability (18% weight)', 'Semantic Relevance (16%)', 'Authority Signals (14%)', 'Content Structure, Schema, FAQ, Citations'],
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    icon: Zap,
    title: 'AI Content Generator',
    desc: 'Generate blog posts, FAQ sections, comparison pages, featured snippets, and product descriptions — all optimized specifically to be cited by AI engines.',
    points: ['Powered by GPT-4o', 'Blog, FAQ, Comparison, Snippet, Product types', 'Keyword and brand integration', 'One-click copy'],
    color: 'text-amber-600 bg-amber-50',
  },
  {
    icon: Search,
    title: 'Competitor Analysis',
    desc: 'Add competitor URLs and scan their GEO performance. See their word count, schema types, FAQ status, external links, and GEO score compared to yours.',
    points: ['One-click competitor scan', 'Side-by-side GEO score comparison', 'Schema and FAQ gap analysis', 'External link benchmark'],
    color: 'text-rose-600 bg-rose-50',
  },
  {
    icon: Shield,
    title: 'Authority Builder',
    desc: 'Track your E-E-A-T signals: backlinks, press mentions, citations, awards, reviews, and partnerships. Verify them and see your cumulative authority impact score.',
    points: ['8 authority signal types', 'Impact scoring (1-10)', 'Verification workflow', 'Cumulative impact tracking'],
    color: 'text-teal-600 bg-teal-50',
  },
  {
    icon: LineChart,
    title: 'Analytics Dashboard',
    desc: 'Visualize your GEO performance over time. See mention rate trends, platform breakdowns, GEO score history, and top-performing prompts.',
    points: ['7, 30, and 90-day views', 'Mention rate trend charts', 'Platform breakdown (ChatGPT, Gemini, etc.)', 'Top prompt performance'],
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    icon: Bot,
    title: 'Prompt Monitoring',
    desc: 'Build a library of prompts that matter to your brand. Categorize them, activate or pause them, and run batch mention checks to track your visibility.',
    points: ['Unlimited prompt library', '6 category types', 'Active/pause toggle', 'Integration with Mention Tracker'],
    color: 'text-cyan-600 bg-cyan-50',
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-slate-100 px-6 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-xl font-bold text-slate-900">Ramal</Link>
        <div className="flex gap-3">
          <Link href="/pricing" className="text-sm text-slate-600 px-4 py-2 hover:text-slate-900">Pricing</Link>
          <Link href="/login" className="text-sm text-slate-600 px-4 py-2 hover:text-slate-900">Log in</Link>
          <Link href="/register" className="text-sm bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700">Get started</Link>
        </div>
      </nav>

      <section className="py-20 px-6 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Everything to win AI search</h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">A complete GEO platform for brands that want to appear in AI-generated answers.</p>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto space-y-12">
          {features.map((f, i) => (
            <div key={f.title} className={`grid md:grid-cols-2 gap-10 items-center ${i % 2 === 1 ? 'md:[&>div:first-child]:order-2' : ''}`}>
              <div>
                <div className={`inline-flex p-3 rounded-xl mb-4 ${f.color}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">{f.title}</h2>
                <p className="text-slate-500 leading-relaxed mb-5">{f.desc}</p>
                <ul className="space-y-2">
                  {f.points.map(p => (
                    <li key={p} className="flex items-start gap-2 text-sm text-slate-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-50 rounded-2xl border border-slate-200 h-64 flex items-center justify-center">
                <div className={`p-6 rounded-2xl ${f.color}`}>
                  <f.icon className="w-16 h-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-violet-50 py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to get started?</h2>
        <p className="text-slate-500 mb-8">Free plan available. No credit card required.</p>
        <Link href="/register" className="inline-flex items-center gap-2 bg-violet-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-violet-700 transition-colors">
          Get started free <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </div>
  )
}
