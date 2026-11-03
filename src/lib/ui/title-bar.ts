import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

const CONTROLS =
	'button, input, select, textarea, a, [role="button"], [role="tab"], [data-tab-id], [data-no-drag]';

/**
 * Makes a strip act as the window's title bar: drag it to move the window, double-click it to
 * maximize or restore. Clicks on controls inside it are left alone. Listens to `mousedown`, because
 * pointer events don't count clicks.
 */
export function titleBar(node: HTMLElement) {
	function onMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		if ((e.target as HTMLElement | null)?.closest(CONTROLS)) return;
		const win = getCurrentWebviewWindow();
		if (e.detail === 2) void win.toggleMaximize().catch(() => {});
		else void win.startDragging().catch(() => {});
	}
	node.addEventListener('mousedown', onMouseDown);
	return { destroy: () => node.removeEventListener('mousedown', onMouseDown) };
}
