<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dismissable } from './dismissable';

	interface Props {
		x: number;
		y: number;

		width?: number;
		height?: number;

		flushAllowance?: number;

		anchorEl?: HTMLElement | null;
		onClose: () => void;

		children: Snippet<[{ flushRight: boolean }]>;
	}

	let {
		x,
		y,
		width = 0,
		height = 0,
		flushAllowance = 0,
		anchorEl = null,
		onClose,
		children,
	}: Props = $props();

	let vw = $state(window.innerWidth);
	let vh = $state(window.innerHeight);

	$effect(() => {
		const onResize = () => {
			vw = window.innerWidth;
			vh = window.innerHeight;
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	// Keep popovers at least this many pixels off the viewport edge so the
	// shadow/rounded corner is fully visible.
	const EDGE_MARGIN_PX = 8;
	// `width`/`height` are estimates for the first frame; once the popover is laid out its real size
	// decides, so content that grows (a longer menu) still stays on screen.
	let measuredW = $state(0);
	let measuredH = $state(0);
	const w = $derived(measuredW || width);
	const h = $derived(measuredH || height);
	const flushRight = $derived(x + w + flushAllowance > vw);
	const style = $derived.by(() => {
		const left = Math.min(x, Math.max(0, vw - w - EDGE_MARGIN_PX));
		const top = Math.min(y, Math.max(0, vh - h - EDGE_MARGIN_PX));
		return `left: ${left}px; top: ${top}px;`;
	});
</script>

<div
	class="popover"
	{style}
	bind:offsetWidth={measuredW}
	bind:offsetHeight={measuredH}
	use:dismissable={{ onDismiss: onClose, ignore: anchorEl }}
>
	{@render children({ flushRight })}
</div>

<style>
	.popover {
		position: fixed;
		z-index: 1000;
	}
</style>
