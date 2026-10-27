import { ask } from '../../../lib/qa'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { question?: string; model?: string }
  const question = (payload.question ?? '').trim()
  if (!question) {
    return Response.json({ error: 'question 不能为空' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      try {
        const result = await ask(
          { question, model: payload.model },
          {
            onEvidence: (evidence, meta) => send({ type: 'meta', evidence, ...meta }),
            onDelta: text => send({ type: 'delta', text }),
          },
        )
        send({
          type: 'done',
          status: result.status,
          confidence: result.confidence,
          answer: result.answer,
          citations: result.citations,
          mode: result.mode,
          model: result.model,
          latencyMs: result.latencyMs,
          usage: result.usage,
          notice: result.notice,
        })
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
