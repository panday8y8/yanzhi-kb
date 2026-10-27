import fs from 'node:fs'
import path from 'node:path'
import { parseRawDoc, countChars, sectionText } from './parse'
import {
  DOMAIN_LABEL,
  DOMAINS,
  PAGE_TYPES,
  TYPE_LABEL,
  type Citation,
  type Domain,
  type PageBlock,
  type PageType,
  type RawDoc,
  type RawSection,
  type WikiManifest,
  type WikiPage,
} from './types'

const GENERIC_TOKENS = new Set([
  '管理', '机制', '流程', '规则', '制度', '要求', '相关', '工作', '内容', '标准',
  '体系', '进行', '以及', '或者', '一个', '我们', '需要', '可以', '通过', '负责',
])

const PROCESS_HEADING = /流程|步骤|时限|路径|响应|周期|时间|节点|处置|回滚|冻结|演练|归档|保存|销毁|复评/
const BOUNDARY_HEADING = /例外|边界|升级|责任|禁止|前提|条件|风险|约束|范围/

function hash36(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36).slice(0, 6)
}

export function topicSlug(topic: string, glossary: Record<string, string>): string {
  const mapped = glossary[topic]
  if (mapped) return mapped
  return `t-${hash36(topic)}`
}

function topicTokens(topic: string): string[] {
  const tokens = new Set<string>([topic])
  for (let index = 0; index + 2 <= topic.length; index += 1) {
    const token = topic.slice(index, index + 2)
    if (!GENERIC_TOKENS.has(token)) tokens.add(token)
  }
  return [...tokens]
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let cursor = haystack.indexOf(needle)
  while (cursor >= 0 && count < 12) {
    count += 1
    cursor = haystack.indexOf(needle, cursor + needle.length)
  }
  return count
}

function sectionScore(section: RawSection, topic: string): number {
  let score = 0
  if (section.heading.includes(topic)) score += 6
  for (const token of topicTokens(topic)) {
    if (section.heading.includes(token)) score += 2
  }
  const body = [...section.paras, ...section.bullets].join(' ')
  for (const token of topicTokens(topic)) {
    score += Math.min(3, countOccurrences(body, token))
  }
  return score
}

function firstSentence(text: string, max = 72): string {
  const cleaned = text.replace(/\s+/g, '').trim()
  const match = cleaned.match(/^(.{8,}?[。；！？])/)
  const sentence = match ? match[1] : cleaned
  return sentence.length > max ? `${sentence.slice(0, max)}…` : sentence
}

function uniqueByText<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    const value = key(item)
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(item)
  }
  return result
}

export function loadRawDocs(dir: string): RawDoc[] {
  const files = fs
    .readdirSync(dir)
    .filter(name => name.endsWith('.md'))
    .sort()
  const docs: RawDoc[] = []
  for (const fileName of files) {
    const text = fs.readFileSync(path.join(dir, fileName), 'utf8')
    const doc = parseRawDoc(fileName, text)
    if (doc) docs.push(doc)
  }
  return docs
}

interface IncludedSection {
  doc: RawDoc
  section: RawSection
  score: number
}

