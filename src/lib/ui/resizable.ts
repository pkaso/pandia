interface ResizableOptions {
	onMove: (dx: number) => void;
	onStart?: () => void;

	onEnd?: (moved: boolean) => void;

	swallow?: boolean;

	/** Which pointer axis drives the resize; `onMove` receives the delta along it. Defaults to 'x'. */
	axis?: 'x' | 'y';
}

export function resizable(node: HTMLElement, options: ResizableOptions) {
	let opts = options;
	let start = 0;
	let moved = false;
	let active = false;

	function down(e: PointerEvent) {
		if (e.button !== 0) return;
		if (opts.swallow) {
			e.preventDefault();
			e.stopPropagation();
		}
		active = true;
		start = opts.axis === 'y' ? e.clientY : e.clientX;
		moved = false;
		node.setPointerCapture(e.pointerId);
		opts.onStart?.();
	}
	function move(e: PointerEvent) {
		if (!active) return;
		const d = (opts.axis === 'y' ? e.clientY : e.clientX) - start;
		if (Math.abs(d) > 1) moved = true;
		opts.onMove(d);
	}
	function end(e: PointerEvent) {
		if (!active) return;
		active = false;
		try {
			node.releasePointerCapture(e.pointerId);
		} catch {}
		opts.onEnd?.(moved);
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', end);
	node.addEventListener('pointercancel', end);

	return {
		update(next: ResizableOptions) {
			opts = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', end);
			node.removeEventListener('pointercancel', end);
		},
	};
}
