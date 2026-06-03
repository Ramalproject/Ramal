import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}

export async function analyzeContentWithClaude(params: {
  content: string
  url: string
  keywords: string[]
}): Promise<{ strengths: string[]; weaknesses: string[]; suggestions: string[] }> {
  const client = getClient()
  const { content, url, keywords } = params

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `Analyze this web page content for GEO (Generative Engine Optimization) — how likely AI engines like ChatGPT, Gemini, and Perplexity are to cite this page.

URL: ${url}
Target keywords: ${keywords.join(', ')}

Content excerpt:
${content.slice(0, 3000)}

Return a JSON object with exactly these fields:
{
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}

Each array should have 3-5 items. Be specific and actionable. Output only valid JSON.`,
      },
    ],
  })

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { strengths: [], weaknesses: [], suggestions: [] }
  } catch {
    return { strengths: [], weaknesses: [], suggestions: [] }
  }
}

export async function generateOptimizedContent(params: {
  originalContent: string
  keywords: string[]
  brand: string
  improvements: string[]
}): Promise<string> {
  const client = getClient()
  const { originalContent, keywords, brand, improvements } = params

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `You are a GEO (Generative Engine Optimization) expert. Rewrite and improve the following content so AI engines are more likely to cite it.

Brand: ${brand}
Target keywords: ${keywords.join(', ')}
Areas to improve: ${improvements.join(', ')}

Original content:
${originalContent.slice(0, 2000)}

Write improved content that:
1. Directly answers common questions about this topic
2. Uses clear H2/H3 heading structure
3. Includes a FAQ section with 5-6 questions
4. Cites statistics and data points
5. Has strong E-E-A-T signals
6. Is 1500-2000 words

Return the full improved content in markdown format.`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function rankInPrompt(params: {
  prompt: string
  brand: string
  competitors: string[]
}): Promise<{ rank: number | null; mentioned: boolean; context: string }> {
  const client = getClient()
  const { prompt, brand, competitors } = params

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 800,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const answer = message.content[0].type === 'text' ? message.content[0].text : ''
  const lower = answer.toLowerCase()
  const brandLower = brand.toLowerCase()
  const mentioned = lower.includes(brandLower)

  let rank: number | null = null
  if (mentioned) {
    const allBrands = [brand, ...competitors].filter(b => lower.includes(b.toLowerCase()))
    const sorted = allBrands.sort((a, b) => lower.indexOf(a.toLowerCase()) - lower.indexOf(b.toLowerCase()))
    rank = sorted.indexOf(brand) + 1
  }

  const idx = lower.indexOf(brandLower)
  const context = mentioned ? answer.substring(Math.max(0, idx - 60), idx + 200) : ''

  return { rank, mentioned, context }
}
