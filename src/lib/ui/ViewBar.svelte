<script lang="ts">
	import type { Snippet } from 'svelte';

	/** The header bar above a document view: content on the left, actions on the right. */
	interface Props {
		label: string;
		children?: Snippet;
		actions?: Snippet;
		/** Where the actions sit; a narrow panel keeps them by its left edge. */
		actionsAlign?: 'left' | 'right';
	}

	let { label, children, actions, actionsAlign = 'right' }: Props = $props();
</script>

<div class="view-bar" role="toolbar" aria-label={label}>
	{#if actions && actionsAlign === 'left'}<div class="actions">{@render actions()}</div>{/if}
	{@render children?.()}
	<div class="grow"></div>
	{#if actions && actionsAlign === 'right'}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
	.view-bar {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		height: 28px;
		padding: 0 var(--space-lg);
		background: var(--bg);
		border-bottom: var(--rule-width) solid var(--rule);
		font-size: var(--font-size-sm);
		color: var(--text-dim);
		flex-shrink: 0;
		min-width: 0;
	}
	.grow {
		flex: 1 1 auto;
		min-width: 0;
	}
	.actions {
		display: flex;
		gap: var(--space-md);
		flex-shrink: 0;
		align-items: center;
		color: var(--text-faint);
	}
</style>
