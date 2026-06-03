import * as cheerio from 'cheerio'
import type { ScanResult, HeadingNode, EeatSignals, ScanIssue } from '@/types'

export async function scanWebsite(url: string): Promise<ScanResult> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`

  const res = await fetch(normalizedUrl, {
    headers: { 'User-Agent': 'GeoSaaS-Scanner/1.0 (compatible; GEO audit bot)' },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`Failed to fetch page: ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)
  const base = new URL(normalizedUrl)

  // Core meta
  const title = $('title').text().trim() || $('h1').first().text().trim()
  const metaDesc = $('meta[name="description"]').attr('content') || ''

  // Headings
  const headings: HeadingNode[] = []
  $('h1,h2,h3,h4,h5,h6').each((_, el) => {
    const level = parseInt(el.tagName.replace('h', ''))
    headings.push({ level, text: $(el).text().trim() })
  })

  // Schema types
  const schemaTypes: string[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}')
      const types = Array.isArray(json) ? json.map((j: any) => j['@type']) : [json['@type']]
      types.flat().filter(Boolean).forEach((t: string) => schemaTypes.push(t))
    } catch {}
  })

  // FAQ / HowTo detection
  const hasFaq = schemaTypes.some(t => t === 'FAQPage') ||
    !!$('[class*="faq"],[id*="faq"],details,summary').length

  const hasHowTo = schemaTypes.some(t => t === 'HowTo') ||
    !!$('[class*="how-to"],[class*="howto"],[class*="steps"]').length

  // Word count
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const wordCount = bodyText.split(/\s+/).length

  // Reading level (Flesch-Kincaid approximation)
  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 10).length
  const words = wordCount
  const syllables = estimateSyllables(bodyText)
  const fk = sentences > 0 ? 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words) : 50
  const readingLevel = fk >= 70 ? 'Middle School' : fk >= 50 ? 'High School' : 'College'

  // Links
  let internalLinks = 0, externalLinks = 0
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    try {
      const linkUrl = new URL(href, base)
      if (linkUrl.hostname === base.hostname) internalLinks++
      else externalLinks++
    } catch {}
  })

  // Images with alt
  let imagesWithAlt = 0
  $('img').each((_, el) => { if ($(el).attr('alt')) imagesWithAlt++ })

  // E-E-A-T signals
  const pageText = bodyText.toLowerCase()
  const eeat: EeatSignals = {
    has_author: !!$('[class*="author"],[rel="author"],[itemprop="author"]').length,
    has_date: !!$('time,[class*="date"],[itemprop="datePublished"]').length,
    has_citations: externalLinks >= 2,
    has_about_page: pageText.includes('about us') || pageText.includes('our team'),
    has_contact_page: pageText.includes('contact') || !!$('a[href*="contact"]').length,
    has_privacy_policy: !!$('a[href*="privacy"]').length,
  }

  // Issues
  const issues: ScanIssue[] = []
  if (!title) issues.push({ type: 'meta', severity: 'error', message: 'Missing page title', fix: 'Add a descriptive <title> tag' })
  if (!metaDesc) issues.push({ type: 'meta', severity: 'warning', message: 'Missing meta description', fix: 'Add a 150-160 char meta description' })
  if (!schemaTypes.length) issues.push({ type: 'schema', severity: 'error', message: 'No structured data found', fix: 'Add Article or FAQPage JSON-LD schema' })
  if (!hasFaq) issues.push({ type: 'content', severity: 'warning', message: 'No FAQ section detected', fix: 'Add an FAQ section with FAQPage schema' })
  if (wordCount < 500) issues.push({ type: 'content', severity: 'warning', message: 'Low word count', fix: 'Expand content to at least 800 words for AI citations' })
  if (!eeat.has_author) issues.push({ type: 'eeat', severity: 'warning', message: 'No author information', fix: 'Add author name and bio with schema markup' })
  if (internalLinks < 3) issues.push({ type: 'links', severity: 'info', message: 'Few internal links', fix: 'Add 5+ internal links to related content' })

  return {
    url: normalizedUrl,
    title,
    meta_description: metaDesc,
    schema_types: [...new Set(schemaTypes)],
    has_faq: hasFaq,
    has_how_to: hasHowTo,
    heading_structure: headings,
    word_count: wordCount,
    reading_level: readingLevel,
    internal_links: internalLinks,
    external_links: externalLinks,
    images_with_alt: imagesWithAlt,
    page_speed_score: null,
    eeat_signals: eeat,
    issues,
  }
}

function estimateSyllables(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
  return words.reduce((count, word) => {
    const matches = word.match(/[aeiouy]+/g)
    return count + (matches ? matches.length : 1)
  }, 0)
}
