import { Ring } from '../../components/Ring'
import { getEval, getPages } from '../../lib/workspace'
import { formatDateTime } from '../../lib/display'

export const dynamic = 'force-dynamic'

export default function EvaluationPage() {
  const report = getEval()
  const pages = getPages()
  const passed = report.cases.filter(item => item.status === 'pass').length

  return (
    <main className="page">
      <section style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, padding: '4px 2px 18px' }}>
        <div>
          <div className="hero-kicker">
            <span className="kicker">Evaluation</span>
            <span className="tag jade">12 道固定题 · 可复现</span>
          </div>
          <h1 className="hero-title" style={{ fontSize: 32 }}>
            质量评估
          </h1>
          <p className="hero-sub" style={{ marginTop: 8 }}>
            固定题库覆盖六个业务域与两类「应当拒答」的问题；评估只跑本地检索与摘录链路，不消耗模型额度，任何一次运行结果都一致。
          </p>
        </div>
        <div className="muted mono" style={{ fontSize: 11.5 }}>
          生成时间 {formatDateTime(report.generatedAt)}
        </div>
      </section>

      <section className="grid-2" style={{ marginBottom: 14 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">总分与分项</div>
              <div className="panel-hint">{report.passed}/{report.total} 题通过 · 知识页 {pages.length}</div>
            </div>
          </div>
          <div className="panel-body" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Ring score={report.score} label="总分" />
            <div className="metric-rows">
              {Object.entries(report.metrics).map(([key, metric]) => (
                <div className="metric-row" key={key}>
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

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">怎么复现</div>
              <div className="panel-hint">命令行与页面同源</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="prose" style={{ fontSize: 12.5 }}>
              <p>
                在项目根目录执行 <code className="mono">pnpm kb:eval</code>，会给 12 道题逐条打分，把报告写到{' '}
                <code className="mono">output/eval/report.json</code>。
              </p>
              <p>判定口径：检索命中（期望知识页进入前三）、证据覆盖（关键词齐全）、引用有效（编号不越界）、诚实作答（无证据题不硬答）。</p>
            </div>
            <div className="kv" style={{ marginTop: 8 }}>
              <span>通过题数</span>
              <b>{passed} / {report.total}</b>
            </div>
            <div className="kv">
              <span>总分</span>
              <b>{report.score}</b>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">逐题结果</div>
            <div className="panel-hint">绿色为通过，红色为未通过</div>
          </div>
        </div>
        <div className="panel-body">
          <div className="table">
            <div className="table-head" style={{ gridTemplateColumns: '34px minmax(0,1fr) 82px 88px 86px' }}>
              <span>#</span>
              <span>问题</span>
              <span>检索命中</span>
              <span>证据覆盖</span>
              <span>结果</span>
            </div>
            {report.cases.map((item, index) => (
              <div className="table-row" key={item.id} style={{ gridTemplateColumns: '34px minmax(0,1fr) 82px 88px 86px' }}>
                <span className="row-num">{String(index + 1).padStart(2, '0')}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="row-title">{item.question}</div>
                  <div className="row-sub">
                    {item.notes.length ? item.notes.join('；') : `命中：${item.topPages.join(' / ') || '无'}`}
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11.5 }}>
                  {item.retrievalHit === null ? '—' : item.retrievalHit ? '命中' : '未命中'}
                </span>
                <span className="mono" style={{ fontSize: 11.5 }}>
                  {item.evidenceCoverage === null ? '—' : item.evidenceCoverage ? '齐全' : '缺失'}
                </span>
                <span className={`tag ${item.status === 'pass' ? 'jade' : 'seal'}`}>{item.status === 'pass' ? '通过' : '未过'}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
