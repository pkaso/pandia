// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { titleBar } from './title-bar';

const win = vi.hoisted(() => ({
	startDragging: vi.fn(async () => {}),
	toggleMaximize: vi.fn(async () => {}),
}));
vi.mock('@tauri-apps/api/webviewWindow', () => ({ getCurrentWebviewWindow: () => win }));

function bar() {
	const el = document.createElement('header');
	el.innerHTML = '<span class="title">Pandia</span><button>Close</button>';
	titleBar(el);
	const press = (target: Element, detail: number) =>
		target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, detail }));
	return { el, press };
}

describe('titleBar', () => {
	it('drags the window on a press and maximizes or restores it on a double-click', () => {
		const { el, press } = bar();
		press(el.querySelector('.title')!, 1);
		expect(win.startDragging).toHaveBeenCalledTimes(1);
		press(el.querySelector('.title')!, 2);
		expect(win.toggleMaximize).toHaveBeenCalledTimes(1);
		expect(win.startDragging).toHaveBeenCalledTimes(1);
	});

	it('leaves clicks on controls inside it alone', () => {
		vi.clearAllMocks();
		const { el, press } = bar();
		press(el.querySelector('button')!, 2);
		expect(win.startDragging).not.toHaveBeenCalled();
		expect(win.toggleMaximize).not.toHaveBeenCalled();
	});
});
