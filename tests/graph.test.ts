import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { compileWiki, loadRawDocs } from '../lib/compiler'
import { buildGraph, layoutGraph } from '../lib/graph'

const ROOT = process.cwd()
const glossary = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'topics.json'), 'utf8')) as Record<string, string>
const docs = loadRawDocs(path.join(ROOT, 'content', 'raw'))
const { pages } = compileWiki(docs, glossary)
const graph = buildGraph(pages, docs)

test('图谱：节点与边的数量符合四类节点 / 四种语义', () => {
  assert.equal(graph.nodes.filter(node => node.kind === 'PAGE').length, 27)
  assert.equal(graph.nodes.filter(node => node.kind === 'SOURCE').length, 12)
  assert.equal(graph.nodes.filter(node => node.kind === 'DOMAIN').length, 6)
  assert.equal(graph.nodes.filter(node => node.kind === 'TYPE').length, 4)
  assert.equal(graph.nodes.length, 49)
  const relations = new Set(graph.edges.map(edge => edge.relation))
  assert.deepEqual([...relations].sort(), ['CITES', 'IN_DOMAIN', 'LINKS_TO', 'OF_TYPE'])
})

test('图谱：没有自环，边两端都存在', () => {
  const ids = new Set(graph.nodes.map(node => node.id))
  for (const edge of graph.edges) {
    assert.notEqual(edge.source, edge.target)
    assert.ok(ids.has(edge.source))
    assert.ok(ids.has(edge.target))
  }
})

test('图谱：内链指向真实页面，抽取结果可复现', () => {
  const links = graph.edges.filter(edge => edge.relation === 'LINKS_TO')
  const pageIds = new Set(pages.map(page => `page:${page.slug}`))
  assert.ok(links.length > 40)
  for (const edge of links) {
    assert.ok(pageIds.has(edge.source) && pageIds.has(edge.target))
  }
  assert.equal(JSON.stringify(buildGraph(pages, docs).edges), JSON.stringify(graph.edges))
})

test('布局：每个节点都有坐标，且落在画布范围内', () => {
  const layout = layoutGraph(graph)
  assert.equal(layout.nodes.length, graph.nodes.length)
  for (const node of layout.nodes) {
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y))
    assert.ok(node.x >= -40 && node.x <= layout.width + 40)
    assert.ok(node.y >= -40 && node.y <= layout.height + 40)
  }
})

