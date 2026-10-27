import { localAnswer } from './qa'
import { NO_EVIDENCE_THRESHOLD, search, toEvidence } from './retrieval'
import type { Chunk, EvalCase, EvalCaseResult, EvalReport } from './types'

/** 12 道固定题：10 道有证据题 + 2 道应当诚实拒答题。 */
export const EVAL_CASES: EvalCase[] = [
  {
    id: 'release-gate',
    question: '北辰平台的版本发布要过哪几道门禁？',
    expectPages: ['发布门禁', '变更管理'],
    keywords: ['门禁', '评审', '扫描'],
    minPages: 2,
    kind: 'answer',
  },
  {
    id: 'gray-release',
    question: '灰度发布批次怎么推进？出问题多久必须回滚？',
    expectPages: ['灰度批次', '发布门禁'],
    keywords: ['灰度', '回滚', '15'],
    minPages: 2,
    kind: 'answer',
  },
  {
    id: 'changeover',
    question: '产线换型后首件怎么确认？',
    expectPages: ['首件确认', '换型效率'],
    keywords: ['首件', '三检', '换型'],
    minPages: 2,
    kind: 'answer',
  },
  {
    id: 'oee',
    question: 'OEE 的统计口径由哪三部分组成？',
    expectPages: ['指标口径', '设备可用率'],
    keywords: ['可用率', '性能率', '良品率'],
    minPages: 1,
    kind: 'answer',
  },
  {
    id: 'ncr',
    question: '不合格品如何分级和处置？',
    expectPages: ['不合格品处置', '纠正措施'],
    keywords: ['不合格', '隔离', '8D'],
    minPages: 1,
    kind: 'answer',
  },
  {
    id: 'supplier',
    question: '新供应商准入要走哪些步骤？',
    expectPages: ['供应商准入', '现场审核'],
    keywords: ['准入', '现场审核', '样件'],
    minPages: 2,
    kind: 'answer',
  },
  {
    id: 'shortage',
    question: '缺料分几级？各级的响应时限是多少？',
    expectPages: ['缺料响应', '安全库存'],
    keywords: ['缺料', '响应', '小时'],
    minPages: 2,
    kind: 'answer',
  },
  {
    id: 'retention',
    question: '秘密级数据允许留存多久？外部共享要谁审批？',
    expectPages: ['数据留存', '数据分级'],
    keywords: ['留存', '7 年', '审批'],
    minPages: 2,
    kind: 'answer',
  },
  {
    id: 'incident',
    question: 'P0 级安全事件要在多久内响应、多久内止损？',
    expectPages: ['事件响应', '事故复盘'],
    keywords: ['P0', '15 分钟', '止损'],
    minPages: 1,
    kind: 'answer',
  },
  {
    id: 'onboarding',
    question: '新员工入职 30 天内要完成哪些认证？',
    expectPages: ['入职流程', '上岗认证', '培训认证'],
    keywords: ['入职', '认证', '试用期'],
    minPages: 2,
    kind: 'answer',
  },
  {
    id: 'canteen',
    question: '员工食堂周末几点开饭？',
    expectPages: [],
    keywords: [],
    kind: 'no_evidence',
  },
  {
    id: 'campus-plan',
    question: '2027 年校招计划招多少人？',
    expectPages: [],
    keywords: [],
    kind: 'no_evidence',
  },
]

function distinctTitles(hits: { pageTitle: string }[], limit = 3): string[] {
  const titles: string[] = []
  for (const hit of hits) {
    if (titles.includes(hit.pageTitle)) continue
    titles.push(hit.pageTitle)
    if (titles.length >= limit) break
  }
  return titles
}

