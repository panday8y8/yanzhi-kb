import { DOMAINS, PAGE_TYPES, type Domain, type PageType, type RawDoc, type RawSection } from './types'

/** 把 YAML 子集值解析成字符串/数字/数组；本项目只使用最朴素的 key: value。 */
function parseValue(raw: string): unknown {
  const value = raw.trim()
  if (!value) return ''
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => part.replace(/^['"]|['"]$/g, ''))
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?\d+$/.test(value)) return Number(value)
  return value.replace(/^['"]|['"]$/g, '')
}

export function parseFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return { data: {}, body: normalized.trim() }
  const data: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const index = line.indexOf(':')
    if (index < 0) continue
    const key = line.slice(0, index).trim()
    data[key] = parseValue(line.slice(index + 1))
  }
  return { data, body: normalized.slice(match[0].length).trim() }
}

/** 正文切块：## 二级标题 → 小节，- 开头 → 列表项，其余按空行分段。 */
export function parseSections(body: string): RawSection[] {
  const sections: RawSection[] = []
  let current: RawSection | null = null
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length && current) {
      const text = paragraph.join('').trim()
      if (text) current.paras.push(text)
    }
    paragraph = []
  }

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      flushParagraph()
      continue
    }
    if (line.startsWith('## ')) {
      flushParagraph()
      current = { heading: line.slice(3).trim(), paras: [], bullets: [] }
      sections.push(current)
      continue
    }
    if (!current) {
      current = { heading: '概述', paras: [], bullets: [] }
      sections.push(current)
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph()
      current.bullets.push(line.replace(/^[-*]\s+/, '').trim())
      continue
    }
    paragraph.push(line)
  }
  flushParagraph()
  return sections.filter(section => section.heading !== '概述' || section.paras.length || section.bullets.length)
}

export function sectionText(section: RawSection): string {
  return [section.heading, ...section.paras, ...section.bullets].join(' ')
}

export function countChars(text: string): number {
  return (text.match(/[\u4e00-\u9fa5]|[A-Za-z0-9]/g) ?? []).length
}

const asString = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const asArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).map(item => item.trim()).filter(Boolean) : []

/** 读取并校验一份原始资料，返回 null 表示该文件不是知识库语料。 */
export function parseRawDoc(fileName: string, text: string): RawDoc | null {
  const { data, body } = parseFrontmatter(text)
  const docId = asString(data.doc_id)
  const title = asString(data.title)
  if (!docId || !title) return null
  const domain = asString(data.domain) as Domain
  const type = asString(data.type) as PageType
  if (!DOMAINS.includes(domain) || !PAGE_TYPES.includes(type)) return null
  const sections = parseSections(body)
  if (!sections.length) return null
  return {
    docId,
    title,
    domain,
    type,
    owner: asString(data.owner, '未指定'),
    updated: asString(data.updated, ''),
    tags: asArray(data.tags),
    topics: asArray(data.topics),
    summary: asString(data.summary, sections[0].paras[0] ?? ''),
    sections,
    body,
    chars: sections.reduce((sum, section) => sum + countChars(sectionText(section)), 0),
    fileName,
  }
}
