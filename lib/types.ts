export const DOMAINS = ['engineering', 'manufacturing', 'quality', 'supply', 'security', 'people'] as const
export type Domain = (typeof DOMAINS)[number]

export const PAGE_TYPES = ['policy', 'system', 'playbook', 'concept'] as const
export type PageType = (typeof PAGE_TYPES)[number]

export const DOMAIN_LABEL: Record<Domain, string> = {
  engineering: '研发',
  manufacturing: '制造',
  quality: '质量',
  supply: '供应链',
  security: '安全',
  people: '人力',
}

export const TYPE_LABEL: Record<PageType, string> = {
  policy: '制度',
  system: '系统',
  playbook: '手册',
  concept: '概念',
}

export interface RawSection {
  heading: string
  paras: string[]
  bullets: string[]
}

export interface RawDoc {
  docId: string
  title: string
  domain: Domain
  type: PageType
  owner: string
  updated: string
  tags: string[]
  topics: string[]
  summary: string
  sections: RawSection[]
  body: string
  chars: number
  fileName: string
}

export interface Citation {
  n: number
  docId: string
  docTitle: string
  section: string
  quote: string
}

export interface PageBlock {
  heading: string
  paras: { text: string; citations: number[] }[]
  bullets: { text: string; citations: number[] }[]
}

export interface WikiPage {
  slug: string
  title: string
  type: PageType
  domain: Domain
  summary: string
  topics: string[]
  links: { slug: string; title: string }[]
  citations: Citation[]
  blocks: PageBlock[]
  sourceDocIds: string[]
  updatedAt: string
  weight: number
}

export interface WikiManifest {
  compiledAt: string
  pages: number
  sources: number
  citations: number
  links: number
  domains: { domain: Domain; pages: number }[]
  types: { type: PageType; pages: number }[]
  sourceDocs: { docId: string; title: string; domain: Domain; topics: string[]; sections: number }[]
}

export interface GraphNode {
  id: string
  name: string
  kind: 'PAGE' | 'SOURCE' | 'DOMAIN' | 'TYPE'
  domain?: Domain
  pageType?: PageType
  degree: number
}

export interface GraphEdge {
  source: string
  target: string
  relation: 'LINKS_TO' | 'CITES' | 'IN_DOMAIN' | 'OF_TYPE'
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  meta: { generatedAt: string; pages: number; sources: number; domains: number; types: number }
}

export interface Chunk {
  id: number
  pageSlug: string
  pageTitle: string
  section: string
  text: string
  domain: Domain
  tags: string[]
  docIds: string[]
}

export interface SearchHit {
  chunk: Chunk
  score: number
  matched: string[]
}

export interface EvidenceItem {
  n: number
  pageSlug: string
  pageTitle: string
  section: string
  text: string
  quote: string
  score: number
  sourceDoc: string | null
  domain: Domain
}

export interface AskAnswer {
  status: 'answered' | 'no_evidence'
  confidence: 'high' | 'medium' | 'low'
  answer: string
  citations: number[]
  evidence: EvidenceItem[]
  mode: 'deepseek' | 'local'
  model: string | null
  latencyMs: number
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null }
  notice?: string
}

export interface EvalCase {
  id: string
  question: string
  expectPages: string[]
  keywords: string[]
  minPages?: number
  kind: 'answer' | 'no_evidence'
}

export interface EvalCaseResult {
  id: string
  question: string
  status: 'pass' | 'fail'
  retrievalHit: boolean | null
  citationValid: boolean
  citationCoverage: boolean | null
  answerKeywords: boolean | null
  evidenceCoverage: boolean | null
  answerHonest: boolean
  citedPages: string[]
  score: number
  topPages: string[]
  notes: string[]
}

export interface EvalReport {
  generatedAt: string
  total: number
  passed: number
  score: number
  metrics: Record<string, { label: string; value: number | null; n: number }>
  cases: EvalCaseResult[]
}

