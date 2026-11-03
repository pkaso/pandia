export function autofocusSelect(node: HTMLInputElement) {
	const t = setTimeout(() => {
		node.focus();
		node.select();
	}, 0);
	return { destroy: () => clearTimeout(t) };
}

/** Grows a textarea with its text and focuses it: all text selected, or the caret at `caret`. */
export function autogrowArea(node: HTMLTextAreaElement, opts: { caret?: number } = {}) {
	const fit = () => {
		node.style.height = 'auto';
		node.style.height = `${node.scrollHeight}px`;
	};
	fit();
	node.addEventListener('input', fit);
	const t = setTimeout(() => {
		node.focus();
		if (opts.caret === undefined) node.select();
		else node.setSelectionRange(opts.caret, opts.caret);
		fit();
	}, 0);
	return {
		destroy: () => {
			node.removeEventListener('input', fit);
			clearTimeout(t);
		},
	};
}

export function autofocusEl(node: HTMLElement) {
	const t = setTimeout(() => node.focus(), 0);
	return { destroy: () => clearTimeout(t) };
}
