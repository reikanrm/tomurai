import React from 'react';
import { AppIcon, type AppIconName } from './AppIcon';

export type CareActionIconName = 'tea' | 'breath' | 'message' | 'move' | 'write';

const icons: Record<CareActionIconName, AppIconName> = {
  tea: 'CoffeeCup', breath: 'Wind', message: 'ChatBubbleEmpty',
  move: 'Walking', write: 'EditPencil',
};

/** TOM-68 replaces the artwork, not the available actions or their behaviour. */
export function CareActionIcon({ name }: { name: CareActionIconName }) {
  return <AppIcon name={icons[name]} size={26} />;
}
