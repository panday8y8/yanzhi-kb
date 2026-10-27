import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DB_PATH } from './paths'
import type { Chunk, WikiPage, RawDoc } from './types'
import { chunksFromPages } from './chunks'

let cached: DatabaseSync | null = null

export function db(): DatabaseSync {
  if (cached) return cached
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const handle = new DatabaseSync(DB_PATH)
  handle.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sources (
      doc_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      domain TEXT NOT NULL,
      type TEXT NOT NULL,
      owner TEXT,
      updated TEXT,
      tags TEXT,
      topics TEXT,
      summary TEXT,
      chars INTEGER,
      sections INTEGER,
      file_name TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_slug TEXT NOT NULL,
      page_title TEXT NOT NULL,
      section TEXT NOT NULL,
      text TEXT NOT NULL,
      domain TEXT NOT NULL,
      tags TEXT,
      doc_ids TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_page ON chunks(page_slug);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  `)
  cached = handle
  return handle
}

/** 把编译产物写入 SQLite：资料表 + 证据片段表（一次事务，重复执行幂等）。 */
export function syncIndex(pages: WikiPage[], docs: RawDoc[], compiledAt: string): { pages: number; chunks: number; sources: number } {
  const handle = db()
  handle.exec('BEGIN')
  try {
    handle.prepare('DELETE FROM chunks').run()
    const insertChunk = handle.prepare(
      'INSERT INTO chunks (page_slug, page_title, section, text, domain, tags, doc_ids) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    const chunkList = chunksFromPages(pages)
    for (const chunk of chunkList) {
      insertChunk.run(
        chunk.pageSlug,
        chunk.pageTitle,
        chunk.section,
        chunk.text,
        chunk.domain,
        JSON.stringify(chunk.tags),
        JSON.stringify(chunk.docIds),
      )
    }
    const chunks = chunkList.length
    const upsertSource = handle.prepare(`
      INSERT INTO sources (doc_id, title, domain, type, owner, updated, tags, topics, summary, chars, sections, file_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(doc_id) DO UPDATE SET
        title = excluded.title, domain = excluded.domain, type = excluded.type, owner = excluded.owner,
        updated = excluded.updated, tags = excluded.tags, topics = excluded.topics, summary = excluded.summary,
        chars = excluded.chars, sections = excluded.sections, file_name = excluded.file_name
    `)
    for (const doc of docs) {
      upsertSource.run(
        doc.docId,
        doc.title,
        doc.domain,
        doc.type,
        doc.owner,
        doc.updated,
        JSON.stringify(doc.tags),
        JSON.stringify(doc.topics),
        doc.summary,
        doc.chars,
        doc.sections.length,
        doc.fileName,
        new Date().toISOString(),
      )
    }
    handle.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('compiled_at', compiledAt)
    handle.exec('COMMIT')
    return { pages: pages.length, chunks, sources: docs.length }
  } catch (error) {
    handle.exec('ROLLBACK')
    throw error
  }
}

export interface SourceRow {
  docId: string
  title: string
  domain: string
  type: string
  owner: string
  updated: string
  tags: string[]
  topics: string[]
  summary: string
  chars: number
  sections: number
  fileName: string
}

export function listSources(): SourceRow[] {
  const rows = db().prepare('SELECT * FROM sources ORDER BY updated DESC, doc_id ASC').all() as Record<string, unknown>[]
  return rows.map(row => ({
    docId: String(row.doc_id),
    title: String(row.title),
    domain: String(row.domain),
    type: String(row.type),
    owner: String(row.owner ?? ''),
    updated: String(row.updated ?? ''),
    tags: JSON.parse(String(row.tags ?? '[]')) as string[],
    topics: JSON.parse(String(row.topics ?? '[]')) as string[],
    summary: String(row.summary ?? ''),
    chars: Number(row.chars ?? 0),
    sections: Number(row.sections ?? 0),
    fileName: String(row.file_name ?? ''),
  }))
}

export function loadChunks(): Chunk[] {
  const rows = db().prepare('SELECT * FROM chunks ORDER BY id ASC').all() as Record<string, unknown>[]
  return rows.map(row => ({
    id: Number(row.id),
    pageSlug: String(row.page_slug),
    pageTitle: String(row.page_title),
    section: String(row.section),
    text: String(row.text),
    domain: String(row.domain) as Chunk['domain'],
    tags: JSON.parse(String(row.tags ?? '[]')) as string[],
    docIds: JSON.parse(String(row.doc_ids ?? '[]')) as string[],
  }))
}

export function setMeta(key: string, value: string): void {
  db().prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}

export function getMeta(key: string): string | null {
  const row = db().prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value?: string } | undefined
  return row?.value ?? null
}

export function storeCounts(): { pages: number; chunks: number; sources: number } {
  const one = (sql: string) => Number((db().prepare(sql).get() as { n?: number } | undefined)?.n ?? 0)
  return {
    pages: one('SELECT COUNT(DISTINCT page_slug) AS n FROM chunks'),
    chunks: one('SELECT COUNT(*) AS n FROM chunks'),
    sources: one('SELECT COUNT(*) AS n FROM sources'),
  }
}

