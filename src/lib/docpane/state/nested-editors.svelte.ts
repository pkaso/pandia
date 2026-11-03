/**
 * Which pane owns the app's commands and shortcuts. Every open nested editor sits one level above the
 * pane it was opened from; only the topmost level registers its commands, so ⌘Z or ⌘F in a nested
 * editor can never reach the document underneath it.
 */
class NestedEditors {
	private open: number[] = $state([]);

	/** The depth whose pane owns commands: 0 for the tab's own pane, 1+ inside nested editors. */
	get top(): number {
		return this.open.at(-1) ?? 0;
	}

	/** Marks a nested editor at `depth` open until the returned function is called. */
	push(depth: number): () => void {
		this.open = [...this.open, depth];
		let done = false;
		return () => {
			if (done) return;
			done = true;
			const i = this.open.lastIndexOf(depth);
			if (i >= 0) this.open = [...this.open.slice(0, i), ...this.open.slice(i + 1)];
		};
	}
}

export const nestedEditors = new NestedEditors();
