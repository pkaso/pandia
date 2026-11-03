<script lang="ts">
	import type { Path, PathSegment } from '$lib/ipc/bindings';
	import Icon from '$lib/ui/Icon.svelte';
	import { ChevronRight } from '@lucide/svelte';
	import ViewBar from '$lib/ui/ViewBar.svelte';
	import ExpandCollapseButtons from '$lib/ui/ExpandCollapseButtons.svelte';

	interface Props {
		path: Path | null;
		onSegment: (depth: number) => void;
		onExpandAll: () => void;
		onCollapseAll: () => void;
		expandAllDisabled: boolean;
		expandAllTitle: string;
		editing?: boolean;
	}

	let {
		path,
		onSegment,
		onExpandAll,
		onCollapseAll,
		expandAllDisabled,
		expandAllTitle,
		editing = false,
	}: Props = $props();

	function renderSeg(seg: PathSegment): string {
		if (typeof seg === 'number') return `[${seg}]`;
		return String(seg);
	}
</script>

<ViewBar label="tree">
	{#if editing}<span class="editing-dot" title="Editing" aria-label="Editing"></span>{/if}
	<span class="toggle" aria-hidden="true"><Icon icon={ChevronRight} size="xs" /></span>
	<div class="path">
		<button
			class="seg crumb root"
			class:last={!path || path.length === 0}
			onclick={() => onSegment(-1)}>$</button
		>
		{#if path}
			{#each path as seg, i (i)}
				<span class="sep" aria-hidden="true"><Icon icon={ChevronRight} size="xs" /></span>
				<button
					class="seg crumb"
					class:idx={typeof seg === 'number'}
					class:last={i === path.length - 1}
					onclick={() => onSegment(i)}>{renderSeg(seg)}</button
				>
			{/each}
		{/if}
	</div>
	{#snippet actions()}
		<ExpandCollapseButtons
			{onExpandAll}
			{onCollapseAll}
			expandDisabled={expandAllDisabled}
			expandTitle={expandAllTitle}
		/>
	{/snippet}
</ViewBar>

<style>
	.toggle {
		color: var(--text-faint);
		flex-shrink: 0;
	}

	.editing-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		background: var(--accent);
		flex-shrink: 0;
		animation: bc-pulse 1.4s ease-in-out infinite;
	}
	@keyframes bc-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.35;
		}
	}

	.path {
		display: flex;
		gap: var(--space-2xs);
		align-items: center;
		min-width: 0;
		overflow: hidden;
	}

	.seg {
		background: transparent;
		border: none;
		padding: 0 var(--space-2xs);
		color: var(--text);
		cursor: pointer;
		font: inherit;
		font-size: var(--font-size-sm);
	}
	.seg:hover {
		background: var(--bg-elev);
	}
	.seg.idx {
		color: var(--text-dim);
	}
	.seg.idx:not(.last):hover {
		color: var(--text);
	}
	.seg.last {
		color: var(--accent);
	}
	.seg.root.last {
		color: var(--accent);
	}
	.sep {
		color: var(--text-faint);
		padding: 0 var(--space-2xs);
	}
</style>
