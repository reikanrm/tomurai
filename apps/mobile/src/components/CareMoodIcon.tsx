import React from 'react';
import type { CareMoodId } from '../data/care';
import { AppIcon, type AppIconName } from './AppIcon';

const icons: Record<CareMoodId, AppIconName> = {
  calm: 'EmojiSatisfied',
  tearful: 'EmojiSad',
  unsettled: 'EmojiPuzzled',
  nothing: 'EmojiQuite',
  remember: 'Heart',
};

export function CareMoodIcon({ mood }: { mood: CareMoodId }) {
  return <AppIcon name={icons[mood]} size={28} />;
}
