'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { formatDateTime } from '../lib/display'
import {
  IconBook,
  IconChat,
  IconCheck,
  IconGraph,
  IconMoon,
  IconOverview,
  IconSearch,
  IconSettings,
  IconSources,
  IconSun,
} from './Icons'

const NAV = [
  { href: '/', label: '知识总览', index: '01', icon: IconOverview },
  { href: '/sources', label: '资料库', index: '02', icon: IconSources },
  { href: '/wiki', label: '知识库', index: '03', icon: IconBook },
  { href: '/ask', label: '智能问答', index: '04', icon: IconChat },
  { href: '/graph', label: '知识图谱', index: '05', icon: IconGraph },
  { href: '/evaluation', label: '质量评估', index: '06', icon: IconCheck },
  { href: '/settings', label: '系统设置', index: '07', icon: IconSettings },
]

const PAGE_TITLE: Record<string, string> = {
  '/': '知识总览',
  '/sources': '资料库',
  '/wiki': '知识库',
  '/ask': '智能问答',
  '/graph': '知识图谱',
  '/evaluation': '质量评估',
  '/settings': '系统设置',
}

export interface ShellProps {
  children: ReactNode
  pages: { slug: string; title: string; domain: string }[]
  meta: { pages: number; chunks: number; sources: number; modelConfigured: boolean; compiledAt: string }
}

export function Shell({ children, pages, meta }: ShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = (localStorage.getItem('yanzhi-theme') as 'light' | 'dark' | null) ?? 'light'
    setTheme(saved)
    document.documentElement.dataset.theme = saved
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('yanzhi-theme', next)
  }

  const items = useMemo(() => {
    const navItems = NAV.map(item => ({ kind: '页面', label: item.label, href: item.href }))
    const pageItems = pages.map(page => ({ kind: '知识页', label: page.title, href: `/wiki?slug=${encodeURIComponent(page.slug)}` }))
    const all = [...navItems, ...pageItems]
    const value = query.trim().toLowerCase()
    if (!value) return all.slice(0, 9)
    return all.filter(item => item.label.toLowerCase().includes(value) || item.kind.includes(value)).slice(0, 10)
  }, [pages, query])

  useEffect(() => {
    if (!paletteOpen) return
    setQuery('')
    setActiveIndex(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(timer)
  }, [paletteOpen])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(open => !open)
      }
      if (event.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const go = (href: string) => {
    setPaletteOpen(false)
    router.push(href)
  }

  const onPaletteKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(items.length - 1, index + 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(0, index - 1))
    }
    if (event.key === 'Enter' && items[activeIndex]) go(items[activeIndex].href)
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">砚</span>
          <span className="brand-text">
            <span className="brand-name">砚知</span>
            <span className="brand-sub">Knowledge Studio</span>
          </span>
        </Link>

        <nav className="nav-group">
          <div className="nav-label">工作台</div>
          {NAV.map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={`nav-item${active ? ' active' : ''}`}>
                <span className="nav-index">{item.index}</span>
                <Icon size={15} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="foot-line">
            <span>编译状态</span>
            <span className="status-dot" />
          </div>
          <div className="foot-line">
            <span>知识页</span>
            <b className="mono">{meta.pages}</b>
          </div>
          <div className="foot-line">
            <span>证据片段</span>
            <b className="mono">{meta.chunks}</b>
          </div>
          <div className="foot-line">
            <span>模型</span>
            <span className={meta.modelConfigured ? 'status-dot' : 'status-dot warn'} />
          </div>
          <div className="foot-line">
            <span style={{ fontSize: 10, letterSpacing: '.08em' }}>{formatDateTime(meta.compiledAt)}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="crumb">
            <span>北辰制造</span>
            <span>/</span>
            <b>{PAGE_TITLE[pathname] ?? (pathname.startsWith('/wiki') ? '知识库' : '工作台')}</b>
          </div>
          <div className="top-actions">
            <button type="button" className="btn btn-sm" onClick={() => setPaletteOpen(true)}>
              <IconSearch size={13} />
              搜索知识
              <span className="kbd">Ctrl K</span>
            </button>
            <button type="button" className="icon-btn" aria-label="切换主题" onClick={toggleTheme}>
              {theme === 'light' ? <IconMoon size={15} /> : <IconSun size={15} />}
            </button>
            <div
              className="brand-mark"
              style={{ width: 30, height: 30, fontSize: 14, borderRadius: 9 }}
              title="当前用户"
            >
              北
            </div>
          </div>
        </header>
        {children}
      </div>

      {paletteOpen && (
        <div className="palette-mask" onClick={() => setPaletteOpen(false)}>
          <div className="palette" onClick={event => event.stopPropagation()}>
            <input
              ref={inputRef}
              value={query}
              placeholder="搜索页面或知识页…"
              onChange={event => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={onPaletteKey}
            />
            <div className="palette-list">
              {items.length === 0 && <div className="palette-empty">没有匹配项，换个关键词试试</div>}
              {items.map((item, index) => (
                <div
                  key={`${item.kind}-${item.href}`}
                  className="palette-item"
                  data-active={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(item.href)}
                >
                  <span>{item.label}</span>
                  <span className="tag">{item.kind}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}




