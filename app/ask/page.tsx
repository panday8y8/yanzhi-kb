import { AskPanel } from '../../components/AskPanel'
import { getModelConfig } from '../../lib/qa'
import { EVAL_CASES } from '../../lib/eval'

export const dynamic = 'force-dynamic'

export default function AskPage() {
  const config = getModelConfig()
  const suggestions = EVAL_CASES.filter(item => item.kind === 'answer').slice(0, 4).map(item => item.question)
  return (
    <main className="page">
      <AskPanel
        config={{ configured: config.configured, model: config.model, models: config.models }}
        suggestions={suggestions}
      />
    </main>
  )
}
