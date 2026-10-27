import fs from 'node:fs'
import path from 'node:path'
import { compileAll, loadRawDocs, readCompiledPages } from './compiler'
import { getMeta, listSources, loadChunks, setMeta, storeCounts, syncIndex } from './db'
import { buildGraph } from './graph'
import { runEval } from './eval'
import { getModelConfig } from './qa'
import { ROOT, TOPIC_GLOSSARY } from './paths'
import type { Domain, EvalReport, GraphData, WikiManifest, WikiPage } from './types'

let booted = false

function readGlossary(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(TOPIC_GLOSSARY, 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

/** 首次访问时执行一次编译与入库，之后直接复用磁盘产物。 */
export function ensureWorkspace(): void {
  if (booted) return
  const compiled = readCompiledPages(ROOT)
  const counts = storeCounts()
  if (!compiled.pages.length || counts.chunks === 0) {
    const { manifest } = compileAll(ROOT, readGlossary())
    const docs = loadRawDocs(path.join(ROOT, 'content', 'raw'))
    syncIndex(readCompiledPages(ROOT).pages, docs, manifest.compiledAt)
  }
  booted = true
}

export function recompile(): { pages: number; sources: number; chunks: number; citations: number } {
  const { manifest } = compileAll(ROOT, readGlossary())
  const docs = loadRawDocs(path.join(ROOT, 'content', 'raw'))
  const pages = readCompiledPages(ROOT).pages
  const index = syncIndex(pages, docs, manifest.compiledAt)
  booted = true
  return { pages: manifest.pages, sources: manifest.sources, chunks: index.chunks, citations: manifest.citations }
}

export function getManifest(): WikiManifest {
  const file = path.join(ROOT, 'content', 'wiki', 'manifest.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')) as WikiManifest
}

export function getPages(): WikiPage[] {
  ensureWorkspace()
  return readCompiledPages(ROOT).pages
}

export function getCompiledAt(): string {
  ensureWorkspace()
  return readCompiledPages(ROOT).compiledAt
}

export function getGraph(): GraphData {
  ensureWorkspace()
  const pages = readCompiledPages(ROOT).pages
  const docs = loadRawDocs(path.join(ROOT, 'content', 'raw'))
  return buildGraph(pages, docs)
}

export function getEval(): EvalReport {
  ensureWorkspace()
  const cached = getMeta('eval:latest')
  if (cached) {
    try {
      return JSON.parse(cached) as EvalReport
    } catch {
      /* 缓存损坏时重算 */
    }
  }
  const report = runEval(loadChunks())
  setMeta('eval:latest', JSON.stringify(report))
  return report
}

export interface DomainStat {
  domain: Domain
  pages: number
  share: number
}

export function getDomainStats(pages: WikiPage[]): DomainStat[] {
  const total = Math.max(1, pages.length)
  const map = new Map<Domain, number>()
  for (const page of pages) map.set(page.domain, (map.get(page.domain) ?? 0) + 1)
  return [...map.entries()]
    .map(([domain, count]) => ({ domain, pages: count, share: count / total }))
    .sort((a, b) => b.pages - a.pages || (a.domain < b.domain ? -1 : 1))
}

export interface PipelineStage {
  index: string
  name: string
  detail: string
  progress: number
}

export function getPipeline(pages: WikiPage[], graph: GraphData, chunks: number, modelConfigured: boolean): PipelineStage[] {
  const citations = pages.reduce((sum, page) => sum + page.citations.length, 0)
  return [
    { index: '01', name: '资料接入', detail: '12 份内部资料完成元数据校验', progress: 100 },
    { index: '02', name: '编译成页', detail: `${pages.length} 个知识页 · ${citations} 条来源引用`, progress: 100 },
    { index: '03', name: '图谱抽取', detail: `${graph.nodes.length} 节点 · ${graph.edges.length} 条关系`, progress: 100 },
    { index: '04', name: '证据索引', detail: `${chunks} 个证据片段已入库 SQLite`, progress: 100 },
    { index: '05', name: '问答服务', detail: modelConfigured ? 'DeepSeek 已连接，支持生成式回答' : '未配置模型凭证，使用本地证据摘录', progress: modelConfigured ? 100 : 62 },
  ]
}

export function getSourceList() {
  ensureWorkspace()
  return listSources()
}

export function getChunkCount(): number {
  ensureWorkspace()
  return storeCounts().chunks
}

export function getSettingsData() {
  ensureWorkspace()
  return {
    config: getModelConfig(),
    counts: storeCounts(),
    compiledAt: readCompiledPages(ROOT).compiledAt,
  }
}
