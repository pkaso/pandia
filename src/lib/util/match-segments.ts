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
