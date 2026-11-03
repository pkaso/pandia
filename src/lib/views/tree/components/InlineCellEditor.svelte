<script lang="ts">
	import type { ContentRow } from '../logic/model';
	import { autofocusSelect, autogrowArea } from '$lib/ui/focus';
	import Icon from '$lib/ui/Icon.svelte';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import {
		createEditHandlers,
		editedKind,
		editWidth,
		nextNumberValue,
	} from '../logic/edit-handlers';

	let {
		buffer,
		field,
		kind,
		onInput,
		onCommit,
		onCancel,
	}: {
		buffer: string;
		field: 'key' | 'value';
		kind: ContentRow['kind'];
		onInput: (value: string) => void;
		onCommit: () => void;
		onCancel: () => void;
	} = $props();

	const { onAreaKeydown, commitBool, onBoolFocusOut, onNumberKeydown, onEditKeydown } =
		createEditHandlers({
			onCommit: () => onCommit(),
			onCancel: () => onCancel(),
			onInput: (v) => onInput(v),
			buffer: () => buffer,
		});

	// The text takes the colour of what it will be saved as: a number field turns string-coloured
	// once its text stops being a number, and so on.
	const savedAs = $derived(editedKind(kind, buffer));

	// Shift+Enter in a number, bool or null field adds a line break, which makes the value a string:
	// the field becomes the multi-line string editor, caret just after the break.
	let textCaret: number | null = $state(null);
	let switching = false; // the one-line field going away mustn't count as leaving the editor
	function shiftEnterToText(e: KeyboardEvent): boolean {
		if (e.key !== 'Enter' || !e.shiftKey || e.isComposing) return false;
		e.preventDefault();
		e.stopPropagation();
		const el = e.currentTarget as HTMLInputElement;
		const from = el.selectionStart ?? buffer.length;
		const to = el.selectionEnd ?? from;
		switching = true;
		onInput(buffer.slice(0, from) + '\n' + buffer.slice(to));
		textCaret = from + 1;
		return true;
	}
	function onFieldBlur() {
		if (!switching) onCommit();
	}
	const valueClass = $derived(
		savedAs === 'string'
			? 'string'
			: savedAs === 'json'
				? buffer.trim() === 'null'
					? 'null'
					: 'json'
				: savedAs,
	);
</script>