export function compileWiki(docs: RawDoc[], glossary: Record<string, string> = {}): { pages: WikiPage[]; manifest: WikiManifest } {
  if (!docs.length) throw new Error('content/raw 下没有可编译的原始资料')

  // 1. 主题 → 文档与得分
  const topicDocs = new Map<string, { doc: RawDoc; score: number }[]>()
  for (const doc of docs) {
    for (const topic of doc.topics) {
      const score = doc.sections.reduce((sum, section) => sum + sectionScore(section, topic), 0)
      const bucket = topicDocs.get(topic) ?? []
      bucket.push({ doc, score: score + 1 })
      topicDocs.set(topic, bucket)
    }
  }

  // 2. 主题共现（用于互链），双向对称
  const pairWeights = new Map<string, number>()
  for (const doc of docs) {
    const topics = [...new Set(doc.topics)].sort()
    for (let i = 0; i < topics.length; i += 1) {
      for (let j = i + 1; j < topics.length; j += 1) {
        const key = [topics[i], topics[j]].sort().join('||')
        pairWeights.set(key, (pairWeights.get(key) ?? 0) + 1)
      }
    }
  }

  const topicOrder = [...topicDocs.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const slugByTopic = new Map(topicOrder.map(topic => [topic, topicSlug(topic, glossary)]))
  const titleByTopic = new Map(topicOrder.map(topic => [topic, topic]))

  const pages: WikiPage[] = []

  for (const topic of topicOrder) {
    const contributors = (topicDocs.get(topic) ?? []).slice().sort((a, b) => b.score - a.score || (a.doc.docId < b.doc.docId ? -1 : 1))

    // 3. 选取证据小节：每份文档最多 4 节（流程/边界小节补位），最多 4 份文档
    const included: IncludedSection[] = []
    for (const { doc } of contributors) {
      if (included.length >= 12) break
      const scored = doc.sections
        .map(section => ({ doc, section, score: sectionScore(section, topic) }))
        .sort((a, b) => b.score - a.score || doc.sections.indexOf(a.section) - doc.sections.indexOf(b.section))
      const positive = scored.filter(item => item.score > 0)
      const picked = positive.slice(0, 4)
      for (const item of positive) {
        if (picked.length >= 5) break
        if (picked.includes(item)) continue
        if (PROCESS_HEADING.test(item.section.heading) || BOUNDARY_HEADING.test(item.section.heading)) picked.push(item)
      }
      const chosen = picked.length ? picked : [{ doc, section: doc.sections[0], score: 0 }]
      for (const item of chosen) {
        if (included.some(existing => existing.doc.docId === item.doc.docId && existing.section === item.section)) continue
        included.push(item)
      }
      if (new Set(included.map(item => item.doc.docId)).size >= 4) break
    }

    // 4. 类型与业务域：按被采纳小节的得分加权
    const typeScore = new Map<PageType, number>()
    const domainScore = new Map<Domain, number>()
    for (const item of included) {
      const weight = Math.max(1, item.score)
      typeScore.set(item.doc.type, (typeScore.get(item.doc.type) ?? 0) + weight)
      domainScore.set(item.doc.domain, (domainScore.get(item.doc.domain) ?? 0) + weight)
    }
    const dominantType = [...typeScore.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]
    const dominantDomain = [...domainScore.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]

    // 5. 引用编号：同一 (文档, 小节) 复用同一个编号
    const citations: Citation[] = []
    const citationIndex = new Map<string, number>()
    const cite = (doc: RawDoc, section: RawSection): number => {
      const key = `${doc.docId}#${section.heading}`
      const existing = citationIndex.get(key)
      if (existing) return existing
      const n = citations.length + 1
      citationIndex.set(key, n)
      citations.push({
        n,
        docId: doc.docId,
        docTitle: doc.title,
        section: section.heading,
        quote: firstSentence(section.paras[0] ?? section.bullets[0] ?? section.heading, 96),
      })
      return n
    }

    // 6. 组装正文块
    const blocks: PageBlock[] = []
    const used: string[] = []
    const normalize = (text: string) => text.replace(/[\s。；，、：;:"'“”‘’（）()【】[\]·]/g, '')
    const isUsed = (text: string) => {
      const value = normalize(text)
      if (!value) return true
      return used.some(existing => existing === value || existing.includes(value) || value.includes(existing))
    }
    const markUsed = (text: string) => used.push(normalize(text))
    const pushBlock = (heading: string, paras: PageBlock['paras'], bullets: PageBlock['bullets']) => {
      if (!paras.length && !bullets.length) return
      blocks.push({ heading, paras, bullets })
    }

    const DEFINITION_HEADING = /定义|范围|适用|概述|背景|目标|原则|总则|职责/
    const definitionPick =
      included.find(item => DEFINITION_HEADING.test(item.section.heading) && item.section.paras.length) ??
      included.find(item => item.section.paras.length) ??
      included[0]
    const definitionParas = definitionPick
      ? definitionPick.section.paras.slice(0, 2).map(text => ({ text, citations: [cite(definitionPick.doc, definitionPick.section)] }))
      : []
    const summarySource = definitionParas[0]?.text ?? contributors[0].doc.summary
    definitionParas.forEach(item => markUsed(item.text))
    pushBlock('定义与范围', definitionParas, [])

    const ruleBullets: PageBlock['bullets'] = []
    for (const item of included) {
      if (item === definitionPick) continue
      for (const bullet of item.section.bullets) {
        if (ruleBullets.length >= 8) break
        if (isUsed(bullet)) continue
        markUsed(bullet)
        ruleBullets.push({ text: bullet, citations: [cite(item.doc, item.section)] })
      }
    }
    if (ruleBullets.length < 3) {
      for (const item of included) {
        if (item === definitionPick) continue
        for (const paragraph of item.section.paras) {
          if (ruleBullets.length >= 5) break
          for (const sentence of paragraph.split(/(?<=[。；])/).map(part => part.trim()).filter(Boolean)) {
            if (ruleBullets.length >= 5) break
            if (isUsed(sentence)) continue
            markUsed(sentence)
            ruleBullets.push({ text: sentence, citations: [cite(item.doc, item.section)] })
          }
        }
      }
    }
    pushBlock('执行要点', [], ruleBullets)

    const processBullets: PageBlock['bullets'] = []
    const processParas: PageBlock['paras'] = []
    for (const item of included) {
      if (!PROCESS_HEADING.test(item.section.heading)) continue
      if (item !== definitionPick) {
        for (const bullet of item.section.bullets) {
          if (processBullets.length >= 6) break
          if (isUsed(bullet)) continue
          markUsed(bullet)
          processBullets.push({ text: bullet, citations: [cite(item.doc, item.section)] })
        }
      }
      for (const paragraph of item.section.paras) {
        if (processParas.length >= 2 || isUsed(paragraph)) continue
        markUsed(paragraph)
        processParas.push({ text: paragraph, citations: [cite(item.doc, item.section)] })
      }
    }
    pushBlock('流程与时限', processParas, processBullets)

    const boundaryBullets: PageBlock['bullets'] = []
    const boundaryParas: PageBlock['paras'] = []
    for (const item of included) {
      if (!BOUNDARY_HEADING.test(item.section.heading)) continue
      if (item !== definitionPick) {
        for (const bullet of item.section.bullets) {
          if (boundaryBullets.length >= 5) break
          if (isUsed(bullet)) continue
          markUsed(bullet)
          boundaryBullets.push({ text: bullet, citations: [cite(item.doc, item.section)] })
        }
      }
      for (const paragraph of item.section.paras) {
        if (boundaryParas.length >= 2 || isUsed(paragraph)) continue
        markUsed(paragraph)
        boundaryParas.push({ text: paragraph, citations: [cite(item.doc, item.section)] })
      }
    }
    pushBlock('边界与例外', boundaryParas, boundaryBullets)

    // 6.5 剩余内容收口：避免长文档的关键细节被截断
    const extraBullets: PageBlock['bullets'] = []
    const extraParas: PageBlock['paras'] = []
    for (const item of included) {
      for (const bullet of item.section.bullets) {
        if (extraBullets.length >= 4) break
        if (isUsed(bullet)) continue
        markUsed(bullet)
        extraBullets.push({ text: bullet, citations: [cite(item.doc, item.section)] })
      }
    }
    if (extraBullets.length < 2) {
      for (const item of included) {
        for (const paragraph of item.section.paras) {
          if (extraParas.length >= 2 || isUsed(paragraph)) continue
          markUsed(paragraph)
          extraParas.push({ text: paragraph, citations: [cite(item.doc, item.section)] })
        }
      }
    }
    pushBlock('执行细节', extraParas, extraBullets)

    // 7. 互链：共现权重优先，最多 5 条
    const neighbors = topicOrder
      .filter(other => other !== topic)
      .map(other => ({
        topic: other,
        weight: pairWeights.get([topic, other].sort().join('||')) ?? 0,
      }))
      .filter(item => item.weight > 0)
      .sort((a, b) => b.weight - a.weight || (a.topic < b.topic ? -1 : 1))
      .slice(0, 5)
      .map(item => ({ slug: slugByTopic.get(item.topic) ?? topicSlug(item.topic, glossary), title: titleByTopic.get(item.topic) ?? item.topic }))

    const sourceDocIds = [...new Set(included.map(item => item.doc.docId))]
    const updatedAt = included
      .map(item => item.doc.updated)
      .filter(Boolean)
      .sort()
      .at(-1) ?? ''

    pages.push({
      slug: slugByTopic.get(topic) ?? topicSlug(topic, glossary),
      title: topic,
      type: dominantType,
      domain: dominantDomain,
      summary: firstSentence(summarySource, 60),
      topics: [topic],
      links: neighbors,
      citations,
      blocks,
      sourceDocIds,
      updatedAt,
      weight: sourceDocIds.length,
    })
  }

  // 8. 清单
  const manifest: WikiManifest = {
    compiledAt: new Date().toISOString(),
    pages: pages.length,
    sources: docs.length,
    citations: pages.reduce((sum, page) => sum + page.citations.length, 0),
    links: pages.reduce((sum, page) => sum + page.links.length, 0),
    domains: DOMAINS.map(domain => ({ domain, pages: pages.filter(page => page.domain === domain).length })),
    types: PAGE_TYPES.map(type => ({ type, pages: pages.filter(page => page.type === type).length })),
    sourceDocs: docs.map(doc => ({
      docId: doc.docId,
      title: doc.title,
      domain: doc.domain,
      topics: doc.topics,
      sections: doc.sections.length,
    })),
  }

  return { pages, manifest }
}

export function renderPageMarkdown(page: WikiPage): string {
  const frontmatter = [
    '---',
    `slug: ${page.slug}`,
    `title: ${page.title}`,
    `type: ${page.type}`,
    `domain: ${page.domain}`,
    `updated: ${page.updatedAt}`,
    `summary: ${page.summary}`,
    `topics: ${JSON.stringify(page.topics)}`,
    `sources: ${JSON.stringify(page.citations)}`,
    `links: ${JSON.stringify(page.links)}`,
    '---',
    '',
    `# ${page.title}`,
    '',
    `> ${page.summary}`,
    '',
  ]
  const body: string[] = []
  for (const block of page.blocks) {
    body.push(`## ${block.heading}`, '')
    for (const paragraph of block.paras) {
      body.push(`${paragraph.text}${paragraph.citations.map(n => ` [${n}]`).join('')}`, '')
    }
    for (const bullet of block.bullets) {
      body.push(`- ${bullet.text}${bullet.citations.map(n => ` [${n}]`).join('')}`)
    }
    if (block.bullets.length) body.push('')
  }
  if (page.links.length) {
    body.push('## 相关主题', '')
    for (const link of page.links) body.push(`- [[${link.slug}|${link.title}]]`)
    body.push('')
  }
  body.push('## 引用来源', '')
  for (const citation of page.citations) body.push(`${citation.n}. ${citation.docTitle} · ${citation.section} —— ${citation.quote}`)
  body.push('')
  return [...frontmatter, ...body].join('\n')
}

export function renderIndexMarkdown(pages: WikiPage[], manifest: WikiManifest): string {
  const lines = [
    '# 知识库索引',
    '',
    `编译时间：${manifest.compiledAt}`,
    `知识页：${manifest.pages} · 来源资料：${manifest.sources} · 来源引用：${manifest.citations} · 互链：${manifest.links}`,
    '',
  ]
  for (const domain of DOMAINS) {
    const items = pages.filter(page => page.domain === domain).sort((a, b) => (a.slug < b.slug ? -1 : 1))
    if (!items.length) continue
    lines.push(`## ${DOMAIN_LABEL[domain]}（${items.length}）`, '')
    for (const page of items) lines.push(`- [${page.title}](./${page.slug}.md) · ${TYPE_LABEL[page.type]} · ${page.citations.length} 条引用`)
    lines.push('')
  }
  return lines.join('\n')
}

export function writeCompileArtifacts(root: string, pages: WikiPage[], manifest: WikiManifest): { pagesJsonPath: string; manifestPath: string } {
  const wikiDir = path.join(root, 'content', 'wiki')
  fs.mkdirSync(wikiDir, { recursive: true })
  const keep = new Set(pages.map(page => `${page.slug}.md`))
  for (const fileName of fs.readdirSync(wikiDir)) {
    if (fileName.endsWith('.md') && fileName !== 'index.md' && fileName !== 'log.md' && !keep.has(fileName)) {
      fs.rmSync(path.join(wikiDir, fileName))
    }
  }
  for (const page of pages) {
    fs.writeFileSync(path.join(wikiDir, `${page.slug}.md`), renderPageMarkdown(page), 'utf8')
  }
  fs.writeFileSync(path.join(wikiDir, 'index.md'), renderIndexMarkdown(pages, manifest), 'utf8')
  const pagesJsonPath = path.join(wikiDir, 'pages.json')
  fs.writeFileSync(pagesJsonPath, JSON.stringify({ compiledAt: manifest.compiledAt, pages }, null, 2), 'utf8')
  const manifestPath = path.join(wikiDir, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  const logPath = path.join(wikiDir, 'log.md')
  const logLine = `- ${manifest.compiledAt} · 编译 ${manifest.sources} 份原始资料 → ${manifest.pages} 个知识页（${manifest.citations} 引用 / ${manifest.links} 互链）\n`
  if (fs.existsSync(logPath)) fs.appendFileSync(logPath, logLine, 'utf8')
  else fs.writeFileSync(logPath, `# 编译日志\n\n${logLine}`, 'utf8')
  return { pagesJsonPath, manifestPath }
}

export function compileAll(root: string, glossary?: Record<string, string>): { pages: WikiPage[]; manifest: WikiManifest; docs: RawDoc[] } {
  const docs = loadRawDocs(path.join(root, 'content', 'raw'))
  const { pages, manifest } = compileWiki(docs, glossary ?? {})
  writeCompileArtifacts(root, pages, manifest)
  return { pages, manifest, docs }
}

export function readCompiledPages(root: string): { compiledAt: string; pages: WikiPage[] } {
  const file = path.join(root, 'content', 'wiki', 'pages.json')
  if (!fs.existsSync(file)) return { compiledAt: '', pages: [] }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as { compiledAt: string; pages: WikiPage[] }
}

export { countChars, sectionText }



