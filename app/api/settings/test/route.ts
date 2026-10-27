import { testModel } from '../../../../lib/qa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { model?: string }
  const result = await testModel(payload.model)
  return Response.json(result, { status: result.ok ? 200 : 502 })
}
