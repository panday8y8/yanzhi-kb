'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DOMAIN_COLOR, DOMAIN_NAME, TYPE_NAME } from '../lib/display'
import type { Domain, GraphEdge, GraphNode } from '../lib/types'

export interface PositionedNodeView extends GraphNode {
  x: number
  y: number
  cluster: number
}

interface Props {
  nodes: PositionedNodeView[]
  edges: GraphEdge[]
  clusters: { domain: Domain; label: string; x: number; y: number; count: number }[]
}

interface Point {
  x: number
  y: number
}

interface ViewState extends Point {
  k: number
}

type DragState =
  | { type: 'pan'; start: Point; origin: Point }
  | { type: 'node'; id: string; start: Point; base: Point }

const DOMAINS_ORDER: Domain[] = ['engineering', 'manufacturing', 'quality', 'supply', 'security', 'people']
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const DRAG_THRESHOLD = 3

export function GraphCanvas({ nodes, edges, clusters }: Props) {
  const [domain, setDomain] = useState<Domain | 'all'>('all')
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, k: 1 })
  const [positions, setPositions] = useState<Record<string, Point>>({})
  const [dragging, setDragging] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const movedRef = useRef(0)

  const visible = useMemo(() => {
    const keep = new Set(
      nodes
        .filter(node => domain === 'all' || node.kind === 'TYPE' || node.kind === 'DOMAIN' || node.domain === domain)
        .map(node => node.id),
    )
    return {
      nodes: nodes.filter(node => keep.has(node.id)),
      edges: edges.filter(edge => keep.has(edge.source) && keep.has(edge.target) && edge.relation !== 'OF_TYPE'),
    }
  }, [nodes, edges, domain])

  const byId = useMemo(() => new Map(visible.nodes.map(node => [node.id, node])), [visible.nodes])

  const positionOf = useCallback(
    (node: PositionedNodeView): Point => positions[node.id] ?? { x: node.x, y: node.y },
    [positions],
  )

  const neighborIds = useMemo(() => {
    if (!hovered) return null
    const ids = new Set<string>([hovered])
    for (const edge of visible.edges) {
      if (edge.source === hovered) ids.add(edge.target)
      if (edge.target === hovered) ids.add(edge.source)
    }
    return ids
  }, [hovered, visible.edges])

  const selectedNode = selected ? nodes.find(node => node.id === selected) : null

  const toSvg = useCallback((clientX: number, clientY: number): Point => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const matrix = svg.getScreenCTM()
    if (!matrix) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const mapped = point.matrixTransform(matrix.inverse())
    return { x: mapped.x, y: mapped.y }
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return
      const target = event.target as Element
      if (target.closest('.graph-detail')) return
      const nodeGroup = target.closest('[data-node-id]')
      const start = toSvg(event.clientX, event.clientY)
      movedRef.current = 0
      setDragging(true)
      if (nodeGroup) {
        const id = nodeGroup.getAttribute('data-node-id')
        const node = id ? byId.get(id) : undefined
        if (id && node) {
          const base = positionOf(node)
          dragRef.current = { type: 'node', id, start, base }
          return
        }
      }
      dragRef.current = { type: 'pan', start, origin: { x: view.x, y: view.y } }
    },
    [byId, positionOf, toSvg, view.x, view.y],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current
      if (!drag) return
      const current = toSvg(event.clientX, event.clientY)
      const dx = current.x - drag.start.x
      const dy = current.y - drag.start.y
      movedRef.current = Math.max(movedRef.current, Math.hypot(dx, dy))

      if (drag.type === 'pan') {
        setView(prev => ({ ...prev, x: drag.origin.x + dx, y: drag.origin.y + dy }))
      } else {
        setPositions(prev => ({ ...prev, [drag.id]: { x: drag.base.x + dx, y: drag.base.y + dy } }))
      }
    },
    [toSvg],
  )

  const finishDrag = useCallback(() => {
    const drag = dragRef.current
    const moved = movedRef.current
    dragRef.current = null
    setDragging(false)
    if (!drag) return
    if (moved > DRAG_THRESHOLD) return
    if (drag.type === 'node') {
      setSelected(drag.id)
    } else {
      setSelected(null)
    }
  }, [])

  const zoomBy = useCallback((factor: number, anchor?: Point) => {
    setView(prev => {
      const nextK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.k * factor))
      if (nextK === prev.k) return prev
      const cx = anchor?.x ?? 540
      const cy = anchor?.y ?? 330
      const ratio = nextK / prev.k
      return {
        k: nextK,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
      }
    })
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const point = toSvg(event.clientX, event.clientY)
      zoomBy(Math.exp(-event.deltaY * 0.0015), point)
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [toSvg, zoomBy])

  useEffect(() => {
    const onUp = () => finishDrag()
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [finishDrag])

  const resetView = () => {
    setView({ x: 0, y: 0, k: 1 })
    setPositions({})
  }

  return (
    <div className="graph-shell">
      <div className="graph-toolbar">
        <div className="legend">
          <span className="legend-item" style={{ letterSpacing: '.12em', fontSize: 10.5, textTransform: 'uppercase', color: 'var(--ink-4)' }}>
            业务域
          </span>
          <button
            type="button"
            className={`suggestion${domain === 'all' ? ' active' : ''}`}
            style={domain === 'all' ? { color: 'var(--seal)', borderColor: 'color-mix(in oklab, var(--seal) 30%, var(--line))' } : undefined}
            onClick={() => setDomain('all')}
          >
            全部
          </button>
          {DOMAINS_ORDER.map(item => (
            <button
              key={item}
              type="button"
              className="suggestion"
              style={
                domain === item
                  ? { color: DOMAIN_COLOR[item], borderColor: DOMAIN_COLOR[item], background: 'color-mix(in oklab, currentColor 8%, transparent)' }
                  : undefined
              }
              onClick={() => setDomain(item)}
            >
              <span className="dot-domain" style={{ background: DOMAIN_COLOR[item], display: 'inline-block', marginRight: 5 }} />
              {DOMAIN_NAME[item]}
            </button>
          ))}
        </div>
        <div className="legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ color: DOMAIN_COLOR.engineering, background: 'transparent' }} />
            知识页
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ color: 'var(--gold)', background: 'transparent', borderRadius: 2 }} />
            来源资料
          </span>
          <span className="legend-item">
            <span className="legend-dot" style={{ color: 'var(--line-strong)' }} />
            内链
          </span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
            {visible.nodes.length} 节点 / {visible.edges.length} 边
          </span>
          <span className="graph-hint">拖拽平移 · 滚轮缩放 · 拖动节点调整位置</span>
          <div className="graph-zoom">
            <button type="button" className="icon-btn" aria-label="放大" onClick={() => zoomBy(1.2)}>+</button>
            <button type="button" className="icon-btn" aria-label="缩小" onClick={() => zoomBy(1 / 1.2)}>−</button>
            <button type="button" className="suggestion" onClick={resetView}>重置</button>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        className={`graph-svg${dragging ? ' dragging' : ''}`}
        viewBox="0 0 1080 660"
        role="img"
        aria-label="知识图谱：可拖拽平移、滚轮缩放、拖动节点调整位置"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <defs>
          <filter id="node-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {clusters.map(cluster => {
            const count = visible.nodes.filter(node => node.kind !== 'TYPE' && node.domain === cluster.domain).length
            if (!count) return null
            return (
              <g key={cluster.domain}>
                <circle
                  cx={cluster.x}
                  cy={cluster.y}
                  r={112 + Math.min(26, count * 3)}
                  fill={DOMAIN_COLOR[cluster.domain]}
                  fillOpacity={domain === 'all' ? 0.035 : 0.06}
                  stroke={DOMAIN_COLOR[cluster.domain]}
                  strokeOpacity={0.16}
                  strokeDasharray="3 7"
                />
              </g>
            )
          })}

          {visible.edges.map((edge, index) => {
            const from = byId.get(edge.source)
            const to = byId.get(edge.target)
            if (!from || !to) return null
            const fromPoint = positionOf(from)
            const toPoint = positionOf(to)
            const dim = neighborIds ? !(neighborIds.has(edge.source) && neighborIds.has(edge.target)) : false
            const isLink = edge.relation === 'LINKS_TO'
            return (
              <line
                key={`${edge.source}-${edge.target}-${index}`}
                x1={fromPoint.x}
                y1={fromPoint.y}
                x2={toPoint.x}
                y2={toPoint.y}
                stroke={isLink ? 'var(--line-strong)' : DOMAIN_COLOR[(to.domain ?? from.domain ?? 'engineering') as Domain]}
                strokeWidth={isLink ? 1 : 0.8}
                strokeOpacity={dim ? 0.06 : isLink ? 0.4 : 0.18}
                strokeDasharray={isLink ? undefined : '2 4'}
              />
            )
          })}

          {visible.nodes.map(node => {
            const dim = neighborIds ? !neighborIds.has(node.id) : false
            const color = node.domain ? DOMAIN_COLOR[node.domain] : 'var(--ink-3)'
            const point = positionOf(node)
            if (node.kind === 'TYPE') {
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  className="graph-node"
                  style={{ opacity: dim ? 0.25 : 1 }}
                >
                  <rect x={point.x - 34} y={point.y - 13} width={68} height={26} rx={13} fill="var(--panel)" stroke="var(--line-strong)" />
                  <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
                    {node.name}
                  </text>
                </g>
              )
            }
            if (node.kind === 'DOMAIN') {
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  className="graph-node"
                  style={{ opacity: dim ? 0.25 : 1 }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <circle cx={point.x} cy={point.y} r={19} fill={color} fillOpacity={0.14} stroke={color} strokeOpacity={0.4} />
                  <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={11} fill={color} style={{ fontWeight: 600 }}>
                    {node.name}
                  </text>
                </g>
              )
            }
            if (node.kind === 'SOURCE') {
              return (
                <g
                  key={node.id}
                  data-node-id={node.id}
                  className="graph-node"
                  style={{ opacity: dim ? 0.2 : 0.9 }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <rect x={point.x - 3.4} y={point.y - 3.4} width={6.8} height={6.8} rx={1.6} fill={color} fillOpacity={0.7} stroke="var(--panel)" />
                </g>
              )
            }
            const radius = 4 + Math.min(6, node.degree * 0.32)
            return (
              <g
                key={node.id}
                data-node-id={node.id}
                className="graph-node"
                style={{ opacity: dim ? 0.2 : 1 }}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle cx={point.x} cy={point.y} r={radius + 4} fill={color} fillOpacity={0.08} />
                <circle cx={point.x} cy={point.y} r={radius} fill={color} fillOpacity={0.72} stroke="var(--panel)" strokeWidth={1.2} />
                {node.degree >= 6 && (
                  <text x={point.x} y={point.y - radius - 6} textAnchor="middle" fontSize={10.5} fill="var(--ink-2)">
                    {node.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {selectedNode && (
        <div className="graph-detail">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span className="kicker">
              {selectedNode.kind === 'PAGE' ? '知识页' : selectedNode.kind === 'SOURCE' ? '来源资料' : selectedNode.kind === 'DOMAIN' ? '业务域' : '页面类型'}
            </span>
            <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setSelected(null)} aria-label="关闭">
              ×
            </button>
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, margin: '6px 0 4px' }}>{selectedNode.name}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>
            {selectedNode.domain ? `${DOMAIN_NAME[selectedNode.domain]} · ` : ''}
            {selectedNode.pageType ? `${TYPE_NAME[selectedNode.pageType]} · ` : ''}
            {selectedNode.degree} 条关系
          </div>
          {selectedNode.kind === 'PAGE' && (
            <Link className="panel-link" style={{ display: 'inline-block', marginTop: 10 }} href={`/wiki?slug=${selectedNode.id.replace('page:', '')}`}>
              打开知识页 →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}


