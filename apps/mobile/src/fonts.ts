import type { FontSource } from 'expo-font';
import { fonts } from './theme';

// Static, unmodified Noto Sans JP faces bundled for native and web alike.
// The app waits for useFonts(bundledNotoFonts) before displaying the UI.
export const bundledNotoFonts = {
  [fonts.light]: require('../assets/fonts/NotoSansJP_300Light.ttf'),
  [fonts.regular]: require('../assets/fonts/NotoSansJP_400Regular.ttf'),
  [fonts.medium]: require('../assets/fonts/NotoSansJP_500Medium.ttf'),
  [fonts.bold]: require('../assets/fonts/NotoSansJP_700Bold.ttf'),
} satisfies Record<string, FontSource>;
