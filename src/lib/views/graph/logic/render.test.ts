// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { layoutGraph } from './layout';
import { toRow } from './card-helpers';
import { fitText, paintFrame } from './render';
import { exportLayoutSVG } from './render-svg';
import { readGraphTheme } from './theme';

// jsdom has no canvas; the SVG export falls back to a fixed width per UTF-16 unit.
HTMLCanvasElement.prototype.getContext = (() => null) as never;

const CHAR_W = 7;
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

function recordingCtx() {
	const strokes: unknown[] = [];
	const fills: unknown[] = [];
	const state: Record<string | symbol, unknown> = {};
	const ctx = new Proxy(state, {
		get(target, key) {
			if (key === 'stroke') return () => strokes.push(target.strokeStyle);
			if (key === 'fillRect') return () => fills.push(target.fillStyle);
			if (key === 'measureText') return (s: string) => ({ width: s.length * CHAR_W });
			if (key in target) return target[key];
			return () => {};
		},
		set(target, key, value) {
			target[key] = value;
			return true;
		},
	});
	return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes, fills };
}

function stringRows(values: Record<string, string>) {
	const rows = Object.entries(values).map(([key, v]) =>
		toRow([], { key, kind: 'string', preview: JSON.stringify(v), childCount: null }),
	);
	return layoutGraph({ id: '[]', path: [], title: 'root', kind: 'object', rows, hue: 0 });
}

describe('paintFrame — search highlight', () => {
	function paint(scale: number, searchQuery: string, current: boolean) {
		const theme = readGraphTheme();
		const layout = stringRows({ name: 'pandia', other: 'zzz' });
		const { ctx, strokes, fills } = recordingCtx();
		paintFrame({
			ctx,
			layout,
			viewport: { tx: 0, ty: 0, scale },
			screenW: 800,
			screenH: 600,
			theme,
			dpr: 1,
			highlightCardId: current ? layout.cards[0]!.id : null,
			searchQuery,
		});
		return { theme, strokes, fills };
	}

	it.each([0.1, 0.3])('rings the current card when zoomed too far out for text (%f)', (scale) => {
		const { theme, strokes } = paint(scale, 'pan', true);
		expect(strokes).toContain(theme.accent);
	});

	it('marks matching text with a background at reading zoom, the current card more strongly', () => {
		const current = paint(1, 'pan', true);
		expect(current.strokes).not.toContain(current.theme.accent); // background only, no ring
		expect(current.fills).toContain(current.theme.findCurrent);

		const other = paint(1, 'pan', false);
		expect(other.fills).toContain(other.theme.findMatch);
		expect(other.fills).not.toContain(other.theme.findCurrent);
	});

	it('marks nothing without a query', () => {
		const { theme, fills } = paint(1, '', false);
		expect(fills).not.toContain(theme.findMatch);
	});
});

describe('truncated emoji labels', () => {
	const emoji = '😀'.repeat(60);

	it('canvas text never ends in half an emoji', () => {
		const { ctx } = recordingCtx();
		for (const width of [30, 37, 44]) {
			expect(fitText(ctx, emoji, width)).not.toMatch(LONE_SURROGATE);
		}
	});

	it('SVG text never ends in half an emoji', () => {
		const svg = exportLayoutSVG(stringRows({ a: emoji, b: `x${emoji}` }), readGraphTheme());
		expect(svg).not.toMatch(LONE_SURROGATE);
	});
});
