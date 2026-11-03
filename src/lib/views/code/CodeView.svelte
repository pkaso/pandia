<script module lang="ts">
	export interface CodeViewApi {
		flush: () => Promise<boolean>;

		revert: () => void;

		undo: () => boolean;
		redo: () => boolean;

		cmSearch: (query: string, caseSensitive: boolean) => number;
		cmCount: (query: string, caseSensitive: boolean) => number;
		cmFindNext: () => void;
		cmFindPrev: () => void;

		cmReplaceAll: (query: string, replacement: string, caseSensitive: boolean) => number;

		/** Puts the caret on the line of `path` (on its key) and scrolls it into the middle. */
		revealPath: (path: Path) => Promise<void>;

		/** Opens every fold. */
		expandAll: () => void;
		/** Folds each of the root's children, like the tree's Collapse all: the top-level keys stay. */
		collapseAll: () => void;
	}

	/** The caret, VS Code style: 1-based line and column, and how many characters are selected. */
	export interface CodeCursor {
		line: number;
		col: number;
		selected: number;
	}
</script>

<script lang="ts">
	import { EditorState } from '@codemirror/state';
	import { fmtBytes } from '$lib/util/format';
	import {
		EditorView,
		lineNumbers,
		highlightActiveLine,
		highlightActiveLineGutter,
		drawSelection,
		highlightSpecialChars,
		keymap,
	} from '@codemirror/view';
	import { json, jsonParseLinter } from '@codemirror/lang-json';
	import { linter, lintGutter } from '@codemirror/lint';
	import {
		syntaxHighlighting,
		bracketMatching,
		codeFolding,
		foldGutter,
		foldCode,
		unfoldCode,
		foldAll,
		unfoldAll,
		foldable,
		foldEffect,
		ensureSyntaxTree,
	} from '@codemirror/language';
	import {
		defaultKeymap,
		history,
		historyKeymap,
		indentWithTab,
		undo,
		redo,
	} from '@codemirror/commands';
	import {
		search,
		SearchQuery,
		setSearchQuery,
		findNext as cmFindNextCmd,
		findPrevious as cmFindPrevCmd,
		replaceAll as cmReplaceAllCmd,
		SearchCursor,
	} from '@codemirror/search';
	import { ipc } from '$lib/ipc/client';
	import { describeError } from '$lib/ipc/error-copy';
	import { pathKey } from '$lib/views/tree/logic/model';
	import { noirHighlight, noirTheme } from './logic/codemirror-theme';
	import { searchMatches } from './logic/search-highlight';
	import type { DocHandle, Path } from '$lib/ipc/bindings';
	import { diffHighlightExtension, setHighlights, type Highlight } from './logic/highlights';

	interface Props {
		handle: DocHandle | null;
		version?: number;
		sourceSize: number;
		highlights?: Highlight[];
		activePath?: Path | null;

		onScrollerReady?: (el: HTMLElement) => void;

		editable?: boolean;

		onCommit?: (text: string) => boolean | Promise<boolean>;

		onDirtyChange?: (dirty: boolean) => void;

		onReady?: (api: CodeViewApi | null) => void;

		onParseState?: (state: { valid: boolean; message: string | null } | null) => void;

		onOpenTree?: () => void;

		onCursor?: (cursor: CodeCursor | null) => void;
	}

	let {
		handle,
		version,
		sourceSize,
		highlights = [],
		activePath = null,
		onScrollerReady,
		editable = false,
		onCommit,
		onDirtyChange,
		onReady,
		onParseState,
		onOpenTree,
		onCursor,
	}: Props = $props();

	function cursorOf(state: EditorState): CodeCursor {
		const head = state.selection.main.head;
		const line = state.doc.lineAt(head);
		const selected = state.selection.ranges.reduce((n, r) => n + (r.to - r.from), 0);
		return { line: line.number, col: head - line.from + 1, selected };
	}
	const cursorListener = EditorView.updateListener.of((u) => {
		if (u.selectionSet || u.docChanged) onCursor?.(cursorOf(u.state));
	});

	async function offsetOf(path: Path): Promise<[number, number] | null> {
		const k = pathKey(path);
		const known = offsetRanges.get(k);
		if (known) return known;
		const h = handle;
		if (!h) return null;
		try {
			const [r] = await ipc.docCanonicalOffsets(h, [path]);
			if (!r || handle !== h) return null;
			offsetRanges.set(k, [r.start, r.end]);
			return [r.start, r.end];
		} catch {
			return null;
		}
	}

	const SIZE_CAP = 50 * 1024 * 1024;
	const tooBig = $derived(sourceSize > SIZE_CAP);

	let container: HTMLDivElement | undefined = $state();
	let loading = $state(false);
	let error: string | null = $state(null);

	let editorView: EditorView | undefined;

	let offsetRanges = new Map<string, [number, number]>();
	let offsetsInFlight = new Set<string>();

	let dirty = $state(false);
	let parseError: string | null = $state(null);
	let baseline = '';
	let programmatic = false;

	function setDirty(d: boolean) {
		if (dirty === d) return;
		dirty = d;
		onDirtyChange?.(d);
	}

	let parseStateTimer: ReturnType<typeof setTimeout> | undefined;
	function emitParseState() {
		if (!editable || !onParseState || !editorView) return;
		const text = editorView.state.doc.toString();
		try {
			JSON.parse(text);
			onParseState({ valid: true, message: null });
		} catch (e) {
			onParseState({ valid: false, message: (e as Error).message });
		}
	}
	function scheduleParseState() {
		if (!editable || !onParseState) return;
		clearTimeout(parseStateTimer);
		parseStateTimer = setTimeout(emitParseState, 200);
	}

	function setBufferText(text: string) {
		if (!editorView) return;
		programmatic = true;
		editorView.dispatch({
			changes: { from: 0, to: editorView.state.doc.length, insert: text },
		});
		programmatic = false;
	}

	async function commit(): Promise<boolean> {
		if (!editable || !editorView) return true;
		const text = editorView.state.doc.toString();
		if (text === baseline) {
			setDirty(false);
			parseError = null;
			return true;
		}
		try {
			JSON.parse(text); // validate only — Rust does the precision-preserving parse
		} catch (e) {
			parseError = (e as Error).message;
			return false;
		}
		const ok = (await onCommit?.(text)) ?? true;
		if (!ok) {
			parseError = 'could not apply edit';
			return false;
		}
		baseline = text;
		parseError = null;
		setDirty(editorView.state.doc.toString() !== text);
		return true;
	}

	function revert() {
		if (!editorView) return;
		setBufferText(baseline);
		parseError = null;
		setDirty(false);
	}

	function countMatches(view: EditorView, query: string, caseSensitive: boolean): number {
		const doc = view.state.doc;
		const cursor = new SearchCursor(
			doc,
			query,
			0,
			doc.length,
			caseSensitive ? undefined : (s: string) => s.toLowerCase(),
		);
		let n = 0;
		while (!cursor.next().done) n++;
		return n;
	}

	const api: CodeViewApi = {
		expandAll: () => {
			if (editorView) unfoldAll(editorView);
		},
		collapseAll: () => {
			const view = editorView;
			if (!view) return;
			unfoldAll(view);
			const { state } = view;
			ensureSyntaxTree(state, state.doc.length, 500);
			const effects = [];
			// From line 2, so the root stays open; a folded child's own lines are skipped.
			let coveredTo = -1;
			for (let n = 2; n <= state.doc.lines; n++) {
				const line = state.doc.line(n);
				if (line.from < coveredTo) continue;
				const range = foldable(state, line.from, line.to);
				if (range) {
					effects.push(foldEffect.of(range));
					coveredTo = range.to;
				}
			}
			if (effects.length > 0) view.dispatch({ effects });
		},
		revealPath: async (path) => {
			const range = await offsetOf(path);
			const view = editorView;
			if (!range || !view) return;
			// The range starts at the value; a property's line starts with its key.
			const line = view.state.doc.lineAt(Math.min(range[0], view.state.doc.length));
			const at = line.from + (/^\s*/.exec(line.text)?.[0].length ?? 0);
			view.dispatch({
				selection: { anchor: at },
				effects: EditorView.scrollIntoView(at, { y: 'center' }),
			});
			view.focus();
		},
		flush: () => commit(),
		revert,
		undo: () => (editorView ? undo(editorView) : false),
		redo: () => (editorView ? redo(editorView) : false),
		cmSearch: (query, caseSensitive) => {
			if (!editorView) return 0;
			editorView.dispatch({
				effects: setSearchQuery.of(new SearchQuery({ search: query, caseSensitive })),
			});
			if (!query) return 0;
			const count = countMatches(editorView, query, caseSensitive);
			if (count > 0) cmFindNextCmd(editorView); // land on the first match
			return count;
		},
		cmCount: (query, caseSensitive) =>
			editorView ? countMatches(editorView, query, caseSensitive) : 0,
		cmFindNext: () => {
			if (editorView) cmFindNextCmd(editorView);
		},
		cmFindPrev: () => {
			if (editorView) cmFindPrevCmd(editorView);
		},
		cmReplaceAll: (query, replacement, caseSensitive) => {
			if (!editorView || !query) return 0;
			editorView.dispatch({
				effects: setSearchQuery.of(
					new SearchQuery({ search: query, replace: replacement, caseSensitive }),
				),
			});
			const count = countMatches(editorView, query, caseSensitive);
			cmReplaceAllCmd(editorView);
			return count;
		},
	};

	$effect(() => {
		void version;
		if (!container || tooBig || !handle) return;

		let cancelled = false;
		let view: EditorView | undefined;

		loading = true;
		error = null;

		ipc
			.docCanonicalText(handle)
			.then((text) => {
				if (cancelled || !container) return;
				offsetRanges = new Map();
				offsetsInFlight = new Set();
				baseline = text;
				setDirty(false);
				parseError = null;
				view = new EditorView({
					parent: container,
					state: EditorState.create({
						doc: text,
						extensions: [
							lineNumbers(),
							highlightActiveLineGutter(),
							highlightSpecialChars(),
							drawSelection(),
							highlightActiveLine(),
							bracketMatching(),
							codeFolding(),
							foldGutter(),
							syntaxHighlighting(noirHighlight),
							json(),
							diffHighlightExtension(),
							search(),
							searchMatches,
							keymap.of([
								{ key: 'Mod-[', run: foldCode },
								{ key: 'Mod-]', run: unfoldCode },
								{ key: 'Mod-Shift-[', run: foldAll },
								{ key: 'Mod-Shift-]', run: unfoldAll },
							]),
							...(editable ? editExtensions() : readOnlyExtensions()),
							cursorListener,
							noirTheme,
						],
					}),
				});
				editorView = view;
				onCursor?.(cursorOf(view.state));
				void ensureOffsets();
				onScrollerReady?.(view.scrollDOM);
				if (editable) {
					onReady?.(api);
					emitParseState(); // initial buffer is the committed doc → valid
				}
			})
			.catch((e) => {
				if (!cancelled) error = describeError(e);
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
			clearTimeout(parseStateTimer);
			if (editable && view) {
				onParseState?.(null);
				const text = view.state.doc.toString();
				if (text !== baseline) {
					try {
						JSON.parse(text); // validate; an invalid buffer is discarded on unmount
						void onCommit?.(text); // Rust re-parses with arbitrary_precision
					} catch {}
				}
				onReady?.(null);
			}
			view?.destroy();
			editorView = undefined;
			onCursor?.(null);
			offsetRanges = new Map();
			offsetsInFlight = new Set();
		};
	});

	function readOnlyExtensions() {
		return [EditorState.readOnly.of(true), EditorView.editable.of(false)];
	}

	function editExtensions() {
		return [
			history(),
			keymap.of([
				{ key: 'Mod-Enter', run: () => (void commit(), true) },
				{ key: 'Escape', run: () => (revert(), true) },
				...historyKeymap,
				...defaultKeymap,
				indentWithTab,
			]),
			lintGutter(),
			linter(jsonParseLinter()),
			EditorView.updateListener.of((u) => {
				if (programmatic || !u.docChanged) return;
				setDirty(true);
				if (parseError) parseError = null;
				scheduleParseState();
			}),
		];
	}

	function applyDecorations() {
		if (!editorView) return;
		const ranges: Array<{ from: number; to: number; kind: Highlight['kind'] }> = [];
		for (const h of highlights) {
			const range = offsetRanges.get(pathKey(h.path));
			if (range) ranges.push({ from: range[0], to: range[1], kind: h.kind });
		}
		const active = activePath ? (offsetRanges.get(pathKey(activePath)) ?? null) : null;
		editorView.dispatch({
			effects: setHighlights.of({
				ranges,
				active: active ? { from: active[0], to: active[1] } : null,
			}),
		});
		if (active) {
			editorView.dispatch({
				effects: EditorView.scrollIntoView(active[0], {
					y: 'center',
				}),
			});
		}
	}

	async function ensureOffsets() {
		const h = handle;
		if (!h || !editorView) return;
		const needed: Path[] = [];
		const requested = new Set<string>();
		const want = (p: Path) => {
			const k = pathKey(p);
			if (offsetRanges.has(k) || offsetsInFlight.has(k) || requested.has(k)) return;
			requested.add(k);
			needed.push(p);
		};
		for (const hl of highlights) want(hl.path);
		if (activePath) want(activePath);
		if (needed.length === 0) {
			applyDecorations();
			return;
		}
		for (const k of requested) offsetsInFlight.add(k);
		try {
			const res = await ipc.docCanonicalOffsets(h, needed);
			if (handle !== h || !editorView) return;
			needed.forEach((p, idx) => {
				const r = res[idx];
				if (r) offsetRanges.set(pathKey(p), [r.start, r.end]);
			});
		} catch {
			// Highlights are decorative; the text itself already rendered.
		} finally {
			for (const k of requested) offsetsInFlight.delete(k);
		}
		applyDecorations();
	}

	$effect(() => {
		void highlights;
		void activePath;
		void ensureOffsets();
	});
</script>

{#if tooBig}
	<div class="empty-state">
		<div class="empty-state-inner">
			<div class="label">code view unavailable</div>
			<p>this document is {fmtBytes(sourceSize)} — code view is capped at {fmtBytes(SIZE_CAP)}.</p>
			<p class="dim text-sm">use tree view: it streams slices from Rust regardless of size.</p>
			{#if onOpenTree}
				<button class="btn btn-primary self-start" onclick={onOpenTree}>Open in Tree view</button>
			{/if}
		</div>
	</div>
{:else}
	<div class="host">
		<div class="cm-wrap" bind:this={container}></div>
		{#if editable && parseError}
			<div class="edit-bar">
				<span class="eb-msg">
					<span class="eb-dot" aria-hidden="true"></span>parse error · {parseError}
				</span>
			</div>
		{/if}
		{#if loading}<div class="status loading">Loading…</div>{/if}
		{#if error}<div class="status err">{error}</div>{/if}
	</div>
{/if}

<style>
	.host {
		flex: 1;
		min-height: 0;
		position: relative;
		display: flex;
		flex-direction: column;
	}
	.cm-wrap {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
	.cm-wrap :global(.cm-editor) {
		height: 100%;
	}

	.status {
		position: absolute;
		top: 0.4rem;
		right: 1rem;
		font-size: var(--font-size-sm);
		padding: var(--space-2xs) var(--space-sm);
		background: var(--bg-elev);
		border: 1px solid var(--rule);
		pointer-events: none;
	}
	.status.loading {
		color: var(--text-dim);
	}
	.status.err {
		color: var(--danger);
		border-color: var(--danger);
	}

	.edit-bar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-xs) var(--space-md);
		background: var(--bg-elev);
		border-top: var(--rule-width) solid var(--danger);
		font-size: var(--font-size-sm);
		color: var(--danger);
	}
	.eb-msg {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.eb-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--danger);
		flex-shrink: 0;
	}

	.cm-wrap :global(.cm-diff-added) {
		background: var(--success-tint);
	}
	.cm-wrap :global(.cm-diff-removed) {
		background: var(--danger-tint);
		text-decoration: line-through;
		text-decoration-color: var(--danger);
	}
	.cm-wrap :global(.cm-diff-changed) {
		background: var(--warning-tint);
	}
	.cm-wrap :global(.cm-diff-active) {
		outline: 1px solid var(--accent);
		outline-offset: 0;
	}
</style>
