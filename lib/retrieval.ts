import type { Chunk, Domain, EvidenceItem } from './types'

const K1 = 1.2
const B = 0.72

const QUERY_STOPWORDS = new Set([
  '多少', '几点', '几级', '几个', '多久', '哪些', '什么', '怎么', '如何', '是否',
  '可以', '需要', '请问', '公司', '内容', '相关', '一下', '告诉', '介绍', '我们',
])

export function tokenize(text: string): string[] {
  const lower = text.toLowerCase()
  const tokens: string[] = []
  for (const word of lower.match(/[a-z0-9][a-z0-9._-]*/g) ?? []) tokens.push(word)
  for (const run of lower.match(/[\u4e00-\u9fa5]+/g) ?? []) {
    if (run.length === 1) {
      tokens.push(run)
      continue
    }
    // 中文只取二元词，避免单字到处误命中
    for (let index = 0; index + 1 < run.length; index += 1) tokens.push(run.slice(index, index + 2))
  }
  return tokens
}

interface PageDoc {
  pageSlug: string
  pageTitle: string
  domain: Domain
  chunks: Chunk[]
  tf: Map<string, number>
  length: number
  haystack: string
}

function buildPageDocs(chunks: Chunk[]): PageDoc[] {
  const groups = new Map<string, Chunk[]>()
  for (const chunk of chunks) {
    const list = groups.get(chunk.pageSlug) ?? []
    list.push(chunk)
    groups.set(chunk.pageSlug, list)
  }
  const docs: PageDoc[] = []
  for (const [pageSlug, list] of groups) {
    list.sort((a, b) => a.id - b.id)
    const head = list[0]
    const tf = new Map<string, number>()
    let length = 0
    const add = (text: string, weight: number) => {
      const tokens = tokenize(text)
      length += tokens.length * weight
      for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + weight)
    }
    add(head.pageTitle, 3)
    add(head.tags.join(' '), 2)
    for (const chunk of list) add(`${chunk.section} ${chunk.text}`, 1)
    docs.push({
      pageSlug,
      pageTitle: head.pageTitle,
      domain: head.domain,
      chunks: list,
      tf,
      length,
      haystack: [head.pageTitle, ...list.map(chunk => `${chunk.section} ${chunk.text}`)].join(' ').toLowerCase(),
    })
  }
  return docs.sort((a, b) => (a.pageSlug < b.pageSlug ? -1 : 1))
}

export interface SearchOptions {
  limit?: number
}

export interface PageHit {
  pageSlug: string
  pageTitle: string
  domain: Domain
  score: number
  chunks: Chunk[]
}

/** 页级 BM25 检索：标题 ×3、标签 ×2、小节正文 ×1，叠加短语加权与锚点门控。 */
export function search(query: string, chunks: Chunk[], options: SearchOptions = {}): PageHit[] {
  const limit = options.limit ?? 4
  const queryTokens = tokenize(query.trim())
  const uniqueQuery = [...new Set(queryTokens)]
  if (!queryTokens.length || !chunks.length) return []
  const docs = buildPageDocs(chunks)

  const df = new Map<string, number>()
  for (const doc of docs) {
    for (const token of new Set(doc.tf.keys())) df.set(token, (df.get(token) ?? 0) + 1)
  }
  const total = docs.length
  const idf = new Map<string, number>()
  for (const [token, count] of df) idf.set(token, Math.log(1 + (total - count + 0.5) / (count + 0.5)))
  const avgLength = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(1, docs.length)

  // 锚点：查询里最具区分度的两个词，一个都不命中说明只是泛词擦边。
  const anchorTokens = uniqueQuery
    .filter(token => token.length >= 2 && !QUERY_STOPWORDS.has(token) && (idf.get(token) ?? 0) > 0.2)
    .sort((a, b) => (idf.get(b) ?? 0) - (idf.get(a) ?? 0) || (a < b ? -1 : 1))
    .slice(0, 2)

  const phrase = query.trim().toLowerCase()
  const bigramQuery = uniqueQuery.filter(token => token.length === 2)

  const hits: PageHit[] = []
  for (const doc of docs) {
    // 锚点门控：默认关闭，阈值 + 短语加权已足够区分泛词擦边
    let score = 0
    for (const token of uniqueQuery) {
      const freq = doc.tf.get(token)
      if (!freq) continue
      const weight = idf.get(token) ?? 0
      score += weight * ((freq * (K1 + 1)) / (freq + K1 * (1 - B + (B * doc.length) / avgLength)))
    }
    if (score <= 0) continue
    if (phrase.length >= 4 && doc.haystack.includes(phrase)) score += 4
    const covered = bigramQuery.filter(token => doc.haystack.includes(token)).length
    if (bigramQuery.length) score += (covered / bigramQuery.length) * 3
    void bigramQuery
    hits.push({
      pageSlug: doc.pageSlug,
      pageTitle: doc.pageTitle,
      domain: doc.domain,
      score: Math.round(score * 100) / 100,
      chunks: doc.chunks,
    })
  }

  return hits.sort((a, b) => b.score - a.score || (a.pageSlug < b.pageSlug ? -1 : 1)).slice(0, limit)
}

/** 把命中页展开成证据条目：每个小节一条，最多 10 条，编号从 1 开始。 */
export function toEvidence(hits: PageHit[], maxEvidence = 10): EvidenceItem[] {
  const evidence: EvidenceItem[] = []
  for (const hit of hits.slice(0, 3)) {
    for (const chunk of hit.chunks) {
      if (evidence.length >= maxEvidence) return evidence
      evidence.push({
        n: evidence.length + 1,
        pageSlug: hit.pageSlug,
        pageTitle: hit.pageTitle,
        section: chunk.section,
        text: chunk.text.length > 260 ? `${chunk.text.slice(0, 260)}…` : chunk.text,
        quote: chunk.text.split('\n')[0].slice(0, 92),
        score: hit.score,
        sourceDoc: chunk.docIds[0] ?? null,
        domain: hit.domain,
      })
    }
  }
  return evidence
}

export function confidenceOf(topScore: number): 'high' | 'medium' | 'low' {
  if (topScore >= 14) return 'high'
  if (topScore >= 7) return 'medium'
  return 'low'
}

export const NO_EVIDENCE_THRESHOLD = 4



