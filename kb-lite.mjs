#!/usr/bin/env node
// 砚知 · 最小可跑版（零依赖，Node 24）
// 用法：
//   node kb-lite.mjs "版本发布要过哪几道门禁？"
//   DEEPSEEK_API_KEY=sk-xxx node kb-lite.mjs "版本发布要过哪几道门禁？" --ask
import fs from 'node:fs'
import path from 'node:path'

const RAW = 'content/raw'

// 1. 读资料：frontmatter + ## 小节
function readDocs() {
  return fs
    .readdirSync(RAW)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      const text = fs.readFileSync(path.join(RAW, name), 'utf8')
      const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
      const meta = {}
      if (match) {
        for (const line of match[1].split('\n')) {
          const at = line.indexOf(':')
          if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim()
        }
      }
      const body = match ? text.slice(match[0].length) : text
      const sections = []
      let current = null
      for (const raw of body.split('\n')) {
        const line = raw.trim()
        if (line.startsWith('## ')) {
          current = { heading: line.slice(3), lines: [] }
          sections.push(current)
        } else if (line && current) {
          current.lines.push(line)
        }
      }
      return {
        id: meta.doc_id || name,
        title: meta.title || name,
        domain: meta.domain || '',
        topics: (meta.topics || '').replace(/[\[\]]/g, '').split(',').map((s) => s.trim()).filter(Boolean),
        sections: sections.map((s) => ({ heading: s.heading, text: s.lines.join('\n') })),
      }
    })
}

// 2. 切证据：一个小节一条
function toChunks(docs) {
  return docs.flatMap((doc) =>
    doc.sections.map((section) => ({
      docId: doc.id,
      docTitle: doc.title,
      heading: section.heading,
      text: section.text,
      topics: doc.topics,
    })),
  )
}

// 3. 中文二元分词 + 打分（命中越多分越高，标题与小节名加权）
function tokens(text) {
  const lower = text.toLowerCase()
  const out = lower.match(/[a-z0-9]+/g) || []
  for (const run of lower.match(/[\u4e00-\u9fa5]+/g) || []) {
    for (let i = 0; i + 1 < run.length; i++) out.push(run.slice(i, i + 2))
  }
  return out
}

function score(chunk, queryTokens) {
  const hay = `${chunk.docTitle} ${chunk.heading} ${chunk.text}`
  let total = 0
  for (const token of queryTokens) {
    if (hay.includes(token)) total += chunk.heading.includes(token) ? 2 : 1
  }
  return total
}

function search(query, chunks) {
  const queryTokens = [...new Set(tokens(query))]
  return chunks
    .map((chunk) => ({ chunk, score: score(chunk, queryTokens) }))
    .filter((item) => item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

// 4. 可选：把命中证据交给 DeepSeek，只允许它依据证据回答
async function ask(question, hits) {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) {
    console.log('\n（未配置 DEEPSEEK_API_KEY，下面只展示本地证据）')
    return
  }
  const evidence = hits.map((hit, i) => `[${i + 1}] ${hit.chunk.docTitle} · ${hit.chunk.heading}\n${hit.chunk.text}`).join('\n\n')
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是企业知识库助手。只能依据证据回答，每个结论后用 [n] 标注证据编号；证据不足就说不知道。' },
        { role: 'user', content: `问题：${question}\n\n证据：\n${evidence}` },
      ],
      temperature: 0.2,
      max_tokens: 600,
    }),
  })
  const data = await response.json()
  console.log('\n答案：\n' + (data.choices?.[0]?.message?.content || JSON.stringify(data)))
}

// 5. 跑起来
const question = process.argv[2] || '版本发布要过哪几道门禁？'
const wantsAsk = process.argv.includes('--ask')
const docs = readDocs()
const chunks = toChunks(docs)
const hits = search(question, chunks)

console.log(`资料 ${docs.length} 份 · 证据 ${chunks.length} 条 · 问题：「${question}」\n`)
if (!hits.length) {
  console.log('本地没有检索到相关证据。换个说法，或补充资料。')
  process.exit(0)
}
for (const [i, hit] of hits.entries()) {
  console.log(`[${i + 1}] ${hit.chunk.docTitle} · ${hit.chunk.heading}（命中 ${hit.score}）`)
  console.log(hit.chunk.text.split('\n').slice(0, 2).join('\n').slice(0, 120) + '…\n')
}
if (wantsAsk) await ask(question, hits)
