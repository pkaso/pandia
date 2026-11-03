// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { flushSync } from 'svelte';
import { fireEvent, render } from '@testing-library/svelte';
import { insertChildrenWithClose, rootRow, type ContentRow, type Row } from '../logic/model';
import TreeView from './TreeView.svelte';

globalThis.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

const VIEWPORT = 600;
// jsdom has no layout; give every element the tree's viewport height.
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
	configurable: true,
	get: () => VIEWPORT,
});

// WebKit and Blink store layout sizes as an int32 count of 1/64 px (LayoutUnit),
// so a taller element is clamped and the rows past it can't be scrolled to.
const LAYOUT_MAX_PX = Math.floor(0x7fffffff / 64);

function expandedArray(count: number): Row[] {
	const rows: Row[] = [{ ...rootRow('array', count), expanded: true }];
	const loaded = Array.from(
		{ length: 200 },
		(_, i): ContentRow => ({
			variant: 'content',
			path: [i],
			depth: 1,
			key: i,
			kind: 'number',
			preview: String(i),
			childCount: null,
			expanded: false,
		}),
	);
	insertChildrenWithClose(rows, 0, loaded, count);
	return rows;
}

function translateY(el: HTMLElement): number {
	return parseFloat(/translate3d\(0, ([-\d.]+)px/.exec(el.style.transform)![1]!);
}

describe('TreeView scrolling', () => {
	it.each([1_000, 2_000_000])(
		'reaches the last of %i array items within the layout limit',
		(count) => {
			const onMaterializeGap = vi.fn();
			const { container } = render(TreeView, {
				props: {
					rows: expandedArray(count),
					selectedIndex: -1,
					onToggle: () => {},
					onSelect: () => {},
					onVisibleRange: () => {},
					onRowMenu: () => {},
					scrollRequest: null,
					editing: null,
					onEditInput: () => {},
					onEditCommit: () => {},
					onEditCancel: () => {},
					onMaterializeGap,
				},
			});
			const scroller = container.querySelector<HTMLElement>('.scroller')!;
			const spacer = container.querySelector<HTMLElement>('.spacer')!;
			const height = parseFloat(spacer.style.height);
			expect(height).toBeLessThanOrEqual(LAYOUT_MAX_PX);

			scroller.scrollTop = height - VIEWPORT;
			scroller.dispatchEvent(new Event('scroll'));
			flushSync();

			expect(onMaterializeGap.mock.lastCall?.[2]).toBe(count);
			const close = container.querySelector<HTMLElement>('.r.close')!;
			expect(translateY(close) + 22).toBeCloseTo(height);
		},
	);
});

describe('TreeView search marks', () => {
	function objectRows(): Row[] {
		const rows: Row[] = [{ ...rootRow('object', 2), expanded: true }];
		const children: ContentRow[] = [
			{
				variant: 'content',
				path: ['name'],
				depth: 1,
				key: 'name',
				kind: 'string',
				preview: '"Pandia"',
				childCount: null,
				expanded: false,
			},
			{
				variant: 'content',
				path: ['count'],
				depth: 1,
				key: 'count',
				kind: 'number',
				preview: '42',
				childCount: null,
				expanded: false,
			},
		];
		insertChildrenWithClose(rows, 0, children, 2);
		return rows;
	}

	function marksFor(
		searchQuery: string,
		activeMatch: { path: (string | number)[]; matchField: 'key' | 'value' } | null,
	) {
		const { container } = render(TreeView, {
			props: {
				rows: objectRows(),
				selectedIndex: -1,
				onToggle: () => {},
				onSelect: () => {},
				onVisibleRange: () => {},
				onRowMenu: () => {},
				onRowAction: () => {},
				scrollRequest: null,
				editing: null,
				onEditInput: () => {},
				onEditCommit: () => {},
				onEditCancel: () => {},
				searchQuery,
				activeMatch,
			},
		});
		flushSync();
		return [...container.querySelectorAll('mark.hit')].map(
			(m) => `${m.textContent}${m.classList.contains('current') ? '*' : ''}`,
		);
	}

	it('marks matches in keys and string values, and the current match more strongly', () => {
		expect(marksFor('n', { path: ['name'], matchField: 'value' })).toEqual(['n', 'n*', 'n']);
	});

	it('leaves numbers and an empty query unmarked', () => {
		expect(marksFor('4', null)).toEqual([]);
		expect(marksFor('', null)).toEqual([]);
	});
});

describe('TreeView clicks on a container key', () => {
	function setup(editingKey = false) {
		const rows: Row[] = [{ ...rootRow('object', 1), expanded: true }];
		const user: ContentRow = {
			variant: 'content',
			path: ['user'],
			depth: 1,
			key: 'user',
			kind: 'object',
			preview: '{…}',
			childCount: 2,
			expanded: false,
		};
		insertChildrenWithClose(rows, 0, [user], 1);
		const onToggle = vi.fn();
		const onRowAction = vi.fn();
		const { container } = render(TreeView, {
			props: {
				rows,
				selectedIndex: -1,
				onToggle,
				onSelect: () => {},
				onVisibleRange: () => {},
				onRowMenu: () => {},
				onRowAction,
				scrollRequest: null,
				editing: editingKey ? { path: ['user'], field: 'key' as const, buffer: 'user' } : null,
				onEditInput: () => {},
				onEditCommit: () => {},
				onEditCancel: () => {},
			},
		});
		flushSync();
		const row = [...container.querySelectorAll<HTMLElement>('.r')].find(
			(r) =>
				r.querySelector('.k')?.textContent === 'user' ||
				r.querySelector<HTMLInputElement>('[data-inline-editor]')?.value === 'user',
		)!;
		return { row, key: row.querySelector<HTMLElement>('.k')!, onToggle, onRowAction };
	}

	it('edits on a double-click without expanding or collapsing', async () => {
		vi.useFakeTimers();
		const { key, onToggle, onRowAction } = setup();
		await fireEvent.click(key, { detail: 1 });
		await fireEvent.click(key, { detail: 2 });
		await fireEvent.dblClick(key);
		vi.advanceTimersByTime(500);
		expect(onToggle).not.toHaveBeenCalled();
		expect(onRowAction).toHaveBeenCalledWith(expect.any(Number), 'edit-key');
		vi.useRealTimers();
	});

	it('toggles after a single click on the key, and at once elsewhere on the row', async () => {
		vi.useFakeTimers();
		const { row, key, onToggle } = setup();
		await fireEvent.click(key, { detail: 1 });
		expect(onToggle).not.toHaveBeenCalled();
		vi.advanceTimersByTime(300);
		expect(onToggle).toHaveBeenCalledTimes(1);

		await fireEvent.click(row.querySelector('.caret')!, { detail: 1 });
		expect(onToggle).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it('leaves the node alone when clicking inside an open editor', async () => {
		vi.useFakeTimers();
		const { row, onToggle } = setup(true);
		const input = row.querySelector<HTMLInputElement>('[data-inline-editor]')!;
		await fireEvent.click(input, { detail: 1 });
		await fireEvent.click(input, { detail: 2 });
		await fireEvent.dblClick(input);
		vi.advanceTimersByTime(500);
		expect(onToggle).not.toHaveBeenCalled();
		vi.useRealTimers();
	});
});
