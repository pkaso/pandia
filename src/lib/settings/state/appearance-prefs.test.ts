// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { loadPersisted } from '$lib/util/persist';
import { appearancePrefs } from './appearance-prefs.svelte';

vi.mock('$lib/util/persist', () => ({
	SETTINGS_FILE: 'settings.json',
	loadPersisted: vi.fn(),
	savePersisted: vi.fn(async () => {}),
}));

describe('appearancePrefs', () => {
	it('drops a custom font and size when imported settings use the defaults', async () => {
		const style = document.documentElement.style;
		vi.mocked(loadPersisted).mockResolvedValue({ fontFamily: 'Fira Code', fontSizeBase: 16 });
		await appearancePrefs.init();
		expect(style.getPropertyValue('--font-mono')).toContain('Fira Code');
		expect(style.getPropertyValue('--font-size-base')).toBe('16px');

		vi.mocked(loadPersisted).mockResolvedValue({ fontFamily: 'IBM Plex Mono', fontSizeBase: 13 });
		await appearancePrefs.reload();
		expect(style.getPropertyValue('--font-mono')).not.toContain('Fira Code');
		expect(style.getPropertyValue('--font-size-base')).not.toBe('16px');
	});

	it('starts on GitHub, following the system', async () => {
		vi.mocked(loadPersisted).mockResolvedValue(undefined);
		await appearancePrefs.reload();
		expect(appearancePrefs.mode).toBe('system');
		appearancePrefs.systemPrefersDark = true;
		expect(appearancePrefs.resolvedTheme.id).toBe('dark-github');
		appearancePrefs.systemPrefersDark = false;
		expect(appearancePrefs.resolvedTheme.id).toBe('light-github');
	});

	it('keeps a dark-only pick in System mode and shows GitHub Light when the system is light', async () => {
		vi.mocked(loadPersisted).mockResolvedValue({ themeId: 'dark-dracula', autoMode: true });
		await appearancePrefs.reload();
		appearancePrefs.systemPrefersDark = true;
		expect(appearancePrefs.resolvedTheme.id).toBe('dark-dracula');
		appearancePrefs.systemPrefersDark = false;
		expect(appearancePrefs.resolvedTheme.id).toBe('light-github');
		expect(appearancePrefs.themeId).toBe('dark-dracula');
	});

	it('switches mode within the family, falling back to GitHub when it lacks the scheme', async () => {
		vi.mocked(loadPersisted).mockResolvedValue({ themeId: 'dark-solarized', autoMode: false });
		await appearancePrefs.reload();
		expect(appearancePrefs.mode).toBe('dark');
		await appearancePrefs.setMode('light');
		expect(appearancePrefs.themeId).toBe('light-solarized');

		await appearancePrefs.setTheme('dark-nord');
		await appearancePrefs.setMode('light');
		expect(appearancePrefs.themeId).toBe('light-github');
		await appearancePrefs.setMode('dark');
		expect(appearancePrefs.themeId).toBe('dark-github');
		await appearancePrefs.setMode('system');
		expect(appearancePrefs.mode).toBe('system');
	});
});
