import { recompile } from '../../../../lib/workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const stats = recompile()
    return Response.json({
      ok: true,
      summary: `${stats.sources} 份资料 → ${stats.pages} 个知识页 · ${stats.citations} 条引用 · ${stats.chunks} 个证据片段 · 评估 ${stats.score} 分`,
    })
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : '编译失败' }, { status: 500 })
  }
}

