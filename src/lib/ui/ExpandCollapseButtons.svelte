<script lang="ts">
	import Icon from './Icon.svelte';
	import { FoldVertical, UnfoldVertical } from '@lucide/svelte';

	/** Expand all / Collapse all, shared by the tree view, the graph view and the outline panel. */
	interface Props {
		onExpandAll: () => void;
		onCollapseAll: () => void;
		expandDisabled?: boolean;
		/** Why Expand all is limited or unavailable; shown on hover, even while disabled. */
		expandTitle?: string;
		/** Expand all is still loading. */
		expanding?: boolean;
	}

	let {
		onExpandAll,
		onCollapseAll,
		expandDisabled = false,
		expandTitle = 'Expand every level',
		expanding = false,
	}: Props = $props();
</script>

<!-- A disabled button shows no tooltip, so the wrapper carries it. -->
<span class="tip" title={expandTitle}>
	<button class="action" onclick={onExpandAll} disabled={expandDisabled || expanding}
		><Icon icon={UnfoldVertical} size="xs" /> {expanding ? 'Expanding…' : 'Expand all'}</button
	>
</span>
<button class="action" onclick={onCollapseAll}
	><Icon icon={FoldVertical} size="xs" /> Collapse all</button
>

<style>
	.tip {
		display: inline-flex;
	}
	.action {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		background: transparent;
		border: none;
		padding: 0;
		font-size: var(--font-size-xs);
		letter-spacing: 0.06em;
		color: var(--text-dim);
		cursor: pointer;
		white-space: nowrap;
	}
	.action:hover {
		color: var(--text);
	}
	.action:disabled {
		color: var(--text-faint);
		cursor: default;
	}
</style>
