import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipc } from '$lib/ipc/client';
import { asLosslessText } from '$lib/ipc/wire';
import type { Op, Path } from '$lib/ipc/bindings';
import type { PromptController } from '$lib/ui/prompt.svelte';
import { createNodeActions, type CutMark } from './node-actions';
import type { ContentRow } from './model';

vi.mock('$lib/ipc/client', () => ({ ipc: { docGetValue: vi.fn() } }));

const clipboard = vi.hoisted(() => {
	let text = '';
	return {
		writeText: async (t: string) => void (text = t),
		readText: async () => text,
	};
});
vi.mock('@tauri-apps/plugin-clipboard-manager', () => clipboard);

const TEXT = '{"id": 7}';

function setup(cutPath: Path) {
	const ops: Op[] = [];
	let cut: CutMark | null = { path: cutPath, text: TEXT };
	const setError = vi.fn();
	const actions = createNodeActions({
		handle: () => 'h' as never,
		rows: () => [],
		selectedIndex: () => -1,
		setSelectedPath: () => {},
		siblingCount: () => null,
		prompt: {} as PromptController,
		apply: async (op) => {
			ops.push(op);
			return { version: 1, affectedPaths: [] };
		},
		setError,
		flash: () => {},
		onOpenInNewTab: () => {},
		getCutMark: () => cut,
		setCutMark: (m) => (cut = m),
	});
	return { actions, ops, setError, cut: () => cut };
}

function row(path: Path): ContentRow {
	return { path, key: path[path.length - 1], depth: path.length } as ContentRow;
}

describe('paste after cut moves the value', () => {
	beforeEach(() => clipboard.writeText(TEXT));

	it('moves an item down within its own array', async () => {
		const { actions, ops, cut } = setup(['list', 2]);
		await actions.paste(row(['list', 5]));
		expect(ops).toEqual([
			{ kind: 'insertItemText', path: ['list'], index: 6, text: TEXT },
			{ kind: 'deleteItem', path: ['list'], index: 2 },
		]);
		expect(cut()).toBeNull();
	});

	it('moves an item up within its own array, deleting the shifted original', async () => {
		const { actions, ops } = setup(['list', 5]);
		await actions.paste(row(['list', 1]));
		expect(ops).toEqual([
			{ kind: 'insertItemText', path: ['list'], index: 2, text: TEXT },
			{ kind: 'deleteItem', path: ['list'], index: 6 },
		]);
	});

	it('follows the cut value when the insert shifts one of its ancestors', async () => {
		const { actions, ops } = setup(['list', 1, 'items', 3]);
		await actions.paste(row(['list', 0]));
		expect(ops).toEqual([
			{ kind: 'insertItemText', path: ['list'], index: 1, text: TEXT },
			{ kind: 'deleteItem', path: ['list', 2, 'items'], index: 3 },
		]);
	});

	it('refuses to paste a cut value inside itself', async () => {
		const { actions, ops, setError } = setup(['list']);
		await actions.paste(row(['list', 0]));
		expect(ops).toEqual([]);
		expect(setError).toHaveBeenCalled();
	});
});

describe('copy then paste', () => {
	it.each(['"hello"', '"42"'])('pastes the string %s back unchanged', async (json) => {
		await clipboard.writeText('');
		vi.mocked(ipc.docGetValue).mockResolvedValue(asLosslessText(json));
		const { actions, ops, setError } = setup(['other']);
		await actions.copy({ ...row(['list', 3]), kind: 'string' });
		await actions.paste(row(['list', 0]));
		expect(setError).not.toHaveBeenCalled();
		expect(ops).toEqual([{ kind: 'insertItemText', path: ['list'], index: 1, text: json }]);
	});
});

describe('convert, escape and add', () => {
	function on(kind: ContentRow['kind'], stored: string, childCount: number | null = null) {
		vi.mocked(ipc.docGetValue).mockResolvedValue(asLosslessText(stored));
		const ctx = setup([]);
		return { ...ctx, r: { ...row(['v']), kind, childCount } as ContentRow };
	}

	it('turns a string holding an array, typed or escaped, into that array', async () => {
		const typed = on('string', JSON.stringify('[1.20,3]'));
		await typed.actions.convertToContainer(typed.r, 'array');
		expect(typed.ops).toEqual([{ kind: 'setValueText', path: ['v'], text: '[1.20,3]' }]);

		const escaped = on('string', JSON.stringify('{\\"a\\":123}'));
		await escaped.actions.convertToContainer(escaped.r, 'object');
		expect(escaped.ops).toEqual([{ kind: 'setValueText', path: ['v'], text: '{"a":123}' }]);
	});

	it('replaces anything else with an empty array or object', async () => {
		const text = on('string', JSON.stringify('hello'));
		await text.actions.convertToContainer(text.r, 'array');
		const num = on('number', '42');
		await num.actions.convertToContainer(num.r, 'object');
		expect(text.ops[0]).toEqual({ kind: 'setValueText', path: ['v'], text: '[]' });
		expect(num.ops[0]).toEqual({ kind: 'setValueText', path: ['v'], text: '{}' });
	});

	it('turns an array or object into its compact JSON text', async () => {
		const { actions, ops, r } = on('object', '{\n  "a": [1.20, 3]\n}');
		await actions.convertToScalar(r, 'string');
		expect(ops).toEqual([
			{ kind: 'setValueText', path: ['v'], text: JSON.stringify('{"a":[1.20,3]}') },
		]);
	});

	it('escapes and unescapes a string', async () => {
		const plain = on('string', JSON.stringify('say "hi"'));
		await plain.actions.escapeText(plain.r);
		expect(plain.ops).toEqual([
			{ kind: 'setValueText', path: ['v'], text: JSON.stringify('say \\"hi\\"') },
		]);

		const escaped = on('string', JSON.stringify('line\\nnext'));
		await escaped.actions.unescapeText(escaped.r);
		expect(escaped.ops).toEqual([
			{ kind: 'setValueText', path: ['v'], text: JSON.stringify('line\nnext') },
		]);
	});

	it('reports an escape it cannot undo, changing nothing', async () => {
		const { actions, ops, setError, r } = on('string', JSON.stringify('bad \\q'));
		await actions.unescapeText(r);
		expect(ops).toEqual([]);
		expect(setError).toHaveBeenCalled();
	});
});
