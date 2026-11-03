import { describe, it, expect } from 'vitest';
import { splitMatches } from './match-segments';

describe('splitMatches', () => {
	const marked = (text: string, q: string) =>
		splitMatches(text, q)
			.map((s) => (s.match ? `[${s.text}]` : s.text))
			.join('');

	it('marks every case-insensitive occurrence, keeping the original casing', () => {
		expect(marked('"Pandia pandas"', 'pAnD')).toBe('"[Pand]ia [pand]as"');
	});
	it('treats the query literally', () => {
		expect(marked('a.b (c)', '.')).toBe('a[.]b (c)');
		expect(marked('price: $5', '$5')).toBe('price: [$5]');
	});
	it('leaves text without a match, or an empty query, unmarked', () => {
		expect(splitMatches('name', 'zzz')).toEqual([{ text: 'name', match: false }]);
		expect(splitMatches('name', '  ')).toEqual([{ text: 'name', match: false }]);
	});
});
