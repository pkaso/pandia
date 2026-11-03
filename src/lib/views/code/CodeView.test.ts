// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { EditorView } from '@codemirror/view';
import CodeView, { type CodeViewApi } from './CodeView.svelte';

// jsdom has no layout, and CodeMirror measures text ranges after each change.
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();

vi.mock('$lib/ipc/client', () => ({
	ipc: {
		docCanonicalText: vi.fn(async () => '{"a": 0}'),
		docCanonicalOffsets: vi.fn(async () => []),
	},
}));

import { ipc } from '$lib/ipc/client';

describe('CodeView — committing the buffer', () => {
	it('stays dirty when you type while a commit is still being applied', async () => {
		let finishCommit!: (ok: boolean) => void;
		const onCommit = vi.fn(() => new Promise<boolean>((r) => (finishCommit = r)));
		const dirty: boolean[] = [];
		let api: CodeViewApi | null = null;
		const { container } = render(CodeView, {
			props: {
				handle: 'h' as never,
				sourceSize: 10,
				editable: true,
				onCommit,
				onDirtyChange: (d: boolean) => dirty.push(d),
				onReady: (a: CodeViewApi | null) => (api = a),
			},
		});
		await vi.waitFor(() => expect(api).not.toBeNull());
		const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!;
		const type = (text: string) =>
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });

		type('{"a": 1}');
		const flushed = api!.flush();
		type('{"a": 2}');
		finishCommit(true);

		expect(await flushed).toBe(true);
		expect(onCommit).toHaveBeenCalledWith('{"a": 1}');
		expect(dirty.at(-1)).toBe(true);
	});
});

describe('CodeView — caret', () => {
	const TEXT = '{\n  "name": "pandia",\n  "tags": [\n    "x"\n  ]\n}';

	async function mount() {
		vi.mocked(ipc.docCanonicalText).mockResolvedValueOnce(TEXT as never);
		const cursors: unknown[] = [];
		let api: CodeViewApi | null = null;
		const { container } = render(CodeView, {
			props: {
				handle: 'h2' as never,
				sourceSize: 10,
				editable: true,
				onReady: (a: CodeViewApi | null) => (api = a),
				onCursor: (c: unknown) => cursors.push(c),
			},
		});
		await vi.waitFor(() => expect(api).not.toBeNull());
		const view = EditorView.findFromDOM(container.querySelector('.cm-editor') as HTMLElement)!;
		return { api: api!, view, cursors };
	}

	it('reports line, column and selection length, VS Code style', async () => {
		const { view, cursors } = await mount();
		expect(cursors.at(-1)).toEqual({ line: 1, col: 1, selected: 0 });
		const at = TEXT.indexOf('"name"');
		view.dispatch({ selection: { anchor: at, head: at + 6 } });
		expect(cursors.at(-1)).toEqual({ line: 2, col: 9, selected: 6 });
	});

	it('reveals a path by putting the caret on its key', async () => {
		const { api, view, cursors } = await mount();
		const value = TEXT.indexOf('[');
		vi.mocked(ipc.docCanonicalOffsets).mockResolvedValueOnce([{ start: value, end: value + 1 }]);
		await api.revealPath(['tags']);
		expect(view.state.selection.main.head).toBe(TEXT.indexOf('"tags"'));
		expect(cursors.at(-1)).toEqual({ line: 3, col: 3, selected: 0 });
	});
});
