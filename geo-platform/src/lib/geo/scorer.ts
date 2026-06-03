import type { ScanResult, GeoScore, Recommendation } from '@/types'

interface ScoreBreakdown {
  ai_readability: number
  semantic_relevance: number
  authority_signals: number
  content_structure: number
  schema_implementation: number
  faq_optimization: number
  external_mentions: number
  citation_quality: number
}

export function computeGeoScore(scan: ScanResult, keywords: string[]): Omit<GeoScore, 'id' | 'project_id' | 'scanned_at'> {
  const breakdown = scoreBreakdown(scan, keywords)
  const weights = {
    ai_readability:      0.18,
    semantic_relevance:  0.16,
    authority_signals:   0.14,
    content_structure:   0.14,
    schema_implementation: 0.12,
    faq_optimization:    0.12,
    external_mentions:   0.08,
    citation_quality:    0.06,
  }
  const total = Math.round(
    Object.entries(weights).reduce((sum, [key, w]) =>
      sum + breakdown[key as keyof ScoreBreakdown] * w, 0)
  )
  return {
    total_score: Math.min(100, total),
    ...breakdown,
    recommendations: buildRecommendations(scan, breakdown),
  }
}

function scoreBreakdown(scan: ScanResult, keywords: string[]): ScoreBreakdown {
  return {
    ai_readability:      scoreReadability(scan),
    semantic_relevance:  scoreSemanticRelevance(scan, keywords),
    authority_signals:   scoreAuthority(scan),
    content_structure:   scoreStructure(scan),
    schema_implementation: scoreSchema(scan),
    faq_optimization:    scoreFaq(scan),
    external_mentions:   scoreExternalMentions(scan),
    citation_quality:    scoreCitations(scan),
  }
}

function scoreReadability(scan: ScanResult): number {
  let score = 50
  if (scan.word_count >= 800)  score += 15
  if (scan.word_count >= 1500) score += 10
  if (scan.reading_level === 'College') score += 10
  if (scan.reading_level === 'High School') score += 15
  if (scan.reading_level === 'Middle School') score += 20
  if (scan.images_with_alt > 0) score += 5
  if (scan.meta_description && scan.meta_description.length > 100) score += 10
  return Math.min(100, score)
}

function scoreSemanticRelevance(scan: ScanResult, keywords: string[]): number {
  if (!keywords.length) return 50
  const content = [scan.title, scan.meta_description, ...scan.heading_structure.map(h => h.text)].join(' ').toLowerCase()
  const found = keywords.filter(kw => content.includes(kw.toLowerCase())).length
  const ratio = found / keywords.length
  let score = Math.round(ratio * 70) + 30
  if (ratio === 1) score += 15
  return Math.min(100, score)
}

function scoreAuthority(scan: ScanResult): number {
  let score = 30
  if (scan.eeat_signals.has_author)        score += 15
  if (scan.eeat_signals.has_date)          score += 10
  if (scan.eeat_signals.has_citations)     score += 15
  if (scan.eeat_signals.has_about_page)    score += 10
  if (scan.eeat_signals.has_contact_page)  score += 10
  if (scan.eeat_signals.has_privacy_policy) score += 10
  return Math.min(100, score)
}

function scoreStructure(scan: ScanResult): number {
  let score = 30
  const h2Count = scan.heading_structure.filter(h => h.level === 2).length
  const h3Count = scan.heading_structure.filter(h => h.level === 3).length
  if (h2Count >= 3)  score += 20
  if (h3Count >= 3)  score += 15
  if (scan.internal_links >= 3)  score += 15
  if (scan.internal_links >= 10) score += 10
  if (scan.title && scan.title.length > 30) score += 10
  return Math.min(100, score)
}

function scoreSchema(scan: ScanResult): number {
  if (!scan.schema_types.length) return 10
  let score = 30
  const highValue = ['Article', 'FAQPage', 'HowTo', 'Product', 'Organization', 'WebPage']
  const found = scan.schema_types.filter(t => highValue.includes(t)).length
  score += found * 15
  return Math.min(100, score)
}

function scoreFaq(scan: ScanResult): number {
  let score = 20
  if (scan.has_faq)    score += 50
  if (scan.has_how_to) score += 30
  return Math.min(100, score)
}

function scoreExternalMentions(scan: ScanResult): number {
  const links = scan.external_links
  if (links >= 10) return 90
  if (links >= 5)  return 70
  if (links >= 2)  return 50
  if (links >= 1)  return 35
  return 15
}

function scoreCitations(scan: ScanResult): number {
  let score = 30
  if (scan.eeat_signals.has_citations) score += 40
  if (scan.external_links >= 3)        score += 20
  if (scan.eeat_signals.has_date)      score += 10
  return Math.min(100, score)
}

function buildRecommendations(scan: ScanResult, scores: ScoreBreakdown): Recommendation[] {
  const recs: Recommendation[] = []

  if (scores.schema_implementation < 60) {
    recs.push({
      category: 'Schema',
      priority: 'high',
      title: 'Add FAQPage Schema Markup',
      description: 'FAQPage and Article schema dramatically improves AI engine citation probability.',
      impact: 18,
    })
  }
  if (!scan.has_faq) {
    recs.push({
      category: 'Content',
      priority: 'high',
      title: 'Add an FAQ Section',
      description: 'FAQ sections are cited 3x more frequently by AI engines than regular content.',
      impact: 15,
    })
  }
  if (scores.authority_signals < 60) {
    recs.push({
      category: 'Authority',
      priority: 'high',
      title: 'Strengthen E-E-A-T Signals',
      description: 'Add author bios, publication dates, citations, and About/Contact pages.',
      impact: 14,
    })
  }
  if (scan.word_count < 800) {
    recs.push({
      category: 'Content',
      priority: 'medium',
      title: 'Expand Content Depth',
      description: 'Pages under 800 words rarely appear in AI-generated answers. Target 1500+ words.',
      impact: 12,
    })
  }
  if (scores.semantic_relevance < 70) {
    recs.push({
      category: 'SEO',
      priority: 'medium',
      title: 'Improve Keyword Integration',
      description: 'Target keywords should appear in H1, H2s, meta description, and introduction.',
      impact: 10,
    })
  }
  if (!scan.eeat_signals.has_citations) {
    recs.push({
      category: 'Authority',
      priority: 'medium',
      title: 'Add Data Sources and Citations',
      description: 'Link to authoritative sources. AI engines prefer citing pages with external references.',
      impact: 10,
    })
  }
  if (scores.content_structure < 60) {
    recs.push({
      category: 'Structure',
      priority: 'medium',
      title: 'Improve Heading Hierarchy',
      description: 'Use a clear H1 → H2 → H3 hierarchy with descriptive headings AI can parse.',
      impact: 8,
    })
  }
  if (scan.internal_links < 3) {
    recs.push({
      category: 'Structure',
      priority: 'low',
      title: 'Increase Internal Linking',
      description: 'Add at least 5 internal links to related content to improve topical authority.',
      impact: 6,
    })
  }

  return recs.sort((a, b) => b.impact - a.impact).slice(0, 8)
}
