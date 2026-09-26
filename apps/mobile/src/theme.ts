import { Platform } from 'react-native';

// PO mobile HTML: preserve paper, forest green, thin rules and restrained warmth.
export const colors = {
  paper: '#F5F3ED', paperDeep: '#EFEBE1', ink: '#232922', green: '#2B5545',
  greenSoft: '#6E8B7C', line: '#DCD8CC', muted: '#5C5850', white: '#FFFFFF',
  warm: '#8B6F4E', warmPaper: '#F4EDE3', warmLine: '#E3D5C2',
};
export const font = Platform.select({
  web: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif",
  ios: 'Hiragino Sans', android: 'sans-serif', default: undefined,
});
