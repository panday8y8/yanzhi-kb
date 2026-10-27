import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { compileWiki, loadRawDocs } from '../lib/compiler'

const ROOT = process.cwd()
const RAW_DIR = path.join(ROOT, 'content', 'raw')
const glossary = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'topics.json'), 'utf8')) as Record<string, string>

function rawSnapshot(): string[] {
  return fs
    .readdirSync(RAW_DIR)
    .sort()
    .map(name => {
      const stat = fs.statSync(path.join(RAW_DIR, name))
      return `${name}:${stat.size}:${Math.round(stat.mtimeMs)}`
    })
}

test('12 份原始资料编译成 27 个知识页，引用与正文块齐全', () => {
  const docs = loadRawDocs(RAW_DIR)
  assert.equal(docs.length, 12)
  const { pages, manifest } = compileWiki(docs, glossary)
  assert.equal(pages.length, 27)
  assert.equal(manifest.sources, 12)
  assert.ok(manifest.citations >= 70, `引用数偏少：${manifest.citations}`)
  for (const page of pages) {
    assert.ok(page.blocks.length >= 2, `${page.slug} 正文块不足`)
    assert.ok(page.citations.length >= 2, `${page.slug} 引用不足`)
    assert.ok(page.summary.length >= 8, `${page.slug} 缺少摘要`)
  }
})

test('编译不修改 raw 源层', () => {
  const before = rawSnapshot()
  compileWiki(loadRawDocs(RAW_DIR), glossary)
  assert.deepEqual(rawSnapshot(), before)
})

test('同一输入两次编译产物完全一致（可复现）', () => {
  const first = compileWiki(loadRawDocs(RAW_DIR), glossary).pages
  const second = compileWiki(loadRawDocs(RAW_DIR), glossary).pages
  assert.equal(JSON.stringify(first), JSON.stringify(second))
})

test('互链与引用都指向真实存在的对象', () => {
  const docs = loadRawDocs(RAW_DIR)
  const { pages } = compileWiki(docs, glossary)
  const slugs = new Set(pages.map(page => page.slug))
  const docIds = new Set(docs.map(doc => doc.docId))
  for (const page of pages) {
    for (const link of page.links) assert.ok(slugs.has(link.slug), `${page.slug} 指向不存在的页 ${link.slug}`)
    for (const citation of page.citations) assert.ok(docIds.has(citation.docId), `${page.slug} 引用不存在的资料 ${citation.docId}`)
  }
})
