import path from 'node:path'

export const ROOT = process.cwd()
export const RAW_DIR = path.join(ROOT, 'content', 'raw')
export const WIKI_DIR = path.join(ROOT, 'content', 'wiki')
export const TOPIC_GLOSSARY = path.join(ROOT, 'content', 'topics.json')
export const OUTPUT_DIR = path.join(ROOT, 'output')
export const DATA_DIR = path.join(ROOT, 'data')
export const PAGES_JSON = path.join(WIKI_DIR, 'pages.json')
export const MANIFEST_JSON = path.join(WIKI_DIR, 'manifest.json')
export const DB_PATH = path.join(DATA_DIR, 'yanzhi.db')
