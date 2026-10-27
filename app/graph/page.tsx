import { GraphCanvas } from '../../components/GraphCanvas'
import { getGraph } from '../../lib/workspace'
import { layoutGraph } from '../../lib/graph'
import { getModelConfig } from '../../lib/qa'

export const dynamic = 'force-dynamic'

export default function GraphPage() {
  const graph = getGraph()
  const layout = layoutGraph(graph)
  const pageNodes = graph.nodes.filter(node => node.kind === 'PAGE')
  const sourceNodes = graph.nodes.filter(node => node.kind === 'SOURCE')
  const links = graph.edges.filter(edge => edge.relation === 'LINKS_TO').length
  const cites = graph.edges.filter(edge => edge.relation === 'CITES').length
  const visibleEdges = graph.edges.filter(edge => edge.relation !== 'OF_TYPE').length
  const typeEdges = graph.edges.length - visibleEdges
  void getModelConfig()

  return (
    <main className="page">
      <section style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, padding: '4px 2px 18px' }}>
        <div>
          <div className="hero-kicker">
            <span className="kicker">Knowledge Graph</span>
            <span className="tag jade">确定性抽取 · 无模型依赖</span>
          </div>
          <h1 className="hero-title" style={{ fontSize: 32 }}>
            知识图谱
          </h1>
          <p className="hero-sub" style={{ marginTop: 8 }}>
            从编译产物里抽取知识页、来源资料、业务域与页面类型四类节点，内链与引用构成关系网；按业务域成簇，颜色即归属。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 22, textAlign: 'right' }}>
          <div>
            <div className="kicker">节点</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28 }}>{graph.nodes.length}</div>
          </div>
          <div>
            <div className="kicker">关系（画布展示）</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28 }}>{visibleEdges}</div>
            <div className="muted" style={{ fontSize: 10.5 }}>
              总 {graph.edges.length} · 类型边 {typeEdges} 已隐藏
            </div>
          </div>
          <div>
            <div className="kicker">内链 / 引用</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20 }}>
              {links} / {cites}
            </div>
          </div>
        </div>
      </section>

      <GraphCanvas nodes={layout.nodes} edges={layout.edges} clusters={layout.clusters} />

      <section className="grid-3" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">抽取规则</div>
              <div className="panel-hint">全部来自编译产物，可复现</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="kv">
              <span>知识页节点</span>
              <b>{pageNodes.length}</b>
            </div>
            <div className="kv">
              <span>来源资料节点</span>
              <b>{sourceNodes.length}</b>
            </div>
            <div className="kv">
              <span>互链边（LINKS_TO）</span>
              <b>{links}</b>
            </div>
            <div className="kv">
              <span>引用边（CITES）</span>
              <b>{cites}</b>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">怎么读这张图</div>
              <div className="panel-hint">悬停聚焦一跳邻居</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="prose" style={{ fontSize: 12.5 }}>
              <p>圆点是知识页，大小由连接度决定；小方块是来源资料，虚线是引用关系。</p>
              <p>点击节点可查看详情并跳转到对应知识页；上方按钮按业务域筛选。</p>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">产物文件</div>
              <div className="panel-hint">命令行可随时重跑</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="kv">
              <span>节点</span>
              <b>output/kg_nodes.json</b>
            </div>
            <div className="kv">
              <span>边</span>
              <b>output/kg_edges.json</b>
            </div>
            <div className="kv">
              <span>元信息</span>
              <b>output/kg_meta.json</b>
            </div>
            <div className="kv">
              <span>重跑命令</span>
              <b>pnpm kb:graph</b>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
