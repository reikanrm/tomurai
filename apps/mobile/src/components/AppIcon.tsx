import React from 'react';
import {
  Book, BoxIso, ChatBubbleEmpty, Check, CoffeeCup, Community, EditPencil,
  EmojiPuzzled, EmojiQuite, EmojiSad, EmojiSatisfied, Heart, HomeSimple,
  JournalPage, TaskList, Walking, Wind,
} from 'iconoir-react-native';
import { colors as c } from '../theme';

// Static named imports keep the approved icon set explicit and tree-shakeable.
const icons = {
  Book, BoxIso, ChatBubbleEmpty, Check, CoffeeCup, Community, EditPencil,
  EmojiPuzzled, EmojiQuite, EmojiSad, EmojiSatisfied, Heart, HomeSimple,
  JournalPage, TaskList, Walking, Wind,
};
export type AppIconName = keyof typeof icons;

/** Decorative: the adjacent text/button owns the accessible name and state. */
export function AppIcon({ name, size = 24, color = c.ink, strokeWidth = 1.5 }: {
  name: AppIconName; size?: number; color?: string; strokeWidth?: number;
}) {
  const Icon = icons[name];
  return <Icon width={size} height={size} color={color} strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round"
    accessible={false} aria-hidden focusable={false} pointerEvents="none"
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ flexShrink: 0 }} />;
}
