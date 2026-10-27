import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRawDoc } from '../lib/parse'
import { getModelConfig, localAnswer } from '../lib/qa'
import type { EvidenceItem } from '../lib/types'

const EVIDENCE: EvidenceItem[] = [
  {
    n: 1,
    pageSlug: 'release-gates',
    pageTitle: '发布门禁',
    section: '执行要点',
    text: '单元测试覆盖率不低于 70%。四道门禁按顺序执行。',
    quote: '单元测试覆盖率不低于 70%。',
    score: 12,
    sourceDoc: 'eng-release',
    domain: 'engineering',
  },
]

test('frontmatter 缺失时拒绝入库', () => {
  assert.equal(parseRawDoc('bad.md', '# 没有 frontmatter\n\n## 小节\n内容'), null)
})

test('frontmatter 非法业务域时拒绝入库', () => {
  const text = '---\ndoc_id: x\ntitle: 测试\ndomain: unknown\ntype: policy\n---\n\n## 小节\n内容\n'
  assert.equal(parseRawDoc('x.md', text), null)
})

test('本地降级答案带来源编号并明确标注未经过模型', () => {
  const text = localAnswer(EVIDENCE, '当前未配置 DEEPSEEK_API_KEY')
  assert.match(text, /\[1\]/)
  assert.match(text, /本地检索结果/)
  assert.match(text, /未经过模型改写/)
})

test('模型配置在无凭证时标记为未配置', () => {
  const previous = process.env.DEEPSEEK_API_KEY
  delete process.env.DEEPSEEK_API_KEY
  const config = getModelConfig()
  assert.equal(config.configured, false)
  assert.equal(config.credentialSource, 'missing')
  if (previous !== undefined) process.env.DEEPSEEK_API_KEY = previous
})
