import type { ContentRow } from './model';

export function chipText(row: ContentRow): string | null {
	if (row.kind === 'object') {
		if (row.childCount === null) return '{…}';
		return row.childCount === 1 ? `{1 prop}` : `{${row.childCount} props}`;
	}
	if (row.kind === 'array') {
		if (row.childCount === null) return '[…]';
		return row.childCount === 1 ? `[1 item]` : `[${row.childCount} items]`;
	}
	return null;
}

export function openBracket(row: ContentRow): string {
	return row.kind === 'array' ? '[' : '{';
}

export function renderKey(row: ContentRow): string {
	if (row.depth === 0) return '$';
	if (typeof row.key === 'number') return `[${row.key}]`;
	return String(row.key);
}

const URL_RE = /^"(https?:\/\/[^\s"]+)"$/;

export function detectUrl(preview: string): string | null {
	const m = URL_RE.exec(preview);
	return m ? (m[1] ?? null) : null;
}

export interface MatchSegment {
	text: string;
	match: boolean;
}

/** Splits `text` around every case-insensitive occurrence of `query`, as the document search matches. */
export function splitMatches(text: string, query: string): MatchSegment[] {
	const q = query.trim();
	if (!q || !text) return [{ text, match: false }];
	// A regex keeps indices on the original text; lowercasing can change a string's length.
	const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
	const out: MatchSegment[] = [];
	let at = 0;
	for (const m of text.matchAll(re)) {
		const start = m.index ?? 0;
		if (start > at) out.push({ text: text.slice(at, start), match: false });
		out.push({ text: m[0], match: true });
		at = start + m[0].length;
	}
	if (at < text.length) out.push({ text: text.slice(at), match: false });
	return out.length > 0 ? out : [{ text, match: false }];
}
