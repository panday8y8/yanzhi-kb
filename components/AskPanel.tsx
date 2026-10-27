'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { IconArrow, IconSend, IconSpark } from './Icons'
import { DOMAIN_COLOR, DOMAIN_NAME } from '../lib/display'
import type { EvidenceItem } from '../lib/types'

interface ModelConfig {
  configured: boolean
  model: string
  models: { id: string; label: string; hint: string }[]
}

interface Turn {
  id: number
  question: string
  answer: string
  evidence: EvidenceItem[]
  citations: number[]
  mode: 'deepseek' | 'local' | ''
  model: string | null
  latencyMs: number
  tokens: number | null
  confidence: 'high' | 'medium' | 'low' | ''
  notice?: string
  pending: boolean
  error?: string
}

const SUGGESTIONS = [
  '版本发布要过哪几道门禁？',
  '不合格品如何分级和处置？',
  '新供应商准入要走哪些步骤？',
  'P0 级安全事件多久内止损？',
]

function renderInline(text: string, onCite: (n: number) => void, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-b-${index}`}>{part.slice(2, -2)}</strong>
    }
    const match = part.match(/^\[(\d+)\]$/)
    if (!match) return <span key={`${keyPrefix}-t-${index}`}>{part}</span>
    const n = Number(match[1])
    return (
      <button key={`${keyPrefix}-c-${index}`} type="button" className="cite" onClick={() => onCite(n)}>
        {n}
      </button>
    )
  })
}

/** 轻量 Markdown：段落、无序列表、加粗、引用编号，够用且不引第三方库。 */
function renderAnswer(text: string, onCite: (n: number) => void) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    const items = list
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={index}>{renderInline(item, onCite, `l-${blocks.length}-${index}`)}</li>
        ))}
      </ul>,
    )
    list = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      flush()
      continue
    }
    const bullet = line.match(/^[-•*]\s+(.*)$/)
    if (bullet) {
      list.push(bullet[1])
      continue
    }
    flush()
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line, onCite, `p-${blocks.length}`)}</p>)
  }
  flush()
  return blocks
}

export function AskPanel({ config, suggestions = SUGGESTIONS }: { config: ModelConfig; suggestions?: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [model, setModel] = useState(config.model)
  const [highlight, setHighlight] = useState<number | null>(null)
  const seq = useRef(0)

  const current = turns.at(-1)
  const evidence = current?.evidence ?? []

  const send = async (question: string) => {
    const text = question.trim()
    if (!text || busy) return
    const id = seq.current + 1
    seq.current = id
    setBusy(true)
    setInput('')
    setTurns(previous => [
      ...previous,
      {
        id,
        question: text,
        answer: '',
        evidence: [],
        citations: [],
        mode: '',
        model: null,
        latencyMs: 0,
        tokens: null,
        confidence: '',
        pending: true,
      },
    ])

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, model }),
      })
      if (!response.body) throw new Error('浏览器不支持流式响应')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() ?? ''
        for (const chunk of chunks) {
          const line = chunk.split('\n').find(item => item.startsWith('data:'))
          if (!line) continue
          const payload = JSON.parse(line.slice(5).trim()) as Record<string, unknown>
          if (payload.type === 'meta') {
            setTurns(previous =>
              previous.map(turn =>
                turn.id === id
                  ? {
                      ...turn,
                      evidence: payload.evidence as EvidenceItem[],
                      mode: payload.mode as Turn['mode'],
                      model: (payload.model as string) ?? null,
                      confidence: payload.confidence as Turn['confidence'],
                    }
                  : turn,
              ),
            )
          }
          if (payload.type === 'delta') {
            const delta = String(payload.text ?? '')
            setTurns(previous => previous.map(turn => (turn.id === id ? { ...turn, answer: turn.answer + delta } : turn)))
          }
          if (payload.type === 'done') {
            setTurns(previous =>
              previous.map(turn =>
                turn.id === id
                  ? {
                      ...turn,
                      answer: String(payload.answer ?? turn.answer),
                      citations: (payload.citations as number[]) ?? [],
                      mode: payload.mode as Turn['mode'],
                      model: (payload.model as string) ?? null,
                      latencyMs: Number(payload.latencyMs ?? 0),
                      tokens: (payload.usage as { totalTokens?: number } | null)?.totalTokens ?? null,
                      confidence: payload.confidence as Turn['confidence'],
                      notice: payload.notice as string | undefined,
                      pending: false,
                    }
                  : turn,
              ),
            )
          }
        }
      }
    } catch (error) {
      setTurns(previous =>
        previous.map(turn =>
          turn.id === id ? { ...turn, pending: false, error: error instanceof Error ? error.message : '请求失败' } : turn,
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send(input)
    }
  }

  const modeLabel = (turn: Turn) => {
    if (turn.mode === 'deepseek') return 'DeepSeek 生成'
    if (turn.mode === 'local') return '本地证据摘录'
    return '检索中'
  }

  return (
    <div className="ask-layout">
      <section className="chat fade-up">
        <div className="chat-head">
          <div className="chat-title">
            <IconSpark size={16} />
            知识问答
            <span className="tag jade" style={{ marginLeft: 4 }}>
              <span className="status-dot" style={{ width: 5, height: 5 }} />
              {config.configured ? '模型已连接' : '未配置凭证'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select className="select" style={{ width: 190, height: 30, fontSize: 12 }} value={model} onChange={event => setModel(event.target.value)}>
              {config.models.map(item => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-sm" onClick={() => setTurns([])}>
              新对话
            </button>
          </div>
        </div>

        <div className="thread scrollbar-thin">
          {turns.length === 0 && (
            <div className="turn">
              <div className="answer-card">
                <div className="answer-meta">
                  <span className="tag seal">砚知助手</span>
                  <span>先检索本地知识页，再让模型基于证据作答</span>
                </div>
                <div className="answer-text" style={{ color: 'var(--ink-3)' }}>
                  你好，我是北辰制造知识助手。所有结论都会标注来源编号，右侧可以逐条核对证据；证据不足时我会直接说明，不会编造制度。
                </div>
                <div className="suggestions" style={{ marginTop: 12 }}>
                  {suggestions.map(item => (
                    <button key={item} type="button" className="suggestion" onClick={() => void send(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {turns.map(turn => (
            <div key={turn.id} className="turn">
              <div className="turn turn-user">
                <div className="bubble-user">{turn.question}</div>
              </div>
              <div className="answer-card">
                <div className="answer-meta">
                  <span className={`tag ${turn.mode === 'deepseek' ? 'jade' : 'gold'}`}>{modeLabel(turn)}</span>
                  {turn.model && <span className="mono">{turn.model}</span>}
                  {turn.latencyMs > 0 && <span className="mono">{turn.latencyMs} ms</span>}
                  {turn.tokens !== null && turn.tokens !== undefined && <span className="mono">{turn.tokens} tokens</span>}
                  {turn.confidence && <span>置信度：{turn.confidence === 'high' ? '高' : turn.confidence === 'medium' ? '中' : '低'}</span>}
                  {turn.pending && <span className="status-dot" style={{ width: 6, height: 6 }} />}
                </div>
                <div className="answer-text">
                  {turn.answer ? renderAnswer(turn.answer, n => setHighlight(n)) : '正在检索证据…'}
                </div>
                {turn.notice && <div className="answer-note">{turn.notice}</div>}
                {turn.error && <div className="answer-note">{turn.error}</div>}
                {!turn.pending && turn.evidence.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span className="muted" style={{ fontSize: 11 }}>
                      证据 {turn.evidence.length} 条
                    </span>
                    {turn.citations.map(n => (
                      <span key={n} className="tag seal">
                        [{n}] {turn.evidence.find(item => item.n === n)?.pageTitle ?? '来源'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="askbox">
          <textarea
            value={input}
            placeholder="问点什么…例如：变更窗口是什么时候？"
            aria-label="向知识库提问"
            onChange={event => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
          />
          <div className="askbar">
            <span className="ask-hint">Enter 发送 · Shift + Enter 换行 · 回答只使用本次检索到的证据</span>
            <button type="button" className="btn btn-seal btn-sm" onClick={() => void send(input)} disabled={busy || !input.trim()}>
              <IconSend size={13} />
              发送
            </button>
          </div>
        </div>
      </section>

      <aside className="evidence-rail">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">证据工作区</div>
              <div className="panel-hint">{current ? `${evidence.length} 条命中片段` : '提问后展示检索证据'}</div>
            </div>
            {current && <span className="tag">{current.evidence.length} 条</span>}
          </div>
          <div className="panel-body" style={{ paddingTop: 12 }}>
            {evidence.length === 0 && (
              <div className="muted" style={{ fontSize: 12, lineHeight: 1.8 }}>
                检索流程：分词 → BM25 打分 → 取前 3 个知识页 → 展开整页小节。每个片段都会显示命中分数，方便判断答案是否站得住。
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {evidence.map(item => (
                <Link
                  key={item.n}
                  className="ev-card"
                  href={`/wiki?slug=${encodeURIComponent(item.pageSlug)}`}
                  style={highlight === item.n ? { borderColor: 'var(--seal)', boxShadow: '0 0 0 3px color-mix(in oklab, var(--seal) 14%, transparent)' } : undefined}
                  onMouseEnter={() => setHighlight(item.n)}
                  onMouseLeave={() => setHighlight(null)}
                >
                  <div className="ev-head">
                    <span className="ev-title">
                      <span className="source-n">{item.n}</span>
                      {item.pageTitle}
                    </span>
                    <span className="ev-score">{item.score.toFixed(1)}</span>
                  </div>
                  <div className="ev-section">
                    {item.section} · {DOMAIN_NAME[item.domain]}
                  </div>
                  <div className="ev-text">{item.text}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body" style={{ paddingTop: 16 }}>
            <div className="kv">
              <span>检索方式</span>
              <b>BM25 · 本地</b>
            </div>
            <div className="kv">
              <span>生成模型</span>
              <b>{config.configured ? config.model : '未配置'}</b>
            </div>
            <div className="kv">
              <span>回答依据</span>
              <b>仅本次证据</b>
            </div>
            <div style={{ marginTop: 12 }}>
              <Link className="panel-link" href="/evaluation">
                查看 12 道题的评估结果 →
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}


