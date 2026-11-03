import { EditorView } from '@codemirror/view';
import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const noirTheme = EditorView.theme(
	{
		'&': {
			color: 'var(--text)',
			backgroundColor: 'var(--bg)',
			height: '100%',
			fontSize: 'var(--font-size-base)',
			fontFamily: 'var(--font-mono)',
		},
		'.cm-scroller': { fontFamily: 'var(--font-mono)' },
		'.cm-content': {
			caretColor: 'var(--accent)',
			padding: 'var(--space-sm) 0',
		},
		'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
		'.cm-gutters': {
			backgroundColor: 'var(--bg-elev)',
			color: 'var(--text-dim)',
			borderRight: '1px solid var(--rule)',
		},
		'.cm-activeLine': { backgroundColor: 'var(--line-tint)' },
		'.cm-activeLineGutter': {
			backgroundColor: 'var(--bg-elev-2)',
			color: 'var(--text)',
		},
		// CodeMirror's base theme paints selections with fixed colours (#233 / #222 in dark) through
		// more specific selectors, so ours need !important to apply in every theme.
		'& .cm-selectionLayer .cm-selectionBackground': {
			background: 'var(--accent-soft) !important',
		},
		'&.cm-focused .cm-selectionLayer .cm-selectionBackground': {
			background: 'var(--accent-fill) !important',
		},
		// CodeMirror hides the native selection's background but not its text colour, so the app-wide
		// ::selection rule (text in --bg, i.e. white in light themes) would still recolour selected code.
		// Use the colour that reads best on the selection tint instead; this also overrides syntax colours
		// that can match the tint (blue keys on a blue selection).
		'.cm-line::selection, .cm-line ::selection': {
			color: 'var(--selection-text) !important',
		},
		'.cm-matchingBracket': {
			backgroundColor: 'var(--accent-soft)',
			color: 'var(--accent)',
			outline: 'none',
		},
		'.cm-foldGutter .cm-gutterElement': {
			color: 'var(--text-dim)',
			cursor: 'pointer',
			padding: '0 0.2em',
		},
		'.cm-foldGutter .cm-gutterElement:hover': {
			color: 'var(--text)',
		},
		'.cm-foldPlaceholder': {
			backgroundColor: 'var(--bg-elev)',
			border: '1px solid var(--rule)',
			color: 'var(--text-dim)',
			padding: '0 var(--space-xs)',
			margin: '0 var(--space-2xs)',
		},
		'.cm-searchMatch': { backgroundColor: 'var(--accent-soft)' },
		'.cm-searchMatch-selected': {
			backgroundColor: 'var(--accent-fill)',
			outline: '1px solid var(--accent)',
		},
		'.cm-lintRange-error': {
			backgroundImage: 'none',
			textDecoration: 'underline wavy var(--danger)',
		},
		'.cm-lint-marker-error': { color: 'var(--danger)' },
		'.cm-tooltip.cm-tooltip-lint': {
			backgroundColor: 'var(--bg-elev)',
			border: 'var(--rule-width) solid var(--rule)',
			color: 'var(--text)',
		},
		'.cm-diagnostic-error': { borderLeftColor: 'var(--danger)' },
	},
	{ dark: true },
);

export const noirHighlight = HighlightStyle.define([
	{ tag: t.string, color: 'var(--syntax-string)' },
	{ tag: t.number, color: 'var(--syntax-number)' },
	{ tag: t.bool, color: 'var(--syntax-boolean)' },
	{ tag: t.null, color: 'var(--syntax-null)', fontStyle: 'italic' },
	{ tag: t.propertyName, color: 'var(--syntax-key)' },
	{ tag: t.brace, color: 'var(--syntax-punct)' },
	{ tag: t.bracket, color: 'var(--syntax-punct)' },
	{ tag: t.separator, color: 'var(--syntax-punct)' },
	{ tag: t.punctuation, color: 'var(--syntax-punct)' },
]);
