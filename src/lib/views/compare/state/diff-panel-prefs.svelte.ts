import { untrack } from 'svelte';
import { SETTINGS_FILE } from '$lib/util/persist';
import { boolField, definePrefs, intField } from '$lib/util/prefs.svelte';

export const MIN_HEIGHT = 64;
export const MAX_HEIGHT = 800;
export const DEFAULT_HEIGHT = 200;

const store = definePrefs({
	file: SETTINGS_FILE,
	key: 'diffPanel',
	schema: {
		visible: boolField(true),
		height: intField(DEFAULT_HEIGHT, MIN_HEIGHT, MAX_HEIGHT),
	},
});

/** How many mounted compares currently offer the panel; drives the View menu item. */
let offeredBy = $state(0);

const methods = {
	toggleVisible: () => void store.set('visible', !store.visible),
	setHeight: (h: number) => void store.set('height', h),
	setHeightLive: (h: number): boolean => store.stage({ height: h }),
	commitHeight: () => void store.persistNow(),

	/** Marks the panel as available until the returned function is called. */
	offer: (): (() => void) => {
		// Called from effects: untracked so the caller doesn't come to depend on the count.
		untrack(() => offeredBy++);
		let done = false;
		return () => {
			if (done) return;
			done = true;
			untrack(() => offeredBy--);
		};
	},
};

export const diffPanelPrefs: typeof store & typeof methods & { available: boolean } =
	Object.defineProperty(Object.assign(store, methods), 'available', {
		get: () => offeredBy > 0,
		enumerable: true,
	}) as typeof store & typeof methods & { available: boolean };
