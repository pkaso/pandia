import { RangeSetBuilder } from '@codemirror/state';
import {
	Decoration,
	ViewPlugin,
	type DecorationSet,
	type EditorView,
	type ViewUpdate,
} from '@codemirror/view';
import { getSearchQuery } from '@codemirror/search';

const match = Decoration.mark({ class: 'cm-searchMatch' });
const current = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' });

function matchDecorations(view: EditorView): DecorationSet {
	const query = getSearchQuery(view.state);
	if (!query.search || !query.valid) return Decoration.none;
	const { state } = view;
	const sel = state.selection.main;
	const builder = new RangeSetBuilder<Decoration>();
	const reach = query.search.length;
	let last = 0;
	for (const { from, to } of view.visibleRanges) {
		// Reach past the edges so a match cut by a viewport boundary is still found.
		const cursor = query.getCursor(
			state,
			Math.max(last, from - reach),
			Math.min(state.doc.length, to + reach),
		);
		for (let r = cursor.next(); !r.done; r = cursor.next()) {
			const m = r.value;
			if (m.from < last) continue;
			builder.add(m.from, m.to, m.from === sel.from && m.to === sel.to ? current : match);
			last = m.to;
		}
	}
	return builder.finish();
}

/**
 * Marks every match of the active search query, the selected one as current. CodeMirror's own
 * highlighter only runs while its built-in search panel is open, and Pandia uses its own find bar.
 */
export const searchMatches = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		constructor(view: EditorView) {
			this.decorations = matchDecorations(view);
		}
		update(u: ViewUpdate) {
			const queryChanged = getSearchQuery(u.startState) !== getSearchQuery(u.state);
			if (queryChanged || u.docChanged || u.viewportChanged || u.selectionSet) {
				this.decorations = matchDecorations(u.view);
			}
		}
	},
	{ decorations: (v) => v.decorations },
);
