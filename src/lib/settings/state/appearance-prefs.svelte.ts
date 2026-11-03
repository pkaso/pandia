import { loadPersisted, savePersisted, SETTINGS_FILE } from '$lib/util/persist';
import { PersistedStore } from '$lib/util/persisted-store.svelte';
import { isObject, oneOf } from '$lib/util/guards';
import {
	applyDensity,
	applyFontFamily,
	applyFontSizeBase,
	applyTheme,
	resetAppearance,
	THEMES,
	FALLBACK_THEMES,
	themeForScheme,
	type Density,
	type Theme,
} from '$lib/shell/logic/theme';

export type ThemeMode = 'system' | 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const STORE_KEY = 'appearance';

const DEFAULT_THEME_ID = FALLBACK_THEMES.dark.id;
const DEFAULT_AUTO_MODE = true;
const DEFAULT_MONO = 'IBM Plex Mono';
const DEFAULT_FONT_SIZE = 13;
const DEFAULT_DENSITY: Density = 'normal';

export const FONT_SIZE_MIN = 11;
export const FONT_SIZE_MAX = 18;

function clampFontSize(px: number): number {
	return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, Math.round(px * 10) / 10));
}

interface Persisted {
	/** The picked theme; in System mode only its family matters. */
	themeId: string;
	/** System mode: follow the OS dark/light preference within themeId's family. */
	autoMode: boolean;
	fontFamily: string;
	fontSizeBase: number;
	density: Density;
}

const VALID_DENSITY: Density[] = ['compact', 'normal', 'comfortable'];

function sanitize(raw: unknown): Persisted {
	const fallback: Persisted = {
		themeId: DEFAULT_THEME_ID,
		autoMode: DEFAULT_AUTO_MODE,
		fontFamily: DEFAULT_MONO,
		fontSizeBase: DEFAULT_FONT_SIZE,
		density: DEFAULT_DENSITY,
	};
	if (!isObject(raw)) return fallback;
	const r = raw;
	return {
		themeId: typeof r.themeId === 'string' && r.themeId in THEMES ? r.themeId : DEFAULT_THEME_ID,
		autoMode: typeof r.autoMode === 'boolean' ? r.autoMode : DEFAULT_AUTO_MODE,
		fontFamily:
			typeof r.fontFamily === 'string' && r.fontFamily.trim() ? r.fontFamily.trim() : DEFAULT_MONO,
		fontSizeBase:
			typeof r.fontSizeBase === 'number' && Number.isFinite(r.fontSizeBase)
				? clampFontSize(r.fontSizeBase)
				: DEFAULT_FONT_SIZE,
		density: oneOf(r.density, VALID_DENSITY) ? r.density : DEFAULT_DENSITY,
	};
}

class AppearancePrefs extends PersistedStore {
	themeId: string = $state(DEFAULT_THEME_ID);
	autoMode: boolean = $state(DEFAULT_AUTO_MODE);

	systemPrefersDark: boolean = $state(true);
	fontFamily: string = $state(DEFAULT_MONO);
	fontSizeBase: number = $state(DEFAULT_FONT_SIZE);
	density: Density = $state(DEFAULT_DENSITY);

	private mediaBound = false;

	async init(): Promise<void> {
		if (!this.loaded) {
			this.bindSystemTheme();
			this.applyResolved();
		}
		await super.init();
	}

	protected async load(): Promise<void> {
		try {
			const raw = await loadPersisted<Persisted>(SETTINGS_FILE, STORE_KEY);
			const p = sanitize(raw);
			this.themeId = p.themeId;
			this.autoMode = p.autoMode;
			this.fontFamily = p.fontFamily;
			this.fontSizeBase = p.fontSizeBase;
			this.density = p.density;
		} catch {}
	}

	protected onReady(): void {
		this.bindSystemTheme();
		this.applyAll();
	}

	private bindSystemTheme(): void {
		if (this.mediaBound || typeof window === 'undefined' || !window.matchMedia) return;
		this.mediaBound = true;
		const mq = window.matchMedia(DARK_QUERY);
		this.systemPrefersDark = mq.matches;
		mq.addEventListener('change', (e) => {
			this.systemPrefersDark = e.matches;
			if (this.autoMode) this.applyResolved();
		});
	}

	get mode(): ThemeMode {
		if (this.autoMode) return 'system';
		return THEMES[this.themeId]?.colorScheme ?? 'dark';
	}

	/** The theme on screen: in System mode, themeId's family member for the OS scheme, else GitHub's. */
	get resolvedTheme(): Theme {
		if (this.autoMode) {
			return themeForScheme(this.themeId, this.systemPrefersDark ? 'dark' : 'light');
		}
		return THEMES[this.themeId] ?? FALLBACK_THEMES.dark;
	}

	private applyResolved(): void {
		applyTheme(this.resolvedTheme);
	}

	private applyAll(): void {
		this.applyResolved();
		applyDensity(this.density);
		applyFontFamily({ mono: this.fontFamily });
		applyFontSizeBase(this.fontSizeBase);
	}

	private async persist(): Promise<void> {
		await savePersisted(SETTINGS_FILE, STORE_KEY, {
			themeId: this.themeId,
			autoMode: this.autoMode,
			fontFamily: this.fontFamily,
			fontSizeBase: this.fontSizeBase,
			density: this.density,
		} satisfies Persisted);
	}

	async setTheme(id: string): Promise<void> {
		const theme = THEMES[id];
		if (!theme) return;
		if (!this.autoMode && this.themeId === id) return;
		this.autoMode = false;
		this.themeId = id;
		applyTheme(theme);
		await this.persist();
	}

	async setAuto(idInFamily: string): Promise<void> {
		if (!THEMES[idInFamily]) return;
		if (this.autoMode && this.themeId === idInFamily) return;
		this.autoMode = true;
		this.themeId = idInFamily;
		this.applyResolved();
		await this.persist();
	}

	/** Switches mode, staying in the current family; a family without that scheme falls back to GitHub. */
	async setMode(next: ThemeMode): Promise<void> {
		if (this.mode === next) return;
		if (next === 'system') return this.setAuto(this.themeId);
		return this.setTheme(themeForScheme(this.themeId, next).id);
	}

	async setFontFamily(family: string): Promise<void> {
		const trimmed = family.trim();
		if (!trimmed || trimmed === this.fontFamily) return;
		this.fontFamily = trimmed;
		applyFontFamily({ mono: trimmed });
		await this.persist();
	}

	async setFontSize(px: number): Promise<void> {
		const clamped = clampFontSize(px);
		if (clamped === this.fontSizeBase) return;
		this.fontSizeBase = clamped;
		applyFontSizeBase(clamped);
		await this.persist();
	}

	async setDensity(d: Density): Promise<void> {
		if (this.density === d) return;
		this.density = d;
		applyDensity(d);
		await this.persist();
	}

	async reset(): Promise<void> {
		this.themeId = DEFAULT_THEME_ID;
		this.autoMode = DEFAULT_AUTO_MODE;
		this.fontFamily = DEFAULT_MONO;
		this.fontSizeBase = DEFAULT_FONT_SIZE;
		this.density = DEFAULT_DENSITY;
		resetAppearance();
		this.applyResolved();
		await this.persist();
	}
}

export const appearancePrefs = new AppearancePrefs();
