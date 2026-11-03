<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { ask } from '@tauri-apps/plugin-dialog';
	import Dialog from '$lib/ui/Dialog.svelte';
	import { ipc } from '$lib/ipc/client';
	import { describeError } from '$lib/ipc/error-copy';
	import type { DocHandle, Path } from '$lib/ipc/bindings';
	import type { PaneView, TabSlot } from '$lib/shell/state/workspace.svelte';
	import { pathToString } from '$lib/util/path';
	import { nestedEditors } from '../state/nested-editors.svelte';
	import DocPane from './DocPane.svelte';

	/**
	 * Edits one array or object in a document of its own (every view, action and inline edit the
	 * main editor has). Nothing reaches the main document until Apply, which writes it back as a
	 * single, undoable change.
	 */
	interface Props {
		handle: DocHandle;
		path: Path;
		kind: 'array' | 'object';
		/** Depth of the pane this was opened from; the editor inside sits one level above it. */
		depth: number;
		onApply: (text: string) => Promise<boolean>;
		onClose: () => void;
	}

	let { handle, path, kind, depth, onApply, onClose }: Props = $props();

	let text: string | null = $state(null);
	let loadError: string | null = $state(null);
	let applying = $state(false);
	let pane: PaneView | null = $state.raw(null);

	const tabId = `nested-${untrack(() => depth) + 1}-${crypto.randomUUID()}`;
	const name = $derived(path.length === 0 ? 'document' : pathToString(path));
	const slot = {
		tabId,
		handoff: null,
		register(view: PaneView) {
			pane = view;
			return () => {
				if (pane === view) pane = null;
			};
		},
		isHandleAlive: () => false,
		versionOf: () => null,
		resolveUnsaved: async () => true,
	} as unknown as TabSlot;

	onMount(() => {
		const release = nestedEditors.push(depth + 1);
		ipc
			.docGetValue(handle, path)
			.then((t) => (text = t))
			.catch((e) => (loadError = describeError(e)));
		return release;
	});

	async function apply() {
		if (!pane || applying) return;
		applying = true;
		try {
			if (!(await (pane.flush?.() ?? Promise.resolve(true)))) return; // the pane shows why
			const h = pane.context?.handle;
			if (h == null) return;
			if (await onApply(await ipc.docGetValue(h, []))) onClose();
		} catch (e) {
			loadError = describeError(e);
		} finally {
			applying = false;
		}
	}

	async function cancel() {
		if (pane?.status?.dirty) {
			const discard = await ask('Discard the changes you made here?', {
				title: 'Unapplied changes',
				kind: 'warning',
				okLabel: 'Discard',
				cancelLabel: 'Keep editing',
			}).catch(() => true);
			if (!discard) return;
		}
		onClose();
	}
</script>

<Dialog onClose={() => void cancel()}>
	<div
		class="nested"
		role="dialog"
		aria-modal="true"
		aria-label={`Edit ${kind} ${name}`}
		data-testid="nested-editor"
	>
		<header class="head">
			<span class="title">Edit {kind}</span>
			<span class="path" title={name}>{name}</span>
		</header>
		<div class="body">
			{#if loadError}
				<div class="state err">{loadError}</div>
			{:else if text === null}
				<div class="state dim">Loading…</div>
			{:else}
				<DocPane
					{tabId}
					{slot}
					isActive
					depth={depth + 1}
					pendingOpen={{ kind: 'text', text, name: `${name}.json` }}
				/>
			{/if}
		</div>
		<footer class="foot">
			<span class="hint dim">Changes reach the document only when you apply them.</span>
			<button class="btn" onclick={() => void cancel()}>Cancel</button>
			<button
				class="btn btn-primary"
				onclick={() => void apply()}
				disabled={!pane?.context || applying}>{applying ? 'Applying…' : 'Apply'}</button
			>
		</footer>
	</div>
</Dialog>

<style>
	.nested {
		display: flex;
		flex-direction: column;
		width: min(1100px, 92vw);
		height: min(760px, 86vh);
		background: var(--bg);
		border: var(--rule-width) solid var(--rule-2);
		box-shadow: var(--shadow-modal);
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: var(--space-md);
		padding: var(--space-sm) var(--space-lg);
		border-bottom: var(--rule-width) solid var(--rule);
		background: var(--bg-elev);
		flex-shrink: 0;
		min-width: 0;
	}
	.title {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--label-tracking);
		color: var(--text-dim);
		flex-shrink: 0;
	}
	.path {
		color: var(--accent);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.body {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		position: relative;
	}
	.state {
		padding: var(--space-lg);
		font-size: var(--font-size-sm);
	}
	.err {
		color: var(--danger);
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-lg);
		border-top: var(--rule-width) solid var(--rule);
		background: var(--bg-elev);
		flex-shrink: 0;
	}
	.hint {
		margin-right: auto;
		font-size: var(--font-size-xs);
	}
</style>
