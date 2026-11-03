import { loadPersisted, savePersisted, TABS_FILE } from '$lib/util/persist';
import { isObject } from '$lib/util/guards';

const STORE_KEY = 'open-tabs';

/**
 * One tab of a saved session. A saved file has just its `path`; an edited file keeps its `path` and
 * the id of its stashed content; a document with no file (pasted, fetched) has a `name` and content.
 */
export interface SessionTab {
	path?: string;
	name?: string;
	/** Id of the content stashed on quit (`ipc.docSessionStash`). */
	contentId?: string;
}

export interface SessionTabs {
	tabs: SessionTab[];
	activeIndex: number;
}

function sanitizeTab(raw: unknown): SessionTab | null {
	if (!isObject(raw)) return null;
	const tab: SessionTab = {};
	if (typeof raw.path === 'string' && raw.path) tab.path = raw.path;
	if (typeof raw.name === 'string' && raw.name) tab.name = raw.name;
	if (typeof raw.contentId === 'string' && raw.contentId) tab.contentId = raw.contentId;
	return tab.path || tab.contentId ? tab : null;
}

function sanitize(raw: unknown): SessionTabs {
	const fallback: SessionTabs = { tabs: [], activeIndex: -1 };
	if (!isObject(raw)) return fallback;
	const tabs: SessionTab[] = Array.isArray(raw.tabs)
		? raw.tabs.map(sanitizeTab).filter((t): t is SessionTab => t !== null)
		: // Saved before unsaved tabs were restored: a list of file paths.
			Array.isArray(raw.paths)
			? raw.paths.filter((p): p is string => typeof p === 'string').map((path) => ({ path }))
			: [];
	let activeIndex = typeof raw.activeIndex === 'number' ? Math.floor(raw.activeIndex) : -1;
	if (activeIndex < -1 || activeIndex >= tabs.length) activeIndex = -1;
	return { tabs, activeIndex };
}

export async function loadOpenTabs(): Promise<SessionTabs> {
	return sanitize(await loadPersisted<unknown>(TABS_FILE, STORE_KEY));
}

export async function saveOpenTabs(tabs: SessionTab[], activeIndex: number): Promise<void> {
	const safeIndex = activeIndex >= 0 && activeIndex < tabs.length ? activeIndex : -1;
	await savePersisted(TABS_FILE, STORE_KEY, {
		tabs,
		activeIndex: safeIndex,
	} satisfies SessionTabs);
}
