import Link from 'next/link'
import { IconArrow, IconBook } from '../../components/Icons'
import { WikiNav } from '../../components/WikiNav'
import { DOMAIN_COLOR, DOMAIN_NAME, TYPE_NAME, formatDate } from '../../lib/display'
import { getPages } from '../../lib/workspace'
import type { PageBlock } from '../../lib/types'

export const dynamic = 'force-dynamic'

function Cite({ numbers }: { numbers: number[] }) {
  return (
    <>
      {numbers.map(n => (
        <a key={n} href={`#src-${n}`} className="cite" title={`查看来源 ${n}`}>
          {n}
        </a>
      ))}
    </>
  )
}

function Block({ block, index }: { block: PageBlock; index: number }) {
  return (
    <section className="block">
      <h2 className="block-title">
        <span className="num">{String(index + 1).padStart(2, '0')}</span>
        {block.heading}
      </h2>
      <div className="prose">
        {block.paras.map((paragraph, i) => (
          <p key={i}>
            {paragraph.text}
            <Cite numbers={paragraph.citations} />
          </p>
        ))}
        {block.bullets.length > 0 && (
          <ul className="bullets">
            {block.bullets.map((bullet, i) => (
              <li key={i}>
                {bullet.text}
                <Cite numbers={bullet.citations} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default async function WikiPage({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  const params = await searchParams
  const pages = getPages()
  const active = pages.find(page => page.slug === params.slug) ?? pages[0]
  const relatedSources = active ? active.citations : []

  return (
    <main className="page">
      <div className="wiki-layout">
        <WikiNav
          pages={pages.map(page => ({ slug: page.slug, title: page.title, domain: page.domain, type: page.type }))}
          activeSlug={active?.slug ?? ''}
        />

        {active ? (
          <article className="article fade-up">
            <header className="article-head">
              <div className="article-meta">
                <span className="tag" style={{ color: DOMAIN_COLOR[active.domain], borderColor: 'var(--line-strong)' }}>
                  <span className="dot-domain" style={{ background: DOMAIN_COLOR[active.domain] }} />
                  {DOMAIN_NAME[active.domain]}
                </span>
                <span className="tag">{TYPE_NAME[active.type]}</span>
                <span className="tag">{active.citations.length} 条来源引用</span>
                <span className="tag">{active.links.length} 个相关主题</span>
                <span className="muted mono" style={{ fontSize: 11 }}>
                  更新于 {formatDate(active.updatedAt)}
                </span>
              </div>
              <h1 className="article-title">{active.title}</h1>
              <p className="article-summary">{active.summary}</p>
            </header>

            {active.blocks.map((block, index) => (
              <Block key={block.heading} block={block} index={index} />
            ))}

            {active.links.length > 0 && (
              <section className="block" style={{ marginBottom: 0 }}>
                <h2 className="block-title">
                  <span className="num">↗</span>
                  相关主题
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {active.links.map(link => (
                    <Link key={link.slug} className="btn btn-sm" href={`/wiki?slug=${encodeURIComponent(link.slug)}`}>
                      {link.title}
                      <IconArrow size={12} />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>
        ) : (
          <div className="panel" style={{ padding: 40 }}>
            <div className="panel-title">还没有知识页</div>
            <p className="muted" style={{ marginTop: 8 }}>
              在项目根目录运行 <code className="mono">pnpm kb:compile</code> 生成知识页。
            </p>
          </div>
        )}

        {active && (
          <aside className="source-rail scrollbar-thin">
            <div className="rail-panel">
              <div className="rail-title">来源引用 · {relatedSources.length}</div>
              {relatedSources.map(citation => (
                <div className="source-card" key={citation.n} id={`src-${citation.n}`}>
                  <div className="source-head">
                    <span className="source-n">{citation.n}</span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {citation.docTitle}
                    </span>
                  </div>
                  <div className="ev-section">小节：{citation.section}</div>
                  <div className="source-quote">{citation.quote}</div>
                </div>
              ))}
            </div>

            <div className="rail-panel">
              <div className="rail-title">引用到的资料</div>
              {[...new Set(active.citations.map(citation => citation.docId))].map(docId => {
                const citation = active.citations.find(item => item.docId === docId)!
                return (
                  <Link key={docId} className="backlink" href="/sources">
                    <IconBook size={13} />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {citation.docTitle}
                    </span>
                  </Link>
                )
              })}
            </div>
          </aside>
        )}
      </div>
    </main>
  )
}

