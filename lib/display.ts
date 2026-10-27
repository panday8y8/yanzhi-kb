import type { Domain, PageType } from './types'

export const DOMAIN_COLOR: Record<Domain, string> = {
  engineering: '#44688a',
  manufacturing: '#a9822f',
  quality: '#b23a2a',
  supply: '#7c5a3a',
  security: '#2f6b58',
  people: '#7b5c83',
}

export const DOMAIN_NAME: Record<Domain, string> = {
  engineering: '研发',
  manufacturing: '制造',
  quality: '质量',
  supply: '供应链',
  security: '安全',
  people: '人力',
}

export const TYPE_NAME: Record<PageType, string> = {
  policy: '制度',
  system: '系统',
  playbook: '手册',
  concept: '概念',
}

export function formatDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function scoreBand(score: number): 'high' | 'medium' | 'low' {
  if (score >= 14) return 'high'
  if (score >= 7) return 'medium'
  return 'low'
}
