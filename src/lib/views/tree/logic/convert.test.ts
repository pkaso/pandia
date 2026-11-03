import { describe, expect, it } from 'vitest';
import { compactJson, containerTextIn, escapeString, unescapeString } from './convert';

describe('compactJson', () => {
	it('drops whitespace between tokens but keeps it inside strings and keeps digits exact', () => {
		expect(compactJson('{\n  "a b": [1.20, 3],\n  "n": 9007199254740993\n}')).toBe(
			'{"a b":[1.20,3],"n":9007199254740993}',
		);
		expect(compactJson('["say \\" hi"]')).toBe('["say \\" hi"]');
	});
});

describe('escapeString / unescapeString', () => {
	it('round-trips quotes, backslashes and line breaks', () => {
		const s = 'say "hi"\\ok\nnext';
		expect(escapeString(s)).toBe('say \\"hi\\"\\\\ok\\nnext');
		expect(unescapeString(escapeString(s))).toBe(s);
	});
	it('keeps raw quotes and line breaks as they are', () => {
		expect(unescapeString('a "b"\nc\\td')).toBe('a "b"\nc\td');
	});
	it('refuses an escape JSON does not allow', () => {
		expect(unescapeString('bad \\q')).toBeNull();
	});
});

describe('containerTextIn', () => {
	it('finds an array or object typed as text or escaped', () => {
		expect(containerTextIn('[1.2,3]', 'array')).toBe('[1.2,3]');
		expect(containerTextIn(' {"a": 123} ', 'object')).toBe('{"a": 123}');
		expect(containerTextIn('[\\"a\\",1]', 'array')).toBe('["a",1]');
		expect(containerTextIn('{\\"a\\":{\\"b\\":2}}', 'object')).toBe('{"a":{"b":2}}');
	});
	it('rejects the other kind and text that is not JSON', () => {
		expect(containerTextIn('[1]', 'object')).toBeNull();
		expect(containerTextIn('{"a":1}', 'array')).toBeNull();
		expect(containerTextIn('hello', 'array')).toBeNull();
		expect(containerTextIn('null', 'object')).toBeNull();
	});
});
