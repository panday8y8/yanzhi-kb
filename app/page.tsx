import Link from 'next/link'
import { GraphPreview } from '../components/GraphPreview'
import { IconArrow, IconLayers, IconSpark } from '../components/Icons'
import { Ring } from '../components/Ring'
import { Spark } from '../components/Spark'
import { DOMAIN_COLOR, DOMAIN_NAME, TYPE_NAME, formatDate, formatDateTime } from '../lib/display'
import {
  getChunkCount,
  getDomainStats,
  getEval,
  getGraph,
  getManifest,
  getPages,
  getPipeline,
  getSourceList,
} from '../lib/workspace'
import { getModelConfig } from '../lib/qa'

export const dynamic = 'force-dynamic'

export default function OverviewPage() {
  const pages = getPages()
  const manifest = getManifest()
  const graph = getGraph()
  const evaluation = getEval()
  const sources = getSourceList()
  const domains = getDomainStats(pages)
  const model = getModelConfig()
  const pipeline = getPipeline(pages, graph, getChunkCount(), model.configured)
  const citations = pages.reduce((sum, page) => sum + page.citations.length, 0)
  const avgCitations = pages.length ? (citations / pages.length).toFixed(1) : '0'
  const recent = sources.slice(0, 5)
  const today = formatDateTime(new Date().toISOString())

  return (
    <main className="page">
      <section className="hero fade-up">
        <div>
          <div className="hero-kicker">
            <span className="kicker">Beichen · Knowledge Studio</span>
            <span className="tag jade">
              <span className="status-dot" style={{ width: 5, height: 5 }} />
              本地检索在线
            </span>
          </div>
          <h1 className="hero-title">
            把散落的制度，编译成
            <br />
            可问答的<em>知识资产</em>
          </h1>
          <p className="hero-sub">
            12 份内部资料经确定性编译器重组成 {pages.length} 个知识页，每个结论都带来源引用；
            检索走本地 BM25，生成交给 DeepSeek，答案与证据双向可核对。
          </p>
        </div>
        <div className="hero-side">
          <span className="hero-date">{today}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn btn-sm" href="/wiki">
              浏览知识库
            </Link>
            <Link className="btn btn-sm btn-solid" href="/ask">
              开始问答
              <IconArrow size={13} />
            </Link>
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            最近编译 {formatDate(manifest.compiledAt)}
          </span>
        </div>
      </section>

      <section className="stat-grid fade-up d1">
        <div className="stat">
          <div className="stat-label">知识页</div>
          <div className="stat-value">
            {pages.length}
            <small>页</small>
          </div>
          <div className="stat-foot">
            <Spark values={[6, 9, 12, 16, 21, pages.length]} />
            <span>来自 {manifest.sources} 份资料</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">来源引用</div>
          <div className="stat-value">
            {citations}
            <small>条</small>
          </div>
          <div className="stat-foot">
            <span>每页平均 {avgCitations} 条</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">图谱关系</div>
          <div className="stat-value">
            {graph.edges.length}
            <small>条</small>
          </div>
          <div className="stat-foot">
            <span>{graph.nodes.length} 个节点 · 6 个业务域</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">质量评分</div>
          <div className="stat-value">
            {evaluation.score}
            <small>分</small>
          </div>
          <div className="stat-foot">
            <span>
              {evaluation.passed}/{evaluation.total} 道评测通过
            </span>
          </div>
        </div>
      </section>

      <section className="grid-2 fade-up d2">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">知识构成</div>
              <div className="panel-hint">按业务域分布，颜色越深页数越多</div>
            </div>
            <Link className="panel-link" href="/wiki">
              进入知识库 →
            </Link>
          </div>
          <div className="panel-body">
            <div className="domain-list">
              {domains.map(item => (
                <div className="domain-row" key={item.domain}>
                  <span className="domain-name">
                    <span className="dot-domain" style={{ background: DOMAIN_COLOR[item.domain], display: 'inline-block', marginRight: 6 }} />
                    {DOMAIN_NAME[item.domain]}
                  </span>
                  <span className="domain-track">
                    <span
                      className="domain-fill"
                      style={{
                        width: `${Math.max(8, item.share * 100)}%`,
                        background: `linear-gradient(90deg, color-mix(in oklab, ${DOMAIN_COLOR[item.domain]} 55%, transparent), ${DOMAIN_COLOR[item.domain]})`,
                      }}
                    />
                  </span>
                  <span className="domain-count">{item.pages} 页</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
              {manifest.types.map(item => (
                <span key={item.type} className="tag">
                  {TYPE_NAME[item.type]} · {item.pages}
                </span>
              ))}
              <span className="tag jade">{manifest.links} 组互链</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">质量评估</div>
              <div className="panel-hint">12 道固定题 · 本地链路 · 可复现</div>
            </div>
            <Link className="panel-link" href="/evaluation">
              查看明细 →
            </Link>
          </div>
          <div className="panel-body" style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
            <Ring score={evaluation.score} label="总分" />
            <div className="metric-rows">
              {Object.values(evaluation.metrics).map(metric => (
                <div className="metric-row" key={metric.label}>
                  <span>{metric.label}</span>
                  <span className="metric-track">
                    <i style={{ width: `${Math.round((metric.value ?? 0) * 100)}%` }} />
                  </span>
                  <span className="mono" style={{ textAlign: 'right' }}>
                    {metric.value === null ? '—' : `${Math.round(metric.value * 100)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel fade-up d2" style={{ marginBottom: 14 }}>
        <div className="panel-head">
          <div>
            <div className="panel-title">知识流水线</div>
            <div className="panel-hint">从原始资料到可问答资产，每一步都产物落盘</div>
          </div>
          <span className="tag gold">
            <IconSpark size={11} />
            确定性编译
          </span>
        </div>
        <div className="pipeline">
          {pipeline.map(stage => (
            <div className="stage" key={stage.index}>
              <div className="stage-index">{stage.index}</div>
              <div className="stage-name">{stage.name}</div>
              <div className="stage-detail">{stage.detail}</div>
              <div className="stage-bar">
                <i style={{ width: `${stage.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid-3 fade-up d3">
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">最近资料</div>
              <div className="panel-hint">按更新时间排序</div>
            </div>
            <Link className="panel-link" href="/sources">
              全部 →
            </Link>
          </div>
          <div className="panel-body" style={{ paddingTop: 10 }}>
            <div className="table">
              {recent.map(source => (
                <div className="table-row" key={source.docId} style={{ gridTemplateColumns: 'minmax(0,1fr) 76px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row-title">{source.title}</div>
                    <div className="row-sub">
                      {DOMAIN_NAME[source.domain as keyof typeof DOMAIN_NAME]} · {source.owner}
                    </div>
                  </div>
                  <div className="row-num">{formatDate(source.updated)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-head">
            <div>
              <div className="panel-title">图谱预览</div>
              <div className="panel-hint">{graph.nodes.length} 节点 / {graph.edges.length} 边</div>
            </div>
            <Link className="panel-link" href="/graph">
              展开 →
            </Link>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: '4px 0 0' }}>
            <GraphPreview graph={graph} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">服务入口</div>
              <div className="panel-hint">知识基础设施</div>
            </div>
          </div>
          <div className="panel-body" style={{ paddingTop: 12 }}>
            <div className="quick-grid">
              <Link className="quick" href="/wiki">
                <span className="quick-icon">
                  <IconLayers size={15} />
                </span>
                <span>
                  <span className="quick-title">知识库</span>
                  <span className="quick-sub" style={{ display: 'block' }}>
                    {pages.length} 个知识页 · 带来源引用
                  </span>
                </span>
              </Link>
              <Link className="quick" href="/ask">
                <span className="quick-icon">
                  <IconSpark size={15} />
                </span>
                <span>
                  <span className="quick-title">智能问答</span>
                  <span className="quick-sub" style={{ display: 'block' }}>
                    {model.configured ? 'DeepSeek 已连接' : '未配置凭证 · 本地摘录'}
                  </span>
                </span>
              </Link>
              <Link className="quick" href="/graph">
                <span className="quick-icon">
                  <IconLayers size={15} />
                </span>
                <span>
                  <span className="quick-title">知识图谱</span>
                  <span className="quick-sub" style={{ display: 'block' }}>
                    按业务域成簇的关系视图
                  </span>
                </span>
              </Link>
              <Link className="quick" href="/evaluation">
                <span className="quick-icon">
                  <IconSpark size={15} />
                </span>
                <span>
                  <span className="quick-title">质量评估</span>
                  <span className="quick-sub" style={{ display: 'block' }}>
                    {evaluation.passed}/{evaluation.total} 通过 · {evaluation.score} 分
                  </span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}


