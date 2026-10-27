import fs from 'node:fs'
import path from 'node:path'
import { compileAll, loadRawDocs, readCompiledPages } from '../lib/compiler'
import { getMeta, loadChunks, setMeta, syncIndex } from '../lib/db'
import { buildGraph, layoutGraph } from '../lib/graph'
import { runEval } from '../lib/eval'
import { OUTPUT_DIR, ROOT, TOPIC_GLOSSARY } from '../lib/paths'

function readGlossary(): Record<string, string> {
  if (!fs.existsSync(TOPIC_GLOSSARY)) return {}
  try {
    return JSON.parse(fs.readFileSync(TOPIC_GLOSSARY, 'utf8')) as Record<string, string>
  } catch {
    console.warn('⚠ content/topics.json 解析失败，回退到哈希 slug')
    return {}
  }
}

function line(char = '─', length = 54) {
  return char.repeat(length)
}

function compile(): { pages: number; sources: number; citations: number; links: number } {
  const started = Date.now()
  const { pages, manifest } = compileAll(ROOT, readGlossary())
  const docs = loadRawDocs(path.join(ROOT, 'content', 'raw'))
  const index = syncIndex(pages, docs, manifest.compiledAt)
  console.log(`\n📚 知识编译完成（${Date.now() - started}ms）`)
  console.log(line())
  console.log(`原始资料    ${manifest.sources} 份 → 知识页 ${manifest.pages} 个`)
  console.log(`来源引用    ${manifest.citations} 条 · 互链 ${manifest.links} 组`)
  console.log(`领域分布    ${manifest.domains.map(item => `${item.domain}:${item.pages}`).join('  ')}`)
  console.log(`页面类型    ${manifest.types.map(item => `${item.type}:${item.pages}`).join('  ')}`)
  console.log(`SQLite      ${index.chunks} 个证据片段已入库`)
  console.log(`输出        content/wiki/*.md · content/wiki/pages.json`)
  return { pages: manifest.pages, sources: manifest.sources, citations: manifest.citations, links: manifest.links }
}

function graph(): { nodes: number; edges: number } {
  const { pages } = readCompiledPages(ROOT)
  const docs = loadRawDocs(path.join(ROOT, 'content', 'raw'))
  const data = buildGraph(pages, docs)
  const layout = layoutGraph(data)
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUTPUT_DIR, 'kg_nodes.json'), JSON.stringify(data.nodes, null, 2))
  fs.writeFileSync(path.join(OUTPUT_DIR, 'kg_edges.json'), JSON.stringify(data.edges, null, 2))
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'kg_meta.json'),
    JSON.stringify({ ...data.meta, laidOut: layout.nodes.length }, null, 2),
  )
  const byKind = new Map<string, number>()
  for (const node of data.nodes) byKind.set(node.kind, (byKind.get(node.kind) ?? 0) + 1)
  const byRelation = new Map<string, number>()
  for (const edge of data.edges) byRelation.set(edge.relation, (byRelation.get(edge.relation) ?? 0) + 1)
  console.log(`\n🕸  知识图谱抽取完成`)
  console.log(line())
  console.log(`节点        ${data.nodes.length} 个（${[...byKind].map(([kind, count]) => `${kind} ${count}`).join(' · ')}）`)
  console.log(`边          ${data.edges.length} 条（${[...byRelation].map(([relation, count]) => `${relation} ${count}`).join(' · ')}）`)
  console.log(`输出        output/kg_nodes.json · kg_edges.json · kg_meta.json`)
  return { nodes: data.nodes.length, edges: data.edges.length }
}

function evaluate(): { score: number; passed: number; total: number } {
  let chunks = loadChunks()
  if (!chunks.length) {
    compile()
    chunks = loadChunks()
  }
  const report = runEval(chunks)
  fs.mkdirSync(path.join(OUTPUT_DIR, 'eval'), { recursive: true })
  fs.writeFileSync(path.join(OUTPUT_DIR, 'eval', 'report.json'), JSON.stringify(report, null, 2))
  setMeta('eval:latest', JSON.stringify(report))
  console.log(`\n🧪 可复现评估（12 道固定题，本地链路不消耗模型额度）`)
  console.log(line())
  for (const [key, value] of Object.entries(report.metrics)) {
    console.log(`${value.label.padEnd(6, '　')} ${value.value === null ? '—' : value.value.toFixed(3)}  (n=${value.n})`.padEnd(24) + `  ${key}`)
  }
  console.log(line())
  console.log(`通过        ${report.passed}/${report.total}`)
  console.log(`总分        ${report.score}`)
  const failed = report.cases.filter(item => item.status === 'fail')
  for (const item of failed) console.log(`  ✗ ${item.id} ${item.notes.join('；')}`)
  console.log(`报告        output/eval/report.json`)
  return { score: report.score, passed: report.passed, total: report.total }
}

const command = process.argv[2] ?? 'compile'

if (command === 'compile') {
  compile()
} else if (command === 'graph') {
  graph()
} else if (command === 'eval') {
  evaluate()
} else if (command === 'init') {
  const c = compile()
  const g = graph()
  const e = evaluate()
  console.log(`\n✅ 初始化完成：${c.sources} 份资料 → ${c.pages} 页知识 / ${g.nodes} 节点 ${g.edges} 边 / 评估 ${e.score} 分`)
} else {
  console.log('用法：pnpm kb:<compile|graph|eval|init>')
  process.exit(1)
}

void (getMeta('compiled_at') ?? '')
