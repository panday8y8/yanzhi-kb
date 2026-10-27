import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { chunksFromPages } from '../lib/chunks'
import { compileWiki, loadRawDocs } from '../lib/compiler'
import { runEval } from '../lib/eval'
import { NO_EVIDENCE_THRESHOLD, search, toEvidence } from '../lib/retrieval'

const ROOT = process.cwd()
const glossary = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'topics.json'), 'utf8')) as Record<string, string>
const docs = loadRawDocs(path.join(ROOT, 'content', 'raw'))
const { pages } = compileWiki(docs, glossary)
const chunks = chunksFromPages(pages)

test('检索：门禁问题命中「发布门禁」页', () => {
  const hits = search('版本发布要过哪几道门禁？', chunks, { limit: 4 })
  assert.ok(hits.length > 0)
  assert.equal(hits[0].pageTitle, '发布门禁')
})

test('检索：同一问句两次结果完全一致', () => {
  const first = search('缺料分几级？', chunks, { limit: 4 })
  const second = search('缺料分几级？', chunks, { limit: 4 })
  assert.deepEqual(first, second)
})

test('检索：无证据问题不返回可用证据', () => {
  for (const question of ['员工食堂周末几点开饭？', '2027 年校招计划招多少人？']) {
    const hits = search(question, chunks, { limit: 4 })
    const usable = hits.filter(hit => hit.score >= NO_EVIDENCE_THRESHOLD)
    assert.equal(usable.length, 0, `${question} 不应返回证据`)
  }
})

test('评估：12 道固定题全部通过，总分 100', () => {
  const report = runEval(chunks)
  assert.equal(report.total, 12)
  assert.equal(report.passed, 12, JSON.stringify(report.cases.filter(item => item.status !== 'pass')))
  assert.equal(report.score, 100)
  const again = runEval(chunks)
  assert.equal(again.passed, report.passed)
  assert.equal(JSON.stringify(again.cases), JSON.stringify(report.cases))
})

test('证据：编号连续且带来源页', () => {
  const hits = search('新供应商准入要走哪些步骤？', chunks, { limit: 4 })
  const evidence = toEvidence(hits.filter(hit => hit.score >= NO_EVIDENCE_THRESHOLD), 10)
  assert.ok(evidence.length > 0)
  evidence.forEach((item, index) => {
    assert.equal(item.n, index + 1)
    assert.ok(item.pageTitle.length > 0)
    assert.ok(item.text.length > 0)
  })
})
