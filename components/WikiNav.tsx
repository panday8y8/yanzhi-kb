'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { IconSearch } from './Icons'
import { DOMAIN_COLOR, DOMAIN_NAME } from '../lib/display'
import type { Domain } from '../lib/types'

interface NavPage {
  slug: string
  title: string
  domain: Domain
  type: string
}

const DOMAIN_ORDER: Domain[] = ['engineering', 'manufacturing', 'quality', 'supply', 'security', 'people']

export function WikiNav({ pages, activeSlug }: { pages: NavPage[]; activeSlug: string }) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const value = query.trim()
    const filtered = value ? pages.filter(page => page.title.includes(value)) : pages
    return DOMAIN_ORDER.map(domain => ({
      domain,
      items: filtered.filter(page => page.domain === domain),
    })).filter(group => group.items.length > 0)
  }, [pages, query])

  return (
    <aside className="outline scrollbar-thin">
      <div className="outline-search">
        <IconSearch size={13} />
        <input
          className="input"
          placeholder="筛选知识页"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
      </div>
      {groups.map(group => (
        <div className="outline-group" key={group.domain}>
          <div className="outline-label">
            <span>{DOMAIN_NAME[group.domain]}</span>
            <span className="mono">{group.items.length}</span>
          </div>
          {group.items.map(page => (
            <Link
              key={page.slug}
              href={`/wiki?slug=${encodeURIComponent(page.slug)}`}
              className={`outline-link${page.slug === activeSlug ? ' active' : ''}`}
            >
              <span className="dot-domain" style={{ background: DOMAIN_COLOR[page.domain] }} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.title}</span>
            </Link>
          ))}
        </div>
      ))}
      {groups.length === 0 && <div className="muted" style={{ fontSize: 12, padding: '8px 10px' }}>没有匹配的知识页</div>}
    </aside>
  )
}
