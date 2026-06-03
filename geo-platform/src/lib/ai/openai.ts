import OpenAI from 'openai'

let _client: OpenAI | null = null

function getClient() {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

export async function generateGeoContent(params: {
  type: 'blog' | 'faq' | 'comparison' | 'snippet' | 'product'
  topic: string
  keywords: string[]
  brand: string
  tone?: string
}): Promise<string> {
  const { type, topic, keywords, brand, tone = 'professional' } = params
  const client = getClient()

  const systemPrompt = `You are an expert GEO (Generative Engine Optimization) content writer.
Your goal is to write content that AI engines like ChatGPT, Gemini, and Perplexity will cite and reference.
Always include:
- Clear, direct answers to questions
- Proper heading structure (H2, H3)
- FAQ sections when relevant
- Data points and statistics
- E-E-A-T signals (author credibility, citations)
- Conversational yet authoritative tone`

  const userPrompt = type === 'faq'
    ? `Write a comprehensive FAQ section about "${topic}" for ${brand}.
       Target keywords: ${keywords.join(', ')}.
       Include 8-10 questions with thorough answers.
       Format as Q&A pairs ready for FAQPage schema.
       Tone: ${tone}.`
    : type === 'comparison'
    ? `Write a detailed comparison article: "${topic}" for ${brand}.
       Target keywords: ${keywords.join(', ')}.
       Include a comparison table, pros/cons, and clear recommendations.
       Make it citation-worthy for AI engines.
       Tone: ${tone}.`
    : type === 'snippet'
    ? `Write an AI-optimized featured snippet answer for: "${topic}"
       Brand: ${brand}. Target keywords: ${keywords.join(', ')}.
       Keep it under 300 words. Be direct and factual.
       Start with a direct answer sentence.`
    : `Write a comprehensive, GEO-optimized ${type} about "${topic}" for ${brand}.
       Target keywords: ${keywords.join(', ')}.
       Include: introduction, main sections with H2/H3 headings, FAQ section, conclusion.
       Make it authoritative and citation-worthy for AI engines.
       Word count: 1500-2000 words. Tone: ${tone}.`

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  })

  return completion.choices[0]?.message?.content || ''
}

export async function analyzePromptVisibility(params: {
  prompt: string
  brand: string
  competitors: string[]
}): Promise<{ mentioned: boolean; position: number | null; snippet: string; competitors: string[] }> {
  const client = getClient()
  const { prompt, brand, competitors } = params

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant. Answer the user\'s question naturally and comprehensively.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 1000,
  })

  const answer = completion.choices[0]?.message?.content || ''
  const lowerAnswer = answer.toLowerCase()
  const lowerBrand = brand.toLowerCase()

  const mentioned = lowerAnswer.includes(lowerBrand)
  const mentionedCompetitors = competitors.filter(c => lowerAnswer.includes(c.toLowerCase()))

  // Estimate position (which paragraph mentions the brand)
  let position: number | null = null
  if (mentioned) {
    const paragraphs = answer.split('\n').filter(p => p.trim().length > 20)
    const idx = paragraphs.findIndex(p => p.toLowerCase().includes(lowerBrand))
    position = idx >= 0 ? idx + 1 : null
  }

  const snippet = mentioned
    ? answer.substring(Math.max(0, lowerAnswer.indexOf(lowerBrand) - 50), lowerAnswer.indexOf(lowerBrand) + 200)
    : ''

  return { mentioned, position, snippet, competitors: mentionedCompetitors }
}

export async function generateSchemaMarkup(content: string, type: string): Promise<string> {
  const client = getClient()
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Generate valid JSON-LD schema markup. Output only the JSON object, no markdown.',
      },
      {
        role: 'user',
        content: `Generate ${type} schema markup for this content:\n\n${content.slice(0, 2000)}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 1000,
  })
  return completion.choices[0]?.message?.content || '{}'
}
