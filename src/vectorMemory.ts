import fs from 'fs';
import path from 'path';
import os from 'os';

const MEMORY_DIR = path.join(os.homedir(), '.quak', 'vector_memory');
const INDEX_FILE = path.join(MEMORY_DIR, 'index.json');

interface MemEntry {
  id: string;
  text: string;
  keywords: string[];
  timestamp: number;
  source: string;
}

let entries: MemEntry[] = [];

function ensureDir(): void {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

function tokenize(text: string): string[] {
  const terms = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my',
    'you', 'your', 'he', 'she', 'they', 'them', 'we', 'us', 'our',
  ]);
  return terms.filter(t => t.length > 1 && !stopwords.has(t));
}

function buildIndex(entries: MemEntry[]): Map<string, Map<string, number>> {
  const docCount = entries.length;
  const termDocFreq = new Map<string, number>();
  const docTerms = new Map<string, Map<string, number>>();

  for (const entry of entries) {
    const tf = new Map<string, number>();
    for (const kw of entry.keywords) {
      tf.set(kw, (tf.get(kw) ?? 0) + 1);
    }
    docTerms.set(entry.id, tf);
    const unique = new Set(entry.keywords);
    for (const kw of unique) {
      termDocFreq.set(kw, (termDocFreq.get(kw) ?? 0) + 1);
    }
  }

  const result = new Map<string, Map<string, number>>();
  for (const [docId, tf] of docTerms) {
    const tfidf = new Map<string, number>();
    for (const [term, freq] of tf) {
      const idf = Math.log((docCount + 1) / ((termDocFreq.get(term) ?? 0) + 1)) + 1;
      tfidf.set(term, freq * idf);
    }
    result.set(docId, tfidf);
  }
  return result;
}

function cosineSimilarity(
  queryVec: Map<string, number>,
  docVec: Map<string, number>,
): number {
  let dot = 0, qNorm = 0, dNorm = 0;
  for (const [term, qVal] of queryVec) {
    qNorm += qVal * qVal;
    const dVal = docVec.get(term) ?? 0;
    dot += qVal * dVal;
  }
  for (const [, dVal] of docVec) {
    dNorm += dVal * dVal;
  }
  if (qNorm === 0 || dNorm === 0) return 0;
  return dot / (Math.sqrt(qNorm) * Math.sqrt(dNorm));
}

export function addToMemory(text: string, source: string = 'conversation'): void {
  ensureDir();
  const entry: MemEntry = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    keywords: tokenize(text),
    timestamp: Date.now(),
    source,
  };
  entries.push(entry);
  saveIndex();
}

export function searchMemory(query: string, limit: number = 5): string[] {
  if (entries.length === 0) loadIndex();
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const qFreq = new Map<string, number>();
  for (const t of queryTokens) qFreq.set(t, (qFreq.get(t) ?? 0) + 1);
  const queryVec = new Map<string, number>();
  for (const [term, freq] of qFreq) {
    const df = entries.filter(e => e.keywords.includes(term)).length;
    const idf = Math.log((entries.length + 1) / (df + 1)) + 1;
    queryVec.set(term, freq * idf);
  }
  const index = buildIndex(entries);
  const scored: { text: string; score: number }[] = [];
  for (const entry of entries) {
    const docVec = index.get(entry.id) ?? new Map();
    const score = cosineSimilarity(queryVec, docVec);
    if (score > 0.05) scored.push({ text: entry.text, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.text);
}

export function loadIndex(): void {
  ensureDir();
  if (!fs.existsSync(INDEX_FILE)) {
    entries = [];
    return;
  }
  try {
    entries = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  } catch {
    entries = [];
  }
}

function saveIndex(): void {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(entries.slice(-1000), null, 2));
}

export function getMemoryCount(): number {
  return entries.length;
}

export function clearMemory(): void {
  entries = [];
  ensureDir();
  if (fs.existsSync(INDEX_FILE)) fs.unlinkSync(INDEX_FILE);
}
