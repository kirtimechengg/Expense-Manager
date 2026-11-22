import { useColorScheme } from 'react-native';

import { useData } from '@/state/data';
import { palette, type ThemeColors } from './colors';

export * from './colors';

/** Returns the colour set for the current theme (respects the user's Light/Dark/System choice). */
export function useTheme(): { colors: ThemeColors; dark: boolean } {
  const system = useColorScheme();
  const { prefs } = useData();
  const dark = prefs.theme === 'system' ? system === 'dark' : prefs.theme === 'dark';
  return { colors: dark ? palette.dark : palette.light, dark };
}