{#if field === 'key'}
	<input
		data-inline-editor
		class="edit-input k-input"
		value={buffer}
		style:width={editWidth(buffer)}
		use:autofocusSelect
		oninput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
		onkeydown={onEditKeydown}
		onblur={onCommit}
		spellcheck="false"
		autocomplete="off"
	/>
{:else if kind === 'string' || textCaret !== null}
	<span class="str-edit" data-inline-editor>
		<textarea
			class="edit-area"
			rows="1"
			value={buffer}
			use:autogrowArea={{ caret: textCaret ?? undefined }}
			oninput={(e) => onInput((e.currentTarget as HTMLTextAreaElement).value)}
			onkeydown={onAreaKeydown}
			onblur={onCommit}
			spellcheck="false"
		></textarea>
	</span>
{:else if kind === 'bool'}
	<!-- Typed like any value; anything other than true/false is saved as a string. -->
	<span
		class="bool-edit"
		data-inline-editor
		onfocusout={(e) => {
			if (!switching) onBoolFocusOut(e);
		}}
	>
		<input
			class="edit-input v-input {valueClass}"
			value={buffer}
			style:width={editWidth(buffer)}
			use:autofocusSelect
			oninput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
			onkeydown={(e) => shiftEnterToText(e) || onEditKeydown(e)}
			spellcheck="false"
			autocomplete="off"
			aria-label="boolean value"
		/>
		<span class="bool-seg" role="group" aria-label="set to">
			<button
				class="opt"
				class:active={buffer.trim() === 'true'}
				tabindex="-1"
				onmousedown={(e) => {
					e.preventDefault();
					commitBool('true');
				}}>true</button
			>
			<button
				class="opt"
				class:active={buffer.trim() === 'false'}
				tabindex="-1"
				onmousedown={(e) => {
					e.preventDefault();
					commitBool('false');
				}}>false</button
			>
		</span>
	</span>
{:else if kind === 'number'}
	<span class="num-edit" data-inline-editor>
		<input
			class="edit-input v-input num-input {valueClass}"
			value={buffer}
			style:width={editWidth(buffer)}
			use:autofocusSelect
			oninput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
			onkeydown={(e) => shiftEnterToText(e) || onNumberKeydown(e)}
			onblur={onFieldBlur}
			spellcheck="false"
			autocomplete="off"
		/>
		<span class="step">
			<button
				class="arrow"
				onmousedown={(e) => {
					e.preventDefault();
					onInput(nextNumberValue(buffer, e.shiftKey ? 10 : 1));
				}}><Icon icon={ChevronUp} size="xs" /></button
			>
			<button
				class="arrow"
				onmousedown={(e) => {
					e.preventDefault();
					onInput(nextNumberValue(buffer, e.shiftKey ? -10 : -1));
				}}><Icon icon={ChevronDown} size="xs" /></button
			>
		</span>
	</span>
{:else}
	<input
		data-inline-editor
		class="edit-input v-input {valueClass}"
		value={buffer}
		style:width={editWidth(buffer)}
		use:autofocusSelect
		oninput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
		onkeydown={(e) => shiftEnterToText(e) || onEditKeydown(e)}
		onblur={onFieldBlur}
		spellcheck="false"
		autocomplete="off"
	/>
{/if}

<style>
	/* Every editor is exactly one row line (18px) tall and its text starts where the plain text was:
	   the side padding is pulled back by an equal negative margin. Nothing about the row moves when
	   editing starts; the edit background and caret show the field. */
	.edit-input,
	.edit-area,
	.bool-seg,
	.num-edit {
		box-sizing: border-box;
		height: 18px;
		background: var(--bg-edit);
		flex-shrink: 0;
	}
	.edit-input,
	.edit-area {
		margin: 0 calc(-1 * var(--space-xs));
	}
	.num-edit,
	.str-edit {
		margin: 0 calc(-1 * var(--space-xs));
	}
	.num-edit .num-input,
	.str-edit .edit-area {
		margin: 0;
	}

	.edit-input {
		font: inherit;
		font-size: var(--font-size-base);
		line-height: 18px;
		letter-spacing: inherit; /* form fields don't inherit it; the text must match the plain text */
		color: var(--text);
		border: none;
		padding: 0 var(--space-xs);
		outline: none;
		width: auto;
		caret-color: var(--accent);
	}
	.edit-input.k-input {
		color: var(--syntax-key);
	}
	.edit-input.v-input.string {
		color: var(--syntax-string);
	}
	.edit-input.v-input.number {
		color: var(--syntax-number);
	}
	.edit-input.v-input.bool {
		color: var(--syntax-boolean);
	}
	.edit-input.v-input.null {
		color: var(--syntax-null);
		font-style: italic;
	}
	.edit-input.v-input.json {
		color: var(--text);
	}

	/* A string grows only when its text wraps or has line breaks. */
	.str-edit {
		flex: 1;
		min-width: 0;
		display: flex;
	}
	.edit-area {
		width: 100%;
		min-height: 18px;
		resize: none;
		overflow: hidden;
		font: inherit;
		font-size: var(--font-size-base);
		line-height: 18px;
		letter-spacing: inherit;
		color: var(--syntax-string);
		border: none;
		padding: 0 var(--space-xs);
		outline: none;
		caret-color: var(--accent);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.bool-edit {
		display: inline-flex;
		align-items: stretch;
		gap: var(--space-xs);
		flex-shrink: 0;
	}
	.bool-seg {
		display: inline-flex;
		align-items: stretch;
	}
	.bool-seg .opt {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0 var(--space-md);
		background: transparent;
		border: none;
		border-right: 1px solid var(--rule-2);
		color: var(--text-dim);
		font: inherit;
		font-size: var(--font-size-base);
		line-height: 18px;
		cursor: pointer;
	}
	.bool-seg .opt:last-child {
		border-right: none;
	}
	.bool-seg .opt:hover:not(.active) {
		color: var(--text);
	}
	.bool-seg .opt.active {
		background: var(--accent-fill);
		color: var(--syntax-boolean);
	}

	.num-edit {
		display: inline-flex;
		align-items: stretch;
	}
	.num-edit .num-input {
		height: 100%;
		background: transparent;
	}
	.num-edit .step {
		display: inline-flex;
		flex-direction: column;
		border-left: 1px solid var(--rule-2);
		width: 14px;
	}
	.num-edit .step .arrow {
		flex: 1 1 0;
		min-height: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: transparent;
		border: none;
		color: var(--text-dim);
		line-height: 1;
		cursor: pointer;
		padding: 0;
	}
	.num-edit .step .arrow :global(svg) {
		width: 9px;
		height: 9px;
	}
	.num-edit .step .arrow:hover {
		color: var(--text);
		background: var(--bg-elev-3);
	}
	.num-edit .step .arrow + .arrow {
		border-top: 1px solid var(--rule-2);
	}
</style>
