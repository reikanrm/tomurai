// PO mobile HTML: preserve paper, forest green, thin rules and restrained warmth.
export const colors = {
  paper: '#F5F3ED', paperDeep: '#EFEBE1', ink: '#232922', green: '#2B5545',
  greenSoft: '#6E8B7C', line: '#DCD8CC', muted: '#5C5850', white: '#FFFFFF',
  enso: '#000000',
  warm: '#8B6F4E', warmPaper: '#F4EDE3', warmLine: '#E3D5C2',
};
// Use the bundled faces on every platform; select a face instead of synthesizing
// a different weight on top of the Light face. See assets/fonts/README.md.
export const fonts = {
  light: 'NotoSansJP_300Light',
  regular: 'NotoSansJP_400Regular',
  medium: 'NotoSansJP_500Medium',
  bold: 'NotoSansJP_700Bold',
} as const;
export const font = fonts.light;
