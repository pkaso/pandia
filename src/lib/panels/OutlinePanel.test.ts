// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/svelte';
import { ipc } from '$lib/ipc/client';
import type { DocContext } from '$lib/shell/state/workspace.svelte';
import OutlinePanel from './OutlinePanel.svelte';

vi.mock('$lib/ipc/client', () => ({ ipc: { docGetSlice: vi.fn() } }));

// jsdom has no ResizeObserver; the outline's scroller only needs observe/disconnect.
globalThis.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

describe('OutlinePanel', () => {
	it('shows the document again after visiting an empty tab and coming back', async () => {
		vi.mocked(ipc.docGetSlice).mockResolvedValue([
			{ key: 'name', kind: 'string', preview: '"x"', childCount: null },
		]);
		const context = { handle: 'h1', version: 3 } as unknown as DocContext;
		const { findByText, rerender } = render(OutlinePanel, { props: { context } });
		await findByText('document');

		await rerender({ context: null });
		await rerender({ context });
		await findByText('document');
	});

	it('keeps expanded nodes open after an edit', async () => {
		vi.mocked(ipc.docGetSlice).mockImplementation(async (_h, path) =>
			path.length === 0
				? [{ key: 'users', kind: 'object', preview: '{…}', childCount: 1 }]
				: [{ key: 'ada', kind: 'string', preview: '"x"', childCount: null }],
		);
		const { findByText, rerender } = render(OutlinePanel, {
			props: { context: { handle: 'h1', version: 1 } as unknown as DocContext },
		});
		await fireEvent.click(await findByText('users'));
		await findByText('ada');

		await rerender({ context: { handle: 'h1', version: 2 } as unknown as DocContext });
		await vi.waitFor(() => expect(vi.mocked(ipc.docGetSlice).mock.calls.length).toBeGreaterThan(2));
		await new Promise((r) => setTimeout(r, 0));
		await findByText('ada');
	});

	it('expands every level with Expand all and closes them with Collapse all', async () => {
		// { users: { ada: { role: "x" } } }
		vi.mocked(ipc.docGetSlice).mockImplementation(async (_h, path) => {
			if (path.length === 0)
				return [{ key: 'users', kind: 'object', preview: '{…}', childCount: 1 }];
			if (path.length === 1) return [{ key: 'ada', kind: 'object', preview: '{…}', childCount: 1 }];
			return [{ key: 'role', kind: 'string', preview: '"x"', childCount: null }];
		});
		const { container } = render(OutlinePanel, {
			props: { context: { handle: 'h1', version: 1 } as unknown as DocContext },
		});
		const { findByText, getByText, queryByText } = within(container);
		await findByText('users');

		await fireEvent.click(getByText('Expand all'));
		await findByText('role');

		await fireEvent.click(getByText('Collapse all'));
		await vi.waitFor(() => expect(queryByText('ada')).toBeNull());
		expect(getByText('users')).toBeTruthy();
	});
});
