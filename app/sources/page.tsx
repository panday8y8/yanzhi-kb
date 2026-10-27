import { SourcesView } from '../../components/SourcesView'
import { getSourceList } from '../../lib/workspace'
import { DOMAIN_NAME } from '../../lib/display'
import type { Domain, PageType } from '../../lib/types'

export const dynamic = 'force-dynamic'

export default function SourcesPage() {
  const sources = getSourceList()
  const totalChars = sources.reduce((sum, source) => sum + source.chars, 0)
  const topics = new Set(sources.flatMap(source => source.topics))
  const domains = new Set(sources.map(source => source.domain))
  const domainSummary = [...domains].map(domain => `${DOMAIN_NAME[domain as Domain]} ${sources.filter(item => item.domain === domain).length}`).join(' · ')

  return (
    <main className="page">
      <section style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, padding: '4px 2px 18px' }}>
        <div>
          <div className="hero-kicker">
            <span className="kicker">Source Library</span>
            <span className="tag">{domainSummary}</span>
          </div>
          <h1 className="hero-title" style={{ fontSize: 32 }}>
            资料库
          </h1>
          <p className="hero-sub" style={{ marginTop: 8 }}>
            原始资料是唯一事实来源，编译只读不改。每份资料带业务域、责任人、主题与摘要，是后续编译、图谱与检索的输入。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 22, textAlign: 'right' }}>
          <div>
            <div className="kicker">资料</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28 }}>{sources.length}</div>
          </div>
          <div>
            <div className="kicker">正文字数</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28 }}>{totalChars.toLocaleString('zh-CN')}</div>
          </div>
          <div>
            <div className="kicker">主题</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28 }}>{topics.size}</div>
          </div>
        </div>
      </section>

      <SourcesView
        sources={sources.map(source => ({
          ...source,
          domain: source.domain as Domain,
          type: source.type as PageType,
        }))}
      />
    </main>
  )
}

