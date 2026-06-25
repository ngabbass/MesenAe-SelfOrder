import { useEffect } from 'react';
import { useDbQuery, dbUpdate, type StoreSettings } from '@/hooks/db-hooks';
import { db } from '@/lib/db';

// Predefined theme color options with HSL values
export const THEME_COLORS = [
  { name: 'Oranye', hue: '25', saturation: '95%', lightness: '53%' },
  { name: 'Biru', hue: '217', saturation: '91%', lightness: '60%' },
  { name: 'Hijau', hue: '142', saturation: '71%', lightness: '45%' },
  { name: 'Ungu', hue: '262', saturation: '83%', lightness: '58%' },
  { name: 'Merah', hue: '0', saturation: '84%', lightness: '60%' },
  { name: 'Pink', hue: '330', saturation: '81%', lightness: '60%' },
  { name: 'Teal', hue: '172', saturation: '66%', lightness: '50%' },
  { name: 'Kuning', hue: '45', saturation: '93%', lightness: '47%' },
] as const;

export function getThemeHSL(hue: string) {
  const preset = THEME_COLORS.find(c => c.hue === hue);
  if (preset) return `${preset.hue} ${preset.saturation} ${preset.lightness}`;
  return `${hue} 91% 60%`;
}

export function applyThemeColor(hue: string) {
  const hsl = getThemeHSL(hue);
  document.documentElement.style.setProperty('--primary', hsl);
  document.documentElement.style.setProperty('--ring', hsl);
  // Update meta theme-color for PWA
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', `hsl(${hsl})`);
}

export function useThemeColor() {
  const storeSettingsList = useDbQuery<StoreSettings>('storeSettings') ?? [];
  const storeSettings = storeSettingsList[0] || null;
  const selfOrderTheme = storeSettings?.selfOrderTheme || 'standar';

  useEffect(() => {
    // Only apply the default blue '217' if the theme is 'standar'
    if (selfOrderTheme === 'standar') {
      applyThemeColor('217');
    } else {
      // Clear inline primary/ring colors so that the theme's own CSS variables take effect
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--ring');
    }
  }, [selfOrderTheme]);

  return '217';
}

export async function setThemeColor(hue: string) {
  applyThemeColor(hue);
  const { data: settings } = await db.from('store_settings').select('*').single();
  if (settings?.id) {
    await dbUpdate('store_settings', settings.id, { themeColor: hue });
  }
}
