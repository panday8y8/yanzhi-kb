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
const MIN_ZOOM = 0.4
const MAX_ZOOM = 3
const DRAG_THRESHOLD = 3
const VIEW_W = 1080
const VIEW_H = 660

const RELATION_NAME: Record<GraphEdge['relation'], string> = {
  LINKS_TO: '内链',
  CITES: '引用',
  IN_DOMAIN: '归属',
  OF_TYPE: '类型',
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function GraphCanvas({ nodes, edges, clusters }: Props) {
  const [domain, setDomain] = useState<Domain | 'all'>('all')
  const [query, setQuery] = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, k: 1 })
  const [positions, setPositions] = useState<Record<string, Point>>({})
  const [pinned, setPinned] = useState<Record<string, boolean>>({})
  const [dragging, setDragging] = useState(false)
  const [showMatches, setShowMatches] = useState(false)
  const [showHint, setShowHint] = useState(true)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const movedRef = useRef(0)
  const pinchRef = useRef<{ distance: number; k: number; anchor: Point } | null>(null)
  const pointersRef = useRef(new Map<number, Point>())

  const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes])

  const positionOf = useCallback(
    (node: { id: string; x: number; y: number }): Point => positions[node.id] ?? { x: node.x, y: node.y },
    [positions],
  )

  const baseVisible = useMemo(() => {
    return nodes.filter(node => {
      if (node.kind === 'TYPE') return domain === 'all'
      if (node.kind === 'DOMAIN') return domain === 'all' || node.domain === domain
      if (domain !== 'all' && node.domain !== domain) return false
      return true
    })
  }, [nodes, domain])

  const focusSet = useMemo(() => {
    if (!focusId) return null
    if (!baseVisible.some(node => node.id === focusId)) return null
    const ids = new Set<string>([focusId])
    for (const edge of edges) {
      if (edge.relation === 'OF_TYPE') continue
      if (edge.source === focusId) ids.add(edge.target)
      if (edge.target === focusId) ids.add(edge.source)
    }
    return ids
  }, [focusId, baseVisible, edges])

  const visible = useMemo(() => {
    const keep = new Set(baseVisible.filter(node => !focusSet || focusSet.has(node.id)).map(node => node.id))
    return {
      nodes: nodes.filter(node => keep.has(node.id)),
      edges: edges.filter(edge => edge.relation !== 'OF_TYPE' && keep.has(edge.source) && keep.has(edge.target)),
    }
  }, [baseVisible, focusSet, nodes, edges])

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return []
    return nodes.filter(node => node.name.toLowerCase().includes(text)).slice(0, 6)
  }, [nodes, query])

  const matchedIds = useMemo(() => new Set(matches.map(node => node.id)), [matches])

  const neighborIds = useMemo(() => {
    const source = hovered ?? selected
    if (!source) return null
    const ids = new Set<string>([source])
    for (const edge of visible.edges) {
      if (edge.source === source) ids.add(edge.target)
      if (edge.target === source) ids.add(edge.source)
    }
    return ids
  }, [hovered, selected, visible.edges])

  const selectedNode = selected ? nodeById.get(selected) ?? null : null

  const neighbors = useMemo(() => {
    if (!selected) return []
    const result: { id: string; name: string; relation: string; direction: 'out' | 'in' }[] = []
    for (const edge of edges) {
      if (edge.relation === 'OF_TYPE') continue
      if (edge.source === selected) {
        const node = nodeById.get(edge.target)
        if (node) result.push({ id: node.id, name: node.name, relation: RELATION_NAME[edge.relation], direction: 'out' })
      } else if (edge.target === selected) {
        const node = nodeById.get(edge.source)
        if (node) result.push({ id: node.id, name: node.name, relation: RELATION_NAME[edge.relation], direction: 'in' })
      }
    }
    return result.slice(0, 6)
  }, [selected, edges, nodeById])

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

  const centerOn = useCallback(
    (id: string) => {
      const node = nodeById.get(id)
      if (!node) return
      const point = positionOf(node)
      setView(prev => ({ ...prev, x: VIEW_W / 2 - point.x * prev.k, y: VIEW_H / 2 - point.y * prev.k }))
    },
    [nodeById, positionOf],
  )

  const selectNode = useCallback(
    (id: string, center = false) => {
      const node = nodeById.get(id)
      if (node?.domain && domain !== 'all' && node.domain !== domain) {
        setDomain('all')
        setFocusId(null)
      }
      setSelected(id)
      setQuery('')
      setShowMatches(false)
      if (center) centerOn(id)
    },
    [centerOn, nodeById, domain],
  )

  const zoomBy = useCallback((factor: number, anchor?: Point) => {
    setView(prev => {
      const nextK = clamp(prev.k * factor, MIN_ZOOM, MAX_ZOOM)
      if (nextK === prev.k) return prev
      const cx = anchor?.x ?? VIEW_W / 2
      const cy = anchor?.y ?? VIEW_H / 2
      const ratio = nextK / prev.k
      return { k: nextK, x: cx - (cx - prev.x) * ratio, y: cy - (cy - prev.y) * ratio }
    })
  }, [])

  const fitView = useCallback(() => {
    const points = visible.nodes.map(positionOf)
    if (!points.length) return
    const xs = points.map(point => point.x)
    const ys = points.map(point => point.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const padding = 90
    const scale = clamp(
      Math.min((VIEW_W - padding * 2) / Math.max(120, maxX - minX), (VIEW_H - padding * 2) / Math.max(120, maxY - minY)),
      MIN_ZOOM,
      2.2,
    )
    setView({
      k: scale,
      x: VIEW_W / 2 - ((minX + maxX) / 2) * scale,
      y: VIEW_H / 2 - ((minY + maxY) / 2) * scale,
    })
  }, [visible.nodes, positionOf])

  const resetAll = useCallback(() => {
    setView({ x: 0, y: 0, k: 1 })
    setPositions({})
    setPinned({})
    setSelected(null)
    setFocusId(null)
    setQuery('')
  }, [])

  const fitRef = useRef(fitView)
  fitRef.current = fitView

  const fitKeyRef = useRef('')
  useEffect(() => {
    const key = `${domain}|${focusId ?? ''}`
    if (fitKeyRef.current === key) return
    fitKeyRef.current = key
    if (domain === 'all' && !focusId) return
    const timer = setTimeout(() => fitRef.current(), 40)
    return () => clearTimeout(timer)
  }, [domain, focusId])
  const toggleFocus = useCallback((id: string) => {
    setFocusId(current => (current === id ? null : id))
    setSelected(id)
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      setShowHint(false)
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointersRef.current.size === 2) {
        const [a, b] = [...pointersRef.current.values()]
        pinchRef.current = {
          distance: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)),
          k: view.k,
          anchor: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2),
        }
        dragRef.current = null
        return
      }

      const target = event.target as Element
      if (target.closest('.graph-detail') || target.closest('.graph-toolbar')) return
      const nodeGroup = target.closest('[data-node-id]')
      const start = toSvg(event.clientX, event.clientY)
      movedRef.current = 0
      setDragging(true)

      if (nodeGroup) {
        const id = nodeGroup.getAttribute('data-node-id')
        const node = id ? nodeById.get(id) : undefined
        if (id && node) {
          dragRef.current = { type: 'node', id, start, base: positionOf(node) }
          return
        }
      }
      dragRef.current = { type: 'pan', start, origin: { x: view.x, y: view.y } }
    },
    [nodeById, positionOf, toSvg, view.x, view.y, view.k],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }
      const pinch = pinchRef.current
      if (pinch && pointersRef.current.size >= 2) {
        const [a, b] = [...pointersRef.current.values()]
        const distance = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))
        const targetK = clamp(pinch.k * (distance / pinch.distance), MIN_ZOOM, MAX_ZOOM)
        setView(prev => {
          const ratio = targetK / prev.k
          return {
            k: targetK,
            x: pinch.anchor.x - (pinch.anchor.x - prev.x) * ratio,
            y: pinch.anchor.y - (pinch.anchor.y - prev.y) * ratio,
          }
        })
        return
      }

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
    pinchRef.current = null
    setDragging(false)
    if (!drag) return
    if (moved > DRAG_THRESHOLD) {
      if (drag.type === 'node') {
        setPinned(prev => ({ ...prev, [drag.id]: true }))
        setSelected(drag.id)
      }
      return
    }
    if (drag.type === 'node') {
      selectNode(drag.id)
    } else {
      setSelected(null)
    }
  }, [selectNode])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoomBy(Math.exp(-event.deltaY * 0.0015), toSvg(event.clientX, event.clientY))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [toSvg, zoomBy])

  useEffect(() => {
    const onUp = (event: PointerEvent) => {
      pointersRef.current.delete(event.pointerId)
      if (pointersRef.current.size < 2) pinchRef.current = null
      finishDrag()
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [finishDrag])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea'
      if (event.key === 'Escape') {
        setSelected(null)
        setFocusId(null)
        setQuery('')
        setShowMatches(false)
        return
      }
      if (typing) return
      if (event.key === 'f' || event.key === 'F') fitView()
      if (event.key === '0') resetAll()
      if (event.key === '+' || event.key === '=') zoomBy(1.2)
      if (event.key === '-') zoomBy(1 / 1.2)
      if (event.key === '/') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fitView, resetAll, zoomBy])

  const pageLabelVisible = (id: string, degree: number) =>
    view.k >= 1.15 || degree >= 6 || selected === id || hovered === id || focusId === id

  return (
    <div className="graph-shell">
      <div className="graph-toolbar">
        <div className="graph-row">
          <div className="graph-search">
            <input
              ref={searchRef}
              className="input"
              placeholder="搜索知识页 / 资料…（按 / 聚焦）"
              value={query}
              onChange={event => {
                setQuery(event.target.value)
                setShowMatches(true)
              }}
              onFocus={() => setShowMatches(true)}
              onKeyDown={event => {
                if (event.key === 'Enter' && matches[0]) selectNode(matches[0].id, true)
                if (event.key === 'Escape') setShowMatches(false)
              }}
              aria-label="搜索图谱节点"
            />
            {showMatches && matches.length > 0 && (
              <div className="graph-matches">
                {matches.map(node => (
                  <button key={node.id} type="button" onClick={() => selectNode(node.id, true)}>
                    <span>{node.name}</span>
                    <em>{node.domain ? DOMAIN_NAME[node.domain] : node.kind}</em>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="legend">
            <button
              type="button"
              className="suggestion"
              style={domain === 'all' ? { color: 'var(--seal)', borderColor: 'var(--seal)' } : undefined}
              onClick={() => {
                setDomain('all')
                setFocusId(null)
              }}
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
                onClick={() => {
                  setDomain(current => (current === item ? 'all' : item))
                  setFocusId(null)
                }}
              >
                <span className="dot-domain" style={{ background: DOMAIN_COLOR[item], display: 'inline-block', marginRight: 5 }} />
                {DOMAIN_NAME[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="graph-row graph-row-secondary">
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
              <span className="legend-line" />
              内链
            </span>
            <span className="legend-item">
              <span className="legend-line dashed" />
              引用 / 归属
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
              {visible.nodes.length} 节点 / {visible.edges.length} 边
            </span>
            {focusId && (
              <span className="graph-focus-chip">
                聚焦：{nodeById.get(focusId)?.name ?? ''}
                <button type="button" aria-label="退出聚焦" onClick={() => setFocusId(null)}>×</button>
              </span>
            )}
          </div>
          <div className="legend graph-controls">
            <span className="graph-hint">拖动平移 · 滚轮缩放 · 拖动节点可固定</span>
            <button type="button" className="icon-btn" aria-label="放大" onClick={() => zoomBy(1.2)}>+</button>
            <button type="button" className="icon-btn" aria-label="缩小" onClick={() => zoomBy(1 / 1.2)}>−</button>
            <button type="button" className="suggestion" onClick={fitView}>适配</button>
            <button type="button" className="suggestion" onClick={resetAll}>重置</button>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        className={`graph-svg${dragging ? ' dragging' : ''}`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="知识图谱：可搜索、拖拽平移、滚轮缩放、点击查看邻居"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
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
            const from = nodeById.get(edge.source)
            const to = nodeById.get(edge.target)
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
            const isMatch = matchedIds.has(node.id)
            const isSelected = selected === node.id
            const isPinned = Boolean(pinned[node.id])

            const common = {
              'data-node-id': node.id,
              className: 'graph-node',
              opacity: dim ? 0.22 : 1,
              tabIndex: 0,
              role: 'button' as const,
              onMouseEnter: () => setHovered(node.id),
              onMouseLeave: () => setHovered(null),
              onFocus: () => setHovered(node.id),
              onBlur: () => setHovered(null),
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  selectNode(node.id, true)
                }
              },
            }

            if (node.kind === 'TYPE') {
              return (
                <g key={node.id} {...common}>
                  <rect x={point.x - 34} y={point.y - 13} width={68} height={26} rx={13} fill="var(--panel)" stroke={isSelected ? 'var(--seal)' : 'var(--line-strong)'} />
                  <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
                    {node.name}
                  </text>
                </g>
              )
            }
            if (node.kind === 'DOMAIN') {
              return (
                <g key={node.id} {...common}>
                  <circle cx={point.x} cy={point.y} r={26} fill="transparent" />
                  <circle cx={point.x} cy={point.y} r={19} fill={color} fillOpacity={0.14} stroke={isSelected ? 'var(--seal)' : color} strokeOpacity={isSelected ? 1 : 0.4} />
                  <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={11} fill={color} style={{ fontWeight: 600 }}>
                    {node.name}
                  </text>
                </g>
              )
            }
            if (node.kind === 'SOURCE') {
              return (
                <g key={node.id} {...common}>
                  <circle cx={point.x} cy={point.y} r={10} fill="transparent" />
                  <rect x={point.x - 3.4} y={point.y - 3.4} width={6.8} height={6.8} rx={1.6} fill={color} fillOpacity={0.7} stroke="var(--panel)" />
                  {isMatch && <circle cx={point.x} cy={point.y} r={9} fill="none" stroke="var(--seal)" strokeDasharray="2 2" />}
                </g>
              )
            }
            const radius = 4 + Math.min(6, node.degree * 0.32)
            return (
              <g key={node.id} {...common}>
                <circle cx={point.x} cy={point.y} r={radius + 12} fill="transparent" />
                <circle cx={point.x} cy={point.y} r={radius + 4} fill={color} fillOpacity={0.08} />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  fill={color}
                  fillOpacity={0.72}
                  stroke={isSelected ? 'var(--seal)' : 'var(--panel)'}
                  strokeWidth={isSelected ? 2 : 1.2}
                />
                {isPinned && (
                  <circle cx={point.x} cy={point.y} r={radius + 6} fill="none" stroke="var(--seal)" strokeOpacity={0.55} strokeDasharray="2 3" />
                )}
                {isMatch && <circle cx={point.x} cy={point.y} r={radius + 8} fill="none" stroke="var(--seal)" strokeDasharray="3 3" />}
                {pageLabelVisible(node.id, node.degree) && (
                  <text x={point.x} y={point.y - radius - 6} textAnchor="middle" fontSize={10.5 / Math.sqrt(view.k)} fill="var(--ink-2)">
                    {node.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {showHint && (
        <div className="graph-onboard">
          <span>拖动空白平移 · 滚轮缩放 · 点节点看详情</span>
          <button type="button" onClick={() => setShowHint(false)}>知道了</button>
        </div>
      )}

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

          {neighbors.length > 0 && (
            <div className="graph-neighbors">
              <div className="graph-neighbors-title">直接关联</div>
              {neighbors.map((item, index) => (
                <button key={`${item.id}-${item.relation}-${index}`} type="button" onClick={() => selectNode(item.id, true)}>
                  <span>{item.name}</span>
                  <em>{item.direction === 'out' ? '→' : '←'} {item.relation}</em>
                </button>
              ))}
            </div>
          )}

          <div className="graph-actions">
            <button type="button" className="suggestion" onClick={() => centerOn(selectedNode.id)}>居中</button>
            <button type="button" className="suggestion" onClick={() => toggleFocus(selectedNode.id)}>
              {focusId === selectedNode.id ? '退出聚焦' : '只看邻居'}
            </button>
            <button type="button" className="suggestion" onClick={() => setPinned(prev => ({ ...prev, [selectedNode.id]: !prev[selectedNode.id] }))}>
              {pinned[selectedNode.id] ? '取消固定' : '固定位置'}
            </button>
          </div>

          {selectedNode.kind === 'PAGE' && (
            <Link className="panel-link" style={{ display: 'inline-block', marginTop: 9 }} href={`/wiki?slug=${selectedNode.id.replace('page:', '')}`}>
              打开知识页 →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}



