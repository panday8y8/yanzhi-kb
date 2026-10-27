import type { Chunk, WikiPage } from './types'

/** 知识页 → 证据片段：每个正文块一条，标题与标签参与检索加权。 */
export function chunksFromPages(pages: WikiPage[]): Chunk[] {
  const chunks: Chunk[] = []
  let id = 0
  for (const page of pages) {
    const docIds = page.citations
      .map(citation => citation.docId)
      .filter((value, index, list) => list.indexOf(value) === index)
    const tags = [page.title, ...page.topics]
    for (const block of page.blocks) {
      const lines = [...block.paras.map(item => item.text), ...block.bullets.map(item => item.text)].filter(Boolean)
      if (!lines.length) continue
      id += 1
      chunks.push({
        id,
        pageSlug: page.slug,
        pageTitle: page.title,
        section: block.heading,
        text: lines.join('\n'),
        domain: page.domain,
        tags,
        docIds,
      })
    }
  }
  return chunks
}
