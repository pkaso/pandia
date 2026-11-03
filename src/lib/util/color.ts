export function mixHex(a: string, b: string, t: number): string {
	const ar = parseInt(a.slice(1, 3), 16);
	const ag = parseInt(a.slice(3, 5), 16);
	const ab = parseInt(a.slice(5, 7), 16);
	const br = parseInt(b.slice(1, 3), 16);
	const bg = parseInt(b.slice(3, 5), 16);
	const bb = parseInt(b.slice(5, 7), 16);
	const r = Math.round(ar + (br - ar) * t);
	const g = Math.round(ag + (bg - ag) * t);
	const bl = Math.round(ab + (bb - ab) * t);
	return '#' + [r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Paints `fill` (#rrggbb or rgba(r, g, b, a)) over the opaque `base` and returns the result as hex. */
export function flatten(fill: string, base: string): string {
	const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(fill);
	if (!m) return fill;
	const hex = '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
	return mixHex(base, hex, m[4] === undefined ? 1 : Number(m[4]));
}

export function withAlpha(hex: string, alpha: number): string {
	const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function linear(hex: string, at: number): number {
	const c = parseInt(hex.slice(at, at + 2), 16) / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
	return 0.2126 * linear(hex, 1) + 0.7152 * linear(hex, 3) + 0.0722 * linear(hex, 5);
}

export function contrastRatio(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}
