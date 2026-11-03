// Text transforms behind the tree's "Convert to", "Escape" and "Unescape" menu actions. They work on
// JSON text rather than parsed values, so numbers keep the exact digits the document stores.

import type { NodeKind } from '$lib/ipc/bindings';
import { JSON_NUMBER } from './edit-handlers';

/**
 * The JSON text a value becomes under "Convert to" String, Number or Boolean, following JavaScript's
 * String(), Number() and Boolean(): `"123"` → 123, `"asdf"` → 0, 0 → false, `{}` → true. Exceptions
 * that keep data intact: an array/object becomes its compact JSON text, a number keeps its exact
 * digits, and the string "false" becomes false.
 *
 * `text` is the value's JSON text as stored (pretty-printed for arrays and objects).
 */
export function convertedText(
	from: NodeKind,
	text: string,
	to: 'string' | 'number' | 'bool',
): string {
	const t = text.trim();
	const str = from === 'string' ? (JSON.parse(t) as string) : null;
	if (to === 'string') {
		if (from === 'object' || from === 'array') return JSON.stringify(compactJson(t));
		return JSON.stringify(str ?? t); // 42 → "42", true → "true", null → "null"
	}
	if (to === 'number') {
		if (from === 'number') return t;
		if (from === 'bool') return t === 'true' ? '1' : '0';
		if (str === null) return '0'; // null, arrays and objects
		const s = str.trim();
		if (JSON_NUMBER.test(s)) return s; // exact digits, even beyond what a JS number holds
		const n = Number(s);
		return Number.isFinite(n) ? String(n) : '0';
	}
	switch (from) {
		case 'string': {
			const s = str ?? '';
			return String(s !== '' && s.trim().toLowerCase() !== 'false');
		}
		case 'number':
			return String(Number(t) !== 0);
		case 'bool':
			return t;
		case 'null':
			return 'false';
		default:
			return 'true'; // arrays and objects, even empty ones
	}
}

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
