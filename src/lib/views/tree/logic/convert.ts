// Text transforms behind the tree's "Convert to", "Escape" and "Unescape" menu actions. They work on
// JSON text rather than parsed values, so numbers keep the exact digits the document stores.

/** Drops the whitespace between JSON tokens (`{ "a": 1 }` → `{"a":1}`), leaving strings untouched. */
export function compactJson(text: string): string {
	let out = '';
	let inString = false;
	let escaped = false;
	for (const ch of text) {
		if (inString) {
			out += ch;
			if (escaped) escaped = false;
			else if (ch === '\\') escaped = true;
			else if (ch === '"') inString = false;
		} else if (ch === '"') {
			inString = true;
			out += ch;
		} else if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') {
			out += ch;
		}
	}
	return out;
}

/** Escapes a string's content as it would appear between JSON quotes: `say "hi"` → `say \"hi\"`. */
export function escapeString(s: string): string {
	return JSON.stringify(s).slice(1, -1);
}

/** Reverses `escapeString`; null when the text has an escape JSON doesn't allow (a lone `\`). */
export function unescapeString(s: string): string | null {
	// Raw quotes and control characters (a real line break) stay as they are; only escapes change.
	const quoted = s
		.replace(/(?<!\\)((?:\\\\)*)"/g, '$1\\"')
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u001f]/g, (c) => JSON.stringify(c).slice(1, -1));
	try {
		const out: unknown = JSON.parse(`"${quoted}"`);
		return typeof out === 'string' ? out : null;
	} catch {
		return null;
	}
}

/**
 * The JSON text for an array or object held in a string, as typed (`[1.2,3]`) or escaped
 * (`[\"a\",1]`); null when the string holds neither the wanted kind.
 */
export function containerTextIn(s: string, want: 'array' | 'object'): string | null {
	const holds = (text: string) => {
		try {
			const v: unknown = JSON.parse(text);
			const isArray = Array.isArray(v);
			return want === 'array' ? isArray : v !== null && typeof v === 'object' && !isArray;
		} catch {
			return false;
		}
	};
	const direct = s.trim();
	if (holds(direct)) return direct;
	const unescaped = unescapeString(direct);
	if (unescaped !== null && holds(unescaped.trim())) return unescaped.trim();
	return null;
}
