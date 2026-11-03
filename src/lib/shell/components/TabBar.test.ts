// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import TabBar from './TabBar.svelte';

beforeAll(() => {
	// jsdom has no pointer capture; the tab bar captures on press so tabs can be dragged.
	HTMLElement.prototype.setPointerCapture = () => {};
	HTMLElement.prototype.releasePointerCapture = () => {};
});
afterEach(() => cleanup());

function setup({ renamable = true, activeTabId = 'a' } = {}) {
	const onActivate = vi.fn();
	const onRename = vi.fn(async () => true);
	const onClose = vi.fn();
	const tabs = [
		{ id: 'a', label: 'data.json', sourceName: '/tmp/data.json', renamable, unsaved: false },
		{ id: 'b', label: 'pasted.json', sourceName: '(inline)', renamable, unsaved: true },
	];
	const view = render(TabBar, {
		props: {
			tabs,
			activeTabId,
			capWarning: false,
			maxTabs: 10,
			hasActiveDoc: true,
			comparePickerOpen: false,
			onActivate,
			onClose,
			onNew: vi.fn(),
			onReorder: vi.fn(),
			onRename,
			onToggleCompare: vi.fn(),
			onExport: vi.fn(),
		},
	});
	const field = () => view.container.querySelector<HTMLInputElement>('.tab-rename');
	const tabEl = (id: string) => view.container.querySelector<HTMLElement>(`[data-tab-id="${id}"]`)!;
	// As in a real browser: the press lands on the name, but pointer capture retargets the click to the tab.
	async function clickName(id: string) {
		const tab = tabEl(id);
		const label = tab.querySelector('.tab-label')!;
		await fireEvent.pointerDown(label, { button: 0, pointerId: 1 });
		await fireEvent.pointerUp(tab, { button: 0, pointerId: 1 });
		await fireEvent.click(tab);
	}
	return { ...view, onActivate, onClose, onRename, field, clickName, tabEl };
}

describe('tab bar — rename', () => {
	it('edits on a click on the active tab’s name, with the stem selected, and renames on Enter', async () => {
		const { clickName, field, onRename } = setup();
		await clickName('a');
		const input = field()!;
		expect(input.value).toBe('data.json');
		expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);

		await fireEvent.input(input, { target: { value: 'users.json' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(onRename).toHaveBeenCalledWith('a', 'users.json');
		await vi.waitFor(() => expect(field()).toBeNull());
	});

	it('switches to an inactive tab on the first click and edits on the second', async () => {
		const { clickName, field, onActivate, rerender } = setup();
		await clickName('b');
		expect(onActivate).toHaveBeenCalledWith('b');
		expect(field()).toBeNull();

		await rerender({ activeTabId: 'b' });
		await clickName('b');
		expect(field()?.value).toBe('untitled.json');
	});

	it('does not edit when the click lands outside the name', async () => {
		const { field, tabEl } = setup();
		const tab = tabEl('a');
		await fireEvent.pointerDown(tab, { button: 0, pointerId: 1 });
		await fireEvent.pointerUp(tab, { button: 0, pointerId: 1 });
		await fireEvent.click(tab);
		expect(field()).toBeNull();
	});

	it('cancels on Escape and ignores invalid names', async () => {
		const { clickName, field, onRename } = setup();
		await clickName('a');
		await fireEvent.input(field()!, { target: { value: 'x.json' } });
		await fireEvent.keyDown(field()!, { key: 'Escape' });
		expect(field()).toBeNull();

		await clickName('a');
		await fireEvent.input(field()!, { target: { value: 'sub/x.json' } });
		await fireEvent.keyDown(field()!, { key: 'Enter' });
		expect(field()).not.toBeNull(); // stays open on an invalid name
		await fireEvent.blur(field()!);
		expect(onRename).not.toHaveBeenCalled();
	});

	it('opens with F2 on the active tab', async () => {
		const { tabEl, field } = setup();
		await fireEvent.keyDown(tabEl('a'), { key: 'F2' });
		expect(field()?.value).toBe('data.json');
	});

	it('does not edit a tab without a document', async () => {
		const { clickName, field } = setup({ renamable: false });
		await clickName('a');
		expect(field()).toBeNull();
	});
});

describe('tab bar — unsaved mark', () => {
	it('marks unsaved tabs on the close button, which stays clickable', async () => {
		const { tabEl, onClose } = setup();
		const saved = tabEl('a').querySelector('.tab-close')!;
		const unsaved = tabEl('b').querySelector('.tab-close')!;
		expect(saved.classList.contains('unsaved')).toBe(false);
		expect(unsaved.classList.contains('unsaved')).toBe(true);
		expect(unsaved.getAttribute('aria-label')).toBe('Close tab (unsaved changes)');
		await fireEvent.click(unsaved);
		expect(onClose).toHaveBeenCalledWith('b');
	});
});
