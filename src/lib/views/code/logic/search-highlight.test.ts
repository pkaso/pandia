// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { SearchQuery, search, setSearchQuery } from '@codemirror/search';
import { searchMatches } from './search-highlight';

let view: EditorView | null = null;
afterEach(() => {
	view?.destroy();
	view = null;
});

function editor(doc: string): EditorView {
	view = new EditorView({
		parent: document.body,
		state: EditorState.create({ doc, extensions: [search(), searchMatches] }),
	});
	return view;
}

function marks(v: EditorView) {
	return [...v.contentDOM.querySelectorAll('.cm-searchMatch')].map(
		(el) => `${el.textContent}${el.classList.contains('cm-searchMatch-selected') ? '*' : ''}`,
	);
}

describe('searchMatches', () => {
	it('marks every match, and the selected one as current', () => {
		const v = editor('{"name": "Pandia", "nickname": "pan"}');
		const doc = v.state.doc.toString();
		const second = doc.indexOf('name', doc.indexOf('name') + 1);
		v.dispatch({
			effects: setSearchQuery.of(new SearchQuery({ search: 'name' })),
			selection: EditorSelection.single(second, second + 4),
		});
		expect(marks(v)).toEqual(['name', 'name*']);
	});

	it('marks nothing once the query is cleared', () => {
		const v = editor('{"name": 1}');
		v.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: 'name' })) });
		expect(marks(v)).toEqual(['name']);
		v.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: '' })) });
		expect(marks(v)).toEqual([]);
	});
});