export function runEval(chunks: Chunk[], cases: EvalCase[] = EVAL_CASES): EvalReport {
  const results: EvalCaseResult[] = []

  for (const item of cases) {
    const hits = search(item.question, chunks, { limit: 6 })
    const usable = hits.filter(hit => hit.score >= NO_EVIDENCE_THRESHOLD)
    const evidence = toEvidence(usable, 10)
    const topPages = distinctTitles(hits)
    const notes: string[] = []
    const hasEvidence = evidence.length > 0

    let retrievalHit: boolean | null = null
    if (item.kind === 'answer') {
      retrievalHit = item.expectPages.some(page => topPages.includes(page))
      if (!retrievalHit) notes.push(`期望页未进前三：${item.expectPages.join(' / ')}；实际：${topPages.join(' / ') || '无'}`)
    }

    let evidenceCoverage: boolean | null = null
    if (item.kind === 'answer') {
      const blob = evidence.map(entry => entry.text).join('\n')
      const covered = item.keywords.filter(keyword => blob.includes(keyword))
      evidenceCoverage = covered.length === item.keywords.length
      if (!evidenceCoverage) {
        const missing = item.keywords.filter(keyword => !blob.includes(keyword))
        notes.push(`证据缺少关键词：${missing.join('、')}`)
      }
    }

    let answer = ''
    let cited: number[] = []
    let citedPages: string[] = []
    if (item.kind === 'answer' && hasEvidence) {
      answer = localAnswer(evidence, '评估专用：本地摘录', item.question)
      cited = (answer.match(/\[(\d+)\]/g) ?? []).map(token => Number(token.slice(1, -1)))
      citedPages = [...new Set(cited.map(n => evidence[n - 1]?.pageTitle).filter((title): title is string => Boolean(title)))]
    }

    let answerHonest: boolean
    if (item.kind === 'answer') {
      answerHonest = hasEvidence
      if (!hasEvidence) notes.push('有证据题但未检索到可用证据')
    } else {
      answerHonest = !hasEvidence
      if (hasEvidence) notes.push(`拒答题召回了 ${evidence.length} 条证据，阈值 ${NO_EVIDENCE_THRESHOLD} 未生效`)
    }

    let citationValid = true
    if (item.kind === 'answer' && hasEvidence) {
      citationValid = cited.length > 0 && cited.every(n => n >= 1 && n <= evidence.length)
      if (!citationValid) notes.push('引用编号越界或缺失')
    }

    let citationCoverage: boolean | null = null
    if (item.kind === 'answer' && hasEvidence && item.minPages) {
      const hitCount = citedPages.filter(page => item.expectPages.includes(page)).length
      citationCoverage = hitCount >= item.minPages
      if (!citationCoverage) {
        notes.push(`引用覆盖不足：期望至少 ${item.minPages} 个期望页，实际引用 ${citedPages.join(' / ') || '无'}`)
      }
    }

    let answerKeywords: boolean | null = null
    if (item.kind === 'answer' && hasEvidence) {
      answerKeywords = item.keywords.length === 0 || item.keywords.some(keyword => answer.includes(keyword))
      if (!answerKeywords) notes.push(`答案未包含关键词：${item.keywords.join('、')}`)
    }

    const checks: boolean[] = [answerHonest, citationValid]
    if (retrievalHit !== null) checks.push(retrievalHit)
    if (evidenceCoverage !== null) checks.push(evidenceCoverage)
    if (citationCoverage !== null) checks.push(citationCoverage)
    if (answerKeywords !== null) checks.push(answerKeywords)
    const score = Math.round((checks.filter(Boolean).length / checks.length) * 100)

    results.push({
      id: item.id,
      question: item.question,
      status: score === 100 ? 'pass' : 'fail',
      retrievalHit,
      citationValid,
      citationCoverage,
      evidenceCoverage,
      answerHonest,
      answerKeywords,
      score,
      topPages,
      citedPages,
      notes,
    })
  }

  const metric = (label: string, values: (boolean | null)[]): { label: string; value: number | null; n: number } => {
    const applicable = values.filter((value): value is boolean => value !== null)
    return {
      label,
      value: applicable.length ? Math.round((applicable.filter(Boolean).length / applicable.length) * 1000) / 1000 : null,
      n: applicable.length,
    }
  }

  const metrics = {
    retrieval_hit: metric('检索命中', results.map(result => result.retrievalHit)),
    evidence_coverage: metric(
      '证据覆盖',
      results.map(result => (result.evidenceCoverage === null ? null : result.evidenceCoverage && result.answerKeywords === true)),
    ),
    citation_valid: metric(
      '引用有效',
      results.map(result => (result.citationCoverage === null ? result.citationValid : result.citationValid && result.citationCoverage)),
    ),
    answer_honest: metric('诚实作答', results.map(result => result.answerHonest)),
  }
  const values = Object.values(metrics)
    .map(item => item.value)
    .filter((value): value is number => value !== null)
  const score = Math.round((values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)) * 1000) / 10

  return {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter(result => result.status === 'pass').length,
    score,
    metrics,
    cases: results,
  }
}




