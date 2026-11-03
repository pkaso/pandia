import type { ContentRow } from './model';

export const JSON_NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;

export type EditedKind = 'string' | 'number' | 'bool' | 'json';

/**
 * What an edited value is saved as. A number field keeps a number and a bool field keeps true/false;
 * anything else typed there becomes a string instead of being thrown away. A null field takes any
 * JSON (`json`), and otherwise a string too.
 */
export function editedKind(kind: ContentRow['kind'], buffer: string): EditedKind {
	if (buffer.includes('\n')) return 'string'; // Shift+Enter turned the value into multi-line text
	const t = buffer.trim();
	switch (kind) {
		case 'number':
			return JSON_NUMBER.test(t) ? 'number' : 'string';
		case 'bool':
			return t === 'true' || t === 'false' ? 'bool' : 'string';
		case 'null':
			try {
				JSON.parse(t);
				return 'json';
			} catch {
				return 'string';
			}
		default:
			return 'string';
	}
}

/**
 * Width of a one-line edit field: exactly its text (the font is monospace, so each character is 1ch
 * plus the body's letter spacing) plus the side padding, so nothing after it moves.
 */
export function editWidth(s: string): string {
	const n = Math.min(Math.max(s.length, 1), 60);
	return `calc(${n} * (1ch + var(--text-tracking, 0em)) + 2 * var(--space-xs))`;
}

export function nextNumberValue(buffer: string, delta: number): string {
	const t = buffer.trim();
	if (JSON_NUMBER.test(t)) {
		if (/^-?\d+$/.test(t) && Number.isInteger(delta)) {
			return (BigInt(t) + BigInt(delta)).toString();
		}
		if (String(Number(t)) !== t) return buffer;
	}
	const cur = parseFloat(buffer);
	const base = Number.isFinite(cur) ? cur : 0;
	const next = Math.round((base + delta) * 1e9) / 1e9;
	return String(next);
}

export interface EditCallbacks {
	onCommit: () => void;
	onCancel: () => void;
	onInput: (value: string) => void;
}

export interface EditDeps extends EditCallbacks {
	buffer: () => string;
}

export function createEditHandlers(deps: EditDeps) {
	// Multi-line string: Enter saves, Shift+Enter adds a line (the textarea's own behaviour).
	function onAreaKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
			e.preventDefault();
			e.stopPropagation();
			deps.onCommit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			deps.onCancel();
		} else {
			e.stopPropagation();
		}
	}

	function commitBool(value: 'true' | 'false') {
		deps.onInput(value);
		deps.onCommit();
	}

	function onBoolFocusOut(e: FocusEvent) {
		const next = e.relatedTarget as Node | null;
		if (next && (e.currentTarget as HTMLElement).contains(next)) return;
		deps.onCommit();
	}

	function onNumberKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			e.stopPropagation();
			deps.onInput(nextNumberValue(deps.buffer(), e.shiftKey ? 10 : 1));
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			e.stopPropagation();
			deps.onInput(nextNumberValue(deps.buffer(), e.shiftKey ? -10 : -1));
		} else {
			onEditKeydown(e);
		}
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			e.stopPropagation();
			deps.onCommit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			deps.onCancel();
		} else {
			e.stopPropagation();
		}
	}

	return {
		onAreaKeydown,
		commitBool,
		onBoolFocusOut,
		onNumberKeydown,
		onEditKeydown,
	};
}
