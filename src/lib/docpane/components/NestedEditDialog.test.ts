// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/svelte';
import { ipc } from '$lib/ipc/client';
import { commandRegistry } from '$lib/palette/state/command-store.svelte';
import { nestedEditors } from '../state/nested-editors.svelte';
import NestedEditDialog from './NestedEditDialog.svelte';

vi.mock('$lib/ipc/client', () => ({
	ipc: {
		docOpen: vi.fn(),
		docClose: vi.fn(async () => true),
		docSummary: vi.fn(),
		docGetSlice: vi.fn(async () => []),
		docGetValue: vi.fn(),
		docCanonicalText: vi.fn(async () => '[]'),
		docCanonicalOffsets: vi.fn(async () => []),
	},
}));
vi.mock('$lib/util/persist', async (original) => ({
	...(await original()),
	loadPersisted: vi.fn(async () => undefined),
	savePersisted: vi.fn(async () => {}),
}));
const dialog = vi.hoisted(() => ({ ask: vi.fn(async () => true) }));
vi.mock('@tauri-apps/plugin-dialog', () => dialog);

globalThis.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};
Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = () => new DOMRect();
Element.prototype.scrollTo = () => {};

afterEach(() => cleanup());

function open(edited: string, dirty = false) {
	vi.mocked(ipc.docOpen).mockResolvedValue({
		kind: 'opened',
		handle: 'nested' as never,
		summary: {
			rootKind: 'array',
			rootChildCount: 0,
			sourcePath: null,
			sourceSize: 2,
			lazy: false,
			version: 1,
			dirty,
			fileBacked: false,
			recoveryNote: null,
			commentsStripped: false,
		},
		notes: { convertedFrom: null, repairs: [] },
	});
	// The array as stored in the main document, then the nested editor's result.
	vi.mocked(ipc.docGetValue).mockImplementation(
		async (h) => (h === 'main' ? '[]' : edited) as never,
	);
	const onApply = vi.fn(async () => true);
	const onClose = vi.fn();
	const view = render(NestedEditDialog, {
		props: { handle: 'main' as never, path: ['items'], kind: 'array', depth: 0, onApply, onClose },
	});
	return { ...view, onApply, onClose, dialog: within(view.getByTestId('nested-editor')) };
}

describe('NestedEditDialog', () => {
	it('opens the value in its own editor and applies the result only on Apply', async () => {
		const { dialog, onApply, onClose } = open('[1, 2]');
		const apply = dialog.getByRole('button', { name: 'Apply' });
		await vi.waitFor(() => expect(apply.hasAttribute('disabled')).toBe(false));
		expect(vi.mocked(ipc.docOpen).mock.calls[0]?.[0]).toMatchObject({ kind: 'text', text: '[]' });
		expect(onApply).not.toHaveBeenCalled();

		await fireEvent.click(apply);
		await vi.waitFor(() => expect(onApply).toHaveBeenCalledWith('[1, 2]'));
		expect(onClose).toHaveBeenCalled();
	});

	it('owns the commands while open, without the ones that make no sense for a copy', async () => {
		const { dialog, unmount } = open('[]');
		await vi.waitFor(() =>
			expect(dialog.getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(false),
		);
		expect(nestedEditors.top).toBe(1);
		expect(commandRegistry.get('doc.undo')).toBeTruthy();
		expect(commandRegistry.get('doc.save')).toBeUndefined();
		unmount();
		expect(nestedEditors.top).toBe(0);
	});

	it('asks before throwing away unapplied changes', async () => {
		dialog.ask.mockResolvedValueOnce(false);
		const { dialog: d, onClose } = open('[]', true);
		await vi.waitFor(() =>
			expect(d.getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(false),
		);
		await fireEvent.click(d.getByRole('button', { name: 'Cancel' }));
		await vi.waitFor(() => expect(dialog.ask).toHaveBeenCalled());
		expect(onClose).not.toHaveBeenCalled();
	});
});
