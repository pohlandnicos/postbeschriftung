'use client';

import type { ProcessResult } from '@/lib/types';

type HistoryItem = {
  id: string;
  created_at: string;
  file_id: string;
  original_name: string;
  suggested_filename: string;
  doc_type: string;
  vendor: string;
  pages: number | null;
  used_openai: boolean;
  text_length: number | null;
  date: string | null;
};

const KEY = 'postbeschriftung_history_v1';

export function loadHistory(): HistoryItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 500)));
}

export function appendHistory(params: {
  result: ProcessResult;
  originalName: string;
  pages: number | null;
}) {
  const { result, originalName, pages } = params;
  const items = loadHistory();

  const next: HistoryItem = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    file_id: result.file_id,
    original_name: originalName,
    suggested_filename: result.suggested_filename,
    doc_type: result.doc_type,
    vendor: result.vendor,
    pages,
    used_openai: Boolean(result.debug?.used_openai),
    text_length: typeof result.debug?.text_length === 'number' ? result.debug.text_length : null,
    date: result.date
  };

  saveHistory([next, ...items]);
}

export function clearHistory() {
  window.localStorage.removeItem(KEY);
}

export type { HistoryItem };
