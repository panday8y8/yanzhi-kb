'use client'

import { useState } from 'react'
import { IconCheck, IconSpark } from './Icons'
import { formatDateTime } from '../lib/display'

interface SettingsConfig {
  provider: string
  configured: boolean
  baseUrl: string
  model: string
  credentialSource: string
  credentialLabel: string
  models: { id: string; label: string; hint: string }[]
}

interface Props {
  config: SettingsConfig
  counts: { pages: number; chunks: number; sources: number }
  compiledAt: string
}

export function SettingsView({ config, counts, compiledAt }: Props) {
  const [model, setModel] = useState(config.model)
  const [temperature, setTemperature] = useState(0.2)
  const [maxTokens, setMaxTokens] = useState(900)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null)
  const [recompiling, setRecompiling] = useState(false)
  const [recompileResult, setRecompileResult] = useState<string | null>(null)

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const response = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      })
      const payload = (await response.json()) as { ok: boolean; message: string; latencyMs: number }
      setTestResult(payload)
    } catch (error) {
      setTestResult({ ok: false, message: error instanceof Error ? error.message : '请求失败' })
    } finally {
      setTesting(false)
    }
  }

  const recompile = async () => {
    setRecompiling(true)
    setRecompileResult(null)
    try {
      const response = await fetch('/api/settings/recompile', { method: 'POST' })
      const payload = (await response.json()) as { ok: boolean; summary?: string; error?: string }
      setRecompileResult(payload.ok ? payload.summary ?? '已重新编译' : payload.error ?? '编译失败')
    } catch (error) {
      setRecompileResult(error instanceof Error ? error.message : '请求失败')
    } finally {
      setRecompiling(false)
    }
  }

  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">模型与生成参数</div>
            <div className="panel-hint">凭证只在服务端读取，浏览器拿不到 Key</div>
          </div>
          <span className={`tag ${config.configured ? 'jade' : 'gold'}`}>{config.configured ? '已配置' : '未配置'}</span>
        </div>
        <div className="panel-body">
          <div className="field">
            <label className="field-label" htmlFor="model">
              生成模型
            </label>
            <select id="model" className="select" value={model} onChange={event => setModel(event.target.value)}>
              {config.models.map(item => (
                <option key={item.id} value={item.id}>
                  {item.label} — {item.hint}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="temperature">
              温度 temperature：{temperature.toFixed(2)}
            </label>
            <input
              id="temperature"
              className="range"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={event => setTemperature(Number(event.target.value))}
            />
            <span className="field-hint">知识库问答建议 0.1–0.3，越低越贴近证据原文</span>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="tokens">
              最大输出 max tokens：{maxTokens}
            </label>
            <input
              id="tokens"
              className="range"
              type="range"
              min={256}
              max={2048}
              step={64}
              value={maxTokens}
              onChange={event => setMaxTokens(Number(event.target.value))}
            />
            <span className="field-hint">默认 900，足够覆盖一屏制度要点</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-seal btn-sm" onClick={() => void testConnection()} disabled={testing}>
              <IconSpark size={13} />
              {testing ? '测试中…' : '测试连接'}
            </button>
            <span className="muted" style={{ fontSize: 11.5 }}>
              发一次最小推理，验证凭证与模型可用
            </span>
          </div>
          {testResult && (
            <div className={testResult.ok ? 'result-ok' : 'result-bad'} style={{ marginTop: 12 }}>
              {testResult.ok ? <IconCheck size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} /> : null}
              {testResult.message}
              {testResult.latencyMs ? ` · ${testResult.latencyMs} ms` : ''}
            </div>
          )}
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">凭证状态</div>
              <div className="panel-hint">来自环境变量，不落盘、不下发</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="kv">
              <span>服务商</span>
              <b>{config.provider}</b>
            </div>
            <div className="kv">
              <span>接口地址</span>
              <b>{config.baseUrl.replace('https://', '')}</b>
            </div>
            <div className="kv">
              <span>凭证</span>
              <b>{config.credentialLabel}</b>
            </div>
            <div className="kv">
              <span>来源</span>
              <b>{config.credentialSource === 'environment' ? '环境变量' : '未配置'}</b>
            </div>
            <div className="kv">
              <span>默认模型</span>
              <b>{config.model}</b>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">知识库存储</div>
              <div className="panel-hint">SQLite · 单文件，可随时重建</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="kv">
              <span>知识页</span>
              <b>{counts.pages}</b>
            </div>
            <div className="kv">
              <span>证据片段</span>
              <b>{counts.chunks}</b>
            </div>
            <div className="kv">
              <span>来源资料</span>
              <b>{counts.sources}</b>
            </div>
            <div className="kv">
              <span>最近编译</span>
              <b>{formatDateTime(compiledAt)}</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <button type="button" className="btn btn-sm" onClick={() => void recompile()} disabled={recompiling}>
                {recompiling ? '编译中…' : '重新编译'}
              </button>
              {recompileResult && <span className="muted" style={{ fontSize: 11.5 }}>{recompileResult}</span>}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
