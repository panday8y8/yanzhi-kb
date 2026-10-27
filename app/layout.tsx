import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Shell } from '../components/Shell'
import { getModelConfig } from '../lib/qa'
import { ensureWorkspace, getChunkCount, getCompiledAt, getPages } from '../lib/workspace'

export const metadata: Metadata = {
  title: '砚知 · 北辰制造知识中枢',
  description: '编译式 Wiki + 本地检索 + 知识图谱 + 可溯源问答',
}

export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: ReactNode }) {
  ensureWorkspace()
  const pages = getPages()
  const meta = {
    pages: pages.length,
    chunks: getChunkCount(),
    sources: new Set(pages.flatMap(page => page.sourceDocIds)).size,
    modelConfigured: getModelConfig().configured,
    compiledAt: getCompiledAt(),
  }
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <body>
        <Shell
          meta={meta}
          pages={pages.map(page => ({ slug: page.slug, title: page.title, domain: page.domain }))}
        >
          {children}
        </Shell>
      </body>
    </html>
  )
}
