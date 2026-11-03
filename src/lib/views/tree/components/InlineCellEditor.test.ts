// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import InlineCellEditor from './InlineCellEditor.svelte';

afterEach(() => cleanup());

function editor(kind: 'number' | 'bool' | 'null' | 'string', buffer: string) {
	const onInput = vi.fn();
	const onCommit = vi.fn();
	const view = render(InlineCellEditor, {
		props: { field: 'value', kind, buffer, onInput, onCommit, onCancel: vi.fn() },
	});
	return { ...view, onInput, onCommit };
}

describe('InlineCellEditor — Shift+Enter', () => {
	it.each(['number', 'bool', 'null'] as const)(
		'turns a %s field into a multi-line string, caret after the new line',
		async (kind) => {
			vi.useFakeTimers();
			const { container, onInput, onCommit, rerender } = editor(kind, 'ab');
			const input = container.querySelector('input')!;
			input.setSelectionRange(1, 1);
			await fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
			expect(onInput).toHaveBeenCalledWith('a\nb');

			await rerender({ buffer: 'a\nb' });
			vi.runAllTimers();
			const area = container.querySelector('textarea')!;
			expect(area.value).toBe('a\nb');
			expect([area.selectionStart, area.selectionEnd]).toEqual([2, 2]);
			expect(onCommit).not.toHaveBeenCalled(); // switching fields isn't leaving the editor

			await fireEvent.keyDown(area, { key: 'Enter' });
			expect(onCommit).toHaveBeenCalledOnce();
			vi.useRealTimers();
		},
	);

	it('in a string, Enter saves and Shift+Enter does not', async () => {
		const { container, onCommit } = editor('string', 'x');
		const area = container.querySelector('textarea')!;
		await fireEvent.keyDown(area, { key: 'Enter', shiftKey: true });
		expect(onCommit).not.toHaveBeenCalled();
		await fireEvent.keyDown(area, { key: 'Enter' });
		expect(onCommit).toHaveBeenCalledOnce();
	});
});
