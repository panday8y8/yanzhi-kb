'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { IconCheck, IconUpload } from './Icons'
import { DOMAIN_COLOR, DOMAIN_NAME, TYPE_NAME, formatDate } from '../lib/display'
import type { Domain } from '../lib/types'

interface SourceItem {
  docId: string
  title: string
  domain: Domain
  type: keyof typeof TYPE_NAME
  owner: string
  updated: string
  tags: string[]
  topics: string[]
  summary: string
  chars: number
  sections: number
}

const DOMAINS_ORDER: Domain[] = ['engineering', 'manufacturing', 'quality', 'supply', 'security', 'people']

export function SourcesView({ sources }: { sources: SourceItem[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState<Domain | 'all'>('all')
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const value = query.trim()
    return sources.filter(source => {
      const domainOk = domain === 'all' || source.domain === domain
      const queryOk = !value || `${source.title}${source.summary}${source.tags.join('')}${source.topics.join('')}`.includes(value)
      return domainOk && queryOk
    })
  }, [sources, query, domain])

  const submit = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string; summary?: string }
      if (!response.ok || !payload.ok) {
        setMessage({ ok: false, text: payload.error ?? '上传失败' })
      } else {
        setMessage({ ok: true, text: payload.summary ?? '已入库并重新编译' })
        setText('')
        setOpen(false)
        router.refresh()
      }
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : '网络错误' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="filter-bar">
        <input className="input" placeholder="搜索标题、标签或主题" value={query} onChange={event => setQuery(event.target.value)} />
        <button type="button" className="suggestion" onClick={() => setDomain('all')} style={domain === 'all' ? { color: 'var(--seal)', borderColor: 'var(--seal)' } : undefined}>
          全部域
        </button>
        {DOMAINS_ORDER.map(item => (
          <button
            key={item}
            type="button"
            className="suggestion"
            style={domain === item ? { color: DOMAIN_COLOR[item], borderColor: DOMAIN_COLOR[item] } : undefined}
            onClick={() => setDomain(item)}
          >
            {DOMAIN_NAME[item]}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 11.5 }}>
          共 {filtered.length} / {sources.length} 份
        </span>
        <button type="button" className="btn btn-solid btn-sm" onClick={() => setOpen(value => !value)}>
          <IconUpload size={13} />
          新增资料
        </button>
      </div>

      {message && (
        <div className={message.ok ? 'result-ok' : 'result-bad'} style={{ marginBottom: 12 }}>
          {message.ok ? <IconCheck size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} /> : null}
          {message.text}
        </div>
      )}

      {open && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">新增原始资料</div>
              <div className="panel-hint">必须带 frontmatter：doc_id / title / domain / type / topics / summary</div>
            </div>
            <span className="tag">Markdown</span>
          </div>
          <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              className="input"
              style={{ height: 180, padding: 12, lineHeight: 1.7, fontFamily: 'var(--mono)', fontSize: 12 }}
              placeholder={'---\ndoc_id: ops-handover\ntitle: 值班交接规范\ndomain: manufacturing\ntype: playbook\nupdated: 2026-09-01\n...\n---\n\n## 交接范围\n…'}
              value={text}
              onChange={event => setText(event.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button type="button" className="btn btn-seal btn-sm" onClick={() => void submit()} disabled={busy || !text.trim()}>
                {busy ? '编译中…' : '保存并重新编译'}
              </button>
              <span className="muted" style={{ fontSize: 11 }}>
                保存到 content/raw/，随后重新编译全部知识页、重建索引
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="source-grid">
        {filtered.map(source => (
          <article className="source-tile" key={source.docId}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="tag" style={{ color: DOMAIN_COLOR[source.domain], borderColor: 'var(--line-strong)' }}>
                <span className="dot-domain" style={{ background: DOMAIN_COLOR[source.domain], display: 'inline-block' }} />
                {DOMAIN_NAME[source.domain]}
              </span>
              <span className="tag">{TYPE_NAME[source.type]}</span>
              <span className="tag">{source.sections} 节</span>
            </div>
            <h3>{source.title}</h3>
            <p>{source.summary}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {source.topics.slice(0, 3).map(topic => (
                <span key={topic} className="tag jade">
                  {topic}
                </span>
              ))}
            </div>
            <div className="tile-foot">
              <span>{source.owner}</span>
              <span className="mono">
                {source.chars} 字 · {formatDate(source.updated)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
