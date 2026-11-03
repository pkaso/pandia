<script lang="ts">
	import Icon from '$lib/ui/Icon.svelte';
	import { X, Plus } from '@lucide/svelte';
	import { shortcutLabel } from '$lib/shell/logic/shortcuts';
	import { basename } from '$lib/util/path';

	interface Tab {
		id: string;
		label: string;
		sourceName: string | null;
		renamable: boolean;
		unsaved: boolean;
	}

	let {
		tabs,
		activeTabId,
		capWarning,
		maxTabs,
		hasActiveDoc,
		comparePickerOpen,
		compareBtnEl = $bindable(null),
		onActivate,
		onClose,
		onNew,
		onReorder,
		onRename,
		onToggleCompare,
		onExport,
	}: {
		tabs: Tab[];
		activeTabId: string;
		capWarning: boolean;
		maxTabs: number;
		hasActiveDoc: boolean;
		comparePickerOpen: boolean;

		compareBtnEl?: HTMLElement | null;
		onActivate: (id: string) => void;
		onClose: (id: string) => void;
		onNew: () => void;
		onReorder: (sourceId: string, targetId: string) => void;
		/** Resolves false when the rename failed; the document pane shows why. */
		onRename: (id: string, name: string) => Promise<boolean>;
		onToggleCompare: () => void;
		onExport: () => void;
	} = $props();

	let draggingId: string | null = $state(null);
	let dragOverId: string | null = $state(null);
	let dragStart: { tabId: string; x: number; y: number; pointerId: number } | null = null;
	const DRAG_THRESHOLD_PX = 4;

	function onTabPointerDown(id: string, e: PointerEvent) {
		if ((e.target as HTMLElement).closest('.tab-close, .tab-rename')) return;
		if (e.button !== 0) return;
		// The pointer capture below retargets the click to the tab itself, so remember where the press began.
		pressOnLabel = !!(e.target as HTMLElement).closest('.tab-label');
		dragStart = { tabId: id, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function onTabPointerMove(e: PointerEvent) {
		if (!dragStart) return;
		const dx = e.clientX - dragStart.x;
		const dy = e.clientY - dragStart.y;
		if (!draggingId && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
			return;
		}
		draggingId = dragStart.tabId;
		const hit = document.elementFromPoint(e.clientX, e.clientY);
		const overTab = hit?.closest('[data-tab-id]') as HTMLElement | null;
		dragOverId = overTab?.dataset.tabId ?? null;
	}

	function onTabPointerUp(e: PointerEvent) {
		if (!dragStart) return;
		const sourceId = draggingId;
		const targetId = dragOverId;
		try {
			(e.currentTarget as Element).releasePointerCapture(dragStart.pointerId);
		} catch {}
		dragStart = null;
		draggingId = null;
		dragOverId = null;
		// A drag ends with a click on the tab; it shouldn't also open the rename field.
		justDragged = sourceId !== null;
		if (sourceId && targetId && sourceId !== targetId) onReorder(sourceId, targetId);
	}

	let justDragged = false;
	let pressOnLabel = false;

	// Renaming: a click on another tab switches to it; a click on the active tab's name (or F2) edits it.
	function onTabClick(tab: Tab) {
		const dragged = justDragged;
		justDragged = false;
		if (renamingId === tab.id || dragged) return;
		if (tab.id !== activeTabId) onActivate(tab.id);
		else if (pressOnLabel) startRename(tab);
	}

	let renamingId: string | null = $state(null);
	let draft = $state('');
	let renameBusy = $state(false);
	let originalName = '';
	const draftInvalid = $derived(
		/[/\\]/.test(draft) || draft.trim() === '.' || draft.trim() === '..',
	);

	function currentName(tab: Tab): string {
		return tab.sourceName && tab.sourceName !== '(inline)'
			? basename(tab.sourceName)
			: 'untitled.json';
	}

	function startRename(tab: Tab) {
		if (!tab.renamable || renameBusy) return;
		originalName = currentName(tab);
		draft = originalName;
		renamingId = tab.id;
	}

	function focusRenameField(input: HTMLInputElement) {
		input.focus();
		const dot = input.value.lastIndexOf('.');
		input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
	}

	async function commitRename() {
		const id = renamingId;
		const name = draft.trim();
		if (!id || renameBusy) return;
		if (!name || name === originalName || draftInvalid) {
			renamingId = null;
			return;
		}
		renameBusy = true;
		try {
			await onRename(id, name);
		} finally {
			renameBusy = false;
			renamingId = null;
		}
	}

	function onRenameKey(e: KeyboardEvent) {
		e.stopPropagation(); // typing here mustn't activate the tab (Enter/Space) or reach other handlers
		if (e.key === 'Enter') {
			e.preventDefault();
			if (!draftInvalid) void commitRename();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			renamingId = null;
		}
	}

	function onTabPointerCancel() {
		dragStart = null;
		draggingId = null;
		dragOverId = null;
	}
</script>

<nav class="tab-bar" aria-label="open documents">
	<div class="tab-scroll">
		{#each tabs as tab (tab.id)}
			<div
				class="tab"
				class:active={tab.id === activeTabId}
				class:dragging={draggingId === tab.id}
				class:drag-over={dragOverId === tab.id && draggingId !== tab.id}
				data-tab-id={tab.id}
				onpointerdown={(e) => onTabPointerDown(tab.id, e)}
				onpointermove={onTabPointerMove}
				onpointerup={onTabPointerUp}
				onpointercancel={onTabPointerCancel}
				onclick={() => onTabClick(tab)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onActivate(tab.id);
					} else if (e.key === 'F2' && tab.id === activeTabId) {
						e.preventDefault();
						startRename(tab);
					}
				}}
				role="tab"
				tabindex="0"
				aria-selected={tab.id === activeTabId}
				title={tab.id === activeTabId && tab.renamable
					? `${tab.sourceName ?? tab.label} · click the name again or press F2 to rename`
					: (tab.sourceName ?? tab.label)}
			>
				{#if renamingId === tab.id}
					<input
						class="tab-rename"
						class:invalid={draftInvalid}
						bind:value={draft}
						use:focusRenameField
						size={Math.max(8, draft.length + 1)}
						disabled={renameBusy}
						spellcheck="false"
						aria-label="Rename document"
						aria-invalid={draftInvalid}
						title={draftInvalid
							? 'A name can’t contain / or \\'
							: 'Enter to rename · Esc to cancel'}
						onkeydown={onRenameKey}
						onblur={() => void commitRename()}
						onclick={(e) => e.stopPropagation()}
					/>
				{:else}
					<span class="tab-label">{tab.label}</span>
				{/if}
				<!-- As in VS Code: an unsaved tab shows a dot where the close button is; hovering reveals the X. -->
				<button
					class="tab-close"
					class:unsaved={tab.unsaved}
					onclick={(e) => {
						e.stopPropagation();
						onClose(tab.id);
					}}
					title={`Close tab (${shortcutLabel('tab.close')})`}
					aria-label={tab.unsaved ? 'Close tab (unsaved changes)' : 'Close tab'}
					><span class="close-x"><Icon icon={X} size="xs" /></span><span
						class="unsaved-dot"
						aria-hidden="true"
					></span></button
				>
			</div>
		{/each}
		<button
			class="tab-new"
			onclick={onNew}
			title={tabs.length >= maxTabs
				? `Max ${maxTabs} tabs`
				: `New tab (${shortcutLabel('tab.new')})`}
			disabled={tabs.length >= maxTabs}
			aria-label="New tab"><Icon icon={Plus} size="sm" /></button
		>
		{#if capWarning}
			<span class="cap-warn text-xs dim">Max {maxTabs} tabs · close one to open another</span>
		{/if}
	</div>
	<div class="tab-bar-drag" aria-hidden="true"></div>
	<div class="tab-bar-actions">
		<button
			bind:this={compareBtnEl}
			class="tba"
			class:on={comparePickerOpen}
			onclick={onToggleCompare}
			disabled={!hasActiveDoc}
			title="Diff against an open tab or a file"
			aria-haspopup="menu"
			aria-expanded={comparePickerOpen}
		>
			<span>Compare</span><span class="kbd">{shortcutLabel('compare.pick')}</span>
		</button>
		<button
			class="tba"
			onclick={onExport}
			disabled={!hasActiveDoc}
			title="Export to JSON (pretty / minified) · YAML · CSV · XML"
		>
			<span>Export</span><span class="kbd">{shortcutLabel('doc.export')}</span>
		</button>
	</div>
</nav>

<style>
	.tab-bar {
		display: flex;
		align-items: stretch;
		height: var(--tab-h);
		user-select: none;
	}

	.tab,
	.tab-new,
	.tba {
		-webkit-app-region: no-drag;
	}

	.tab-bar-drag {
		flex: 1 1 auto;
		min-width: 24px;
		align-self: stretch;
		-webkit-app-region: drag;
	}

	.tab-scroll {
		display: flex;
		align-items: stretch;
		flex: 0 1 auto;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
	}

	.tab-scroll::-webkit-scrollbar {
		height: 4px;
	}

	.tab {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: 0 var(--space-lg);
		font-size: var(--font-size-sm);
		color: var(--text-dim);
		border-right: var(--rule-width) solid var(--rule);
		cursor: pointer;
		white-space: nowrap;
		flex: 0 0 auto;
		max-width: 220px;
	}
	.tab:hover {
		color: var(--text);
	}
	.tab.active {
		color: var(--text);
		background: var(--bg-elev);
	}
	.tab.active::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--accent);
	}
	.tab.dragging {
		opacity: 0.4;
	}
	.tab.drag-over {
		box-shadow: inset 2px 0 0 0 var(--accent);
	}

	.tab-label {
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}

	.tab-rename {
		font: inherit;
		color: var(--text);
		background: var(--bg);
		border: var(--rule-width) solid var(--accent);
		padding: 0 var(--space-xs);
		margin: 0 calc(-1 * var(--space-xs));
		max-width: 180px;
		min-width: 0;
		outline: none;
		user-select: text;
		-webkit-user-select: text;
	}
	.tab-rename.invalid {
		border-color: var(--danger);
	}

	.tab-close {
		border: none;
		background: transparent;
		padding: 0 0 0 var(--space-xs);
		font-size: var(--font-size-sm);
		line-height: 1;
		color: var(--text-dim);
		cursor: pointer;
	}
	.tab-close:hover {
		color: var(--text);
	}
	/* Both glyphs share one slot so swapping them never shifts the tab's width. */
	.tab-close {
		display: inline-grid;
		place-items: center;
	}
	.tab-close > * {
		grid-area: 1 / 1;
		display: inline-flex;
	}
	.unsaved-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-dim);
		visibility: hidden;
	}
	.tab-close.unsaved .unsaved-dot {
		visibility: visible;
	}
	.tab-close.unsaved .close-x {
		visibility: hidden;
	}
	.tab:hover .tab-close.unsaved .unsaved-dot,
	.tab-close.unsaved:focus-visible .unsaved-dot {
		visibility: hidden;
	}
	.tab:hover .tab-close.unsaved .close-x,
	.tab-close.unsaved:focus-visible .close-x {
		visibility: visible;
	}

	.tab-new {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		border: none;
		background: transparent;
		font-size: var(--font-size-lg);
		line-height: 1;
		color: var(--text-dim);
		border-right: var(--rule-width) solid var(--rule);
		cursor: pointer;
		flex-shrink: 0;
	}
	.tab-new:hover {
		color: var(--text);
	}
	.tab-new:disabled {
		color: var(--text-faint);
		cursor: default;
	}

	.cap-warn {
		display: flex;
		align-items: center;
		padding: 0 var(--space-sm);
	}

	.tab-bar-actions {
		display: flex;
		align-items: stretch;
		flex-shrink: 0;
	}
	.tba {
		height: 100%;
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		padding: 0 var(--space-lg);
		background: transparent;
		border: none;
		border-left: var(--rule-width) solid var(--rule);
		color: var(--text-dim);
		font-size: var(--font-size-xs);
		letter-spacing: var(--label-tracking);
		text-transform: uppercase;
		cursor: pointer;
		white-space: nowrap;
	}
	.tba:hover {
		color: var(--text);
		background: var(--bg-elev);
	}
	.tba:disabled {
		color: var(--text-faint);
		cursor: default;
	}
	.tba:disabled:hover {
		color: var(--text-faint);
		background: transparent;
	}
	.tba .kbd {
		color: var(--text-dim);
		font-size: var(--font-size-xs);
		letter-spacing: 0;
	}
	.tba.on {
		color: var(--text);
		background: var(--bg-elev);
	}
</style>
