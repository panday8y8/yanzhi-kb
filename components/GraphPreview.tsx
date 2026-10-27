import { layoutGraph } from '../lib/graph'
import { DOMAIN_COLOR, DOMAIN_NAME } from '../lib/display'
import type { Domain, GraphData } from '../lib/types'

export function GraphPreview({ graph }: { graph: GraphData }) {
  const layout = layoutGraph(graph)
  const pages = layout.nodes.filter(node => node.kind === 'PAGE')
  const hubs = layout.nodes.filter(node => node.kind === 'DOMAIN')
  const keep = new Set([...pages, ...hubs].map(node => node.id))
  const edges = layout.edges.filter(edge => edge.relation === 'LINKS_TO' && keep.has(edge.source) && keep.has(edge.target))
  const byId = new Map(layout.nodes.map(node => [node.id, node]))

  return (
    <svg viewBox="0 0 1080 660" width="100%" role="img" aria-label="知识图谱缩略图" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="preview-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="540" cy="344" rx="470" ry="300" fill="url(#preview-glow)" />
      {edges.map((edge, index) => {
        const from = byId.get(edge.source)
        const to = byId.get(edge.target)
        if (!from || !to) return null
        return (
          <line
            key={index}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="var(--line-strong)"
            strokeWidth={1}
            strokeOpacity={0.35}
          />
        )
      })}
      {hubs.map(hub => (
        <g key={hub.id}>
          <circle cx={hub.x} cy={hub.y} r={30} fill={DOMAIN_COLOR[hub.domain as Domain]} opacity={0.1} />
          <circle cx={hub.x} cy={hub.y} r={4} fill={DOMAIN_COLOR[hub.domain as Domain]} opacity={0.55} />
          <text x={hub.x} y={hub.y - 38} textAnchor="middle" fontSize={15} fill="var(--ink-3)" fontFamily="var(--sans)">
            {DOMAIN_NAME[hub.domain as Domain]}
          </text>
        </g>
      ))}
      {pages.map(page => (
        <circle
          key={page.id}
          cx={page.x}
          cy={page.y}
          r={3.4 + Math.min(5, page.degree * 0.25)}
          fill={DOMAIN_COLOR[page.domain as Domain]}
          fillOpacity={0.62}
          stroke="var(--panel)"
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}
