import { describe, expect, it } from 'vitest';
import {
	compactJson,
	containerTextIn,
	convertedText,
	escapeString,
	unescapeString,
} from './convert';

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

describe('convertedText', () => {
	const str = (s: string) => JSON.stringify(s);

	it('to String: numbers and booleans become their text, containers their compact JSON', () => {
		expect(convertedText('number', '9007199254740993', 'string')).toBe(str('9007199254740993'));
		expect(convertedText('bool', 'true', 'string')).toBe(str('true'));
		expect(convertedText('null', 'null', 'string')).toBe(str('null'));
		expect(convertedText('array', '[\n  1,\n  2\n]', 'string')).toBe(str('[1,2]'));
	});

	it('to Number: like Number(), with non-numbers becoming 0', () => {
		expect(convertedText('string', str('123'), 'number')).toBe('123');
		expect(convertedText('string', str(' 1.5e3 '), 'number')).toBe('1.5e3');
		expect(convertedText('string', str('12345678901234567890123'), 'number')).toBe(
			'12345678901234567890123',
		);
		expect(convertedText('string', str('007'), 'number')).toBe('7');
		expect(convertedText('string', str('asdf'), 'number')).toBe('0');
		expect(convertedText('string', str(''), 'number')).toBe('0');
		expect(convertedText('bool', 'true', 'number')).toBe('1');
		expect(convertedText('bool', 'false', 'number')).toBe('0');
		expect(convertedText('null', 'null', 'number')).toBe('0');
		expect(convertedText('object', '{}', 'number')).toBe('0');
	});

	it('to Boolean: like Boolean(), except the string "false" is false', () => {
		expect(convertedText('string', str('true'), 'bool')).toBe('true');
		expect(convertedText('string', str('anything'), 'bool')).toBe('true');
		expect(convertedText('string', str(''), 'bool')).toBe('false');
		expect(convertedText('string', str(' False '), 'bool')).toBe('false');
		expect(convertedText('number', '0', 'bool')).toBe('false');
		expect(convertedText('number', '0.000', 'bool')).toBe('false');
		expect(convertedText('number', '-2.5', 'bool')).toBe('true');
		expect(convertedText('null', 'null', 'bool')).toBe('false');
		expect(convertedText('object', '{}', 'bool')).toBe('true');
		expect(convertedText('array', '[]', 'bool')).toBe('true');
	});
});
