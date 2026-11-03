import { describe, expect, it } from 'vitest';
import { json } from '@codemirror/lang-json';
import { highlightTree } from '@lezer/highlight';
import { noirHighlight } from './codemirror-theme';

describe('noirHighlight', () => {
	// Fails when the JSON language and this style load different copies of
	// @codemirror/language or @lezer/highlight: tags then never match.
	it('colours every JSON token kind', () => {
		const doc = '{"key": "text", "n": 1, "b": true, "z": null}';
		const tree = json().language.parser.parse(doc);
		const styled = new Map<string, string>();
		highlightTree(tree, noirHighlight, (from, to, classes) => {
			styled.set(doc.slice(from, to), classes);
		});
		for (const token of ['"key"', '"text"', '1', 'true', 'null']) {
			expect(styled.get(token), token).toBeTruthy();
		}
		expect(styled.get('"key"')).not.toBe(styled.get('"text"'));
	});
});
