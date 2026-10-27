import { DOMAIN_LABEL, TYPE_LABEL, type Domain, type GraphData, type GraphEdge, type GraphNode, type PageType, type RawDoc, type WikiPage } from './types'

const DOMAINS_ORDER: Domain[] = ['engineering', 'manufacturing', 'quality', 'supply', 'security', 'people']
const TYPES_ORDER: PageType[] = ['policy', 'system', 'playbook', 'concept']

export function buildGraph(pages: WikiPage[], docs: RawDoc[]): GraphData {
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const seenEdges = new Set<string>()

  const addEdge = (source: string, target: string, relation: GraphEdge['relation']) => {
    const key = `${source}->${target}:${relation}`
    if (seenEdges.has(key)) return
    seenEdges.add(key)
    edges.push({ source, target, relation })
  }

  for (const domain of DOMAINS_ORDER) {
    nodes.set(`domain:${domain}`, { id: `domain:${domain}`, name: DOMAIN_LABEL[domain], kind: 'DOMAIN', domain, degree: 0 })
  }
  for (const type of TYPES_ORDER) {
    nodes.set(`type:${type}`, { id: `type:${type}`, name: TYPE_LABEL[type], kind: 'TYPE', pageType: type, degree: 0 })
  }
  for (const doc of docs) {
    nodes.set(`source:${doc.docId}`, { id: `source:${doc.docId}`, name: doc.title, kind: 'SOURCE', domain: doc.domain, degree: 0 })
  }
  for (const page of pages) {
    nodes.set(`page:${page.slug}`, {
      id: `page:${page.slug}`,
      name: page.title,
      kind: 'PAGE',
      domain: page.domain,
      pageType: page.type,
      degree: 0,
    })
  }

  const pageBySlug = new Map(pages.map(page => [page.slug, page]))
  for (const page of pages) {
    const source = `page:${page.slug}`
    for (const link of page.links) {
      if (pageBySlug.has(link.slug)) addEdge(source, `page:${link.slug}`, 'LINKS_TO')
    }
    for (const docId of page.sourceDocIds) {
      if (nodes.has(`source:${docId}`)) addEdge(source, `source:${docId}`, 'CITES')
    }
    addEdge(source, `domain:${page.domain}`, 'IN_DOMAIN')
    addEdge(source, `type:${page.type}`, 'OF_TYPE')
  }

  for (const edge of edges) {
    const from = nodes.get(edge.source)
    const to = nodes.get(edge.target)
    if (from) from.degree += 1
    if (to) to.degree += 1
  }

  const nodeList = [...nodes.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const edgeList = edges.slice().sort((a, b) => {
    if (a.relation !== b.relation) return a.relation < b.relation ? -1 : 1
    if (a.source !== b.source) return a.source < b.source ? -1 : 1
    return a.target < b.target ? -1 : 1
  })

  return {
    nodes: nodeList,
    edges: edgeList,
    meta: {
      generatedAt: new Date().toISOString(),
      pages: pages.length,
      sources: docs.length,
      domains: DOMAINS_ORDER.length,
      types: TYPES_ORDER.length,
    },
  }
}

export interface PositionedNode extends GraphNode {
  x: number
  y: number
  cluster: number
}

export interface LaidOutGraph {
  nodes: PositionedNode[]
  edges: GraphEdge[]
  width: number
  height: number
  clusters: { domain: Domain; label: string; x: number; y: number; count: number }[]
}

const WIDTH = 1080
const HEIGHT = 660
const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 + 14 }
const CLUSTER_RADIUS = 232

/** 确定性星座布局：业务域成簇，知识页沿黄金角铺开，来源文档贴内圈。 */
export function layoutGraph(graph: GraphData): LaidOutGraph {
  const clusters = DOMAINS_ORDER.map((domain, index) => {
    const angle = (-90 + index * 60) * (Math.PI / 180)
    return {
      domain,
      label: DOMAIN_LABEL[domain],
      x: CENTER.x + Math.cos(angle) * CLUSTER_RADIUS,
      y: CENTER.y + Math.sin(angle) * (CLUSTER_RADIUS * 0.82),
      count: 0,
    }
  })
  const clusterByDomain = new Map(clusters.map((cluster, index) => [cluster.domain, { ...cluster, index }]))

  const nodes: PositionedNode[] = []
  const counters = new Map<Domain, number>()
  for (const node of graph.nodes) {
    if (node.kind === 'DOMAIN') {
      const cluster = clusterByDomain.get(node.domain as Domain)
      if (!cluster) continue
      nodes.push({ ...node, x: cluster.x, y: cluster.y, cluster: cluster.index })
      continue
    }
    if (node.kind === 'TYPE') {
      const index = TYPES_ORDER.indexOf(node.pageType as PageType)
      nodes.push({ ...node, x: 120 + index * 150, y: 52, cluster: -1 })
      continue
    }
    const domain = node.domain as Domain
    const cluster = clusterByDomain.get(domain)
    if (!cluster) continue
    const index = counters.get(domain) ?? 0
    counters.set(domain, index + 1)
    cluster.count += 1
    const isSource = node.kind === 'SOURCE'
    const ringBase = isSource ? 48 : 76
    const perRing = isSource ? 6 : 8
    const ring = Math.floor(index / perRing)
    const angle = (index % perRing) * ((Math.PI * 2) / perRing) + ring * 0.52 + (isSource ? 0.3 : 0)
    const radius = ringBase + ring * (isSource ? 30 : 44)
    nodes.push({
      ...node,
      x: cluster.x + Math.cos(angle) * radius,
      y: cluster.y + Math.sin(angle) * radius * 0.88,
      cluster: cluster.index,
    })
  }

  return {
    nodes,
    edges: graph.edges,
    width: WIDTH,
    height: HEIGHT,
    clusters: clusters.map(cluster => ({ ...cluster })),
  }
}
