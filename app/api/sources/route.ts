import fs from 'node:fs'
import path from 'node:path'
import { parseRawDoc } from '../../../lib/parse'
import { ROOT } from '../../../lib/paths'
import { recompile } from '../../../lib/workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { content?: string }
  const content = (payload.content ?? '').trim()
  if (!content) {
    return Response.json({ ok: false, error: '内容为空' }, { status: 400 })
  }
  const fileName = `${Date.now()}.md`
  const doc = parseRawDoc(fileName, content)
  if (!doc) {
    return Response.json(
      { ok: false, error: '解析失败：请检查 frontmatter（doc_id / title / domain / type / topics / summary）与二级标题结构' },
      { status: 400 },
    )
  }
  if (doc.sections.length < 2) {
    return Response.json({ ok: false, error: '至少需要 2 个二级标题小节' }, { status: 400 })
  }

  const target = path.join(ROOT, 'content', 'raw', `${doc.docId}.md`)
  if (fs.existsSync(target)) {
    return Response.json({ ok: false, error: `doc_id「${doc.docId}」已存在，请换一个` }, { status: 409 })
  }
  fs.writeFileSync(target, content.replace(/\r\n/g, '\n'), 'utf8')

  try {
    const stats = recompile()
    return Response.json({
      ok: true,
      summary: `已保存 ${doc.docId}：${stats.sources} 份资料 → ${stats.pages} 个知识页，${stats.citations} 条引用，${stats.chunks} 个证据片段`,
    })
  } catch (error) {
    fs.rmSync(target, { force: true })
    return Response.json({ ok: false, error: `编译失败：${error instanceof Error ? error.message : '未知错误'}` }, { status: 500 })
  }
}
