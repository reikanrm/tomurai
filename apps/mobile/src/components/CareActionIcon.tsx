import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export type CareActionIconName = 'tea' | 'breath' | 'message' | 'move' | 'write';

// TOM-59: verbatim geometry from index.html MOOD_ICONS. Do not substitute
// the navigation icon set or infer a care action from a selected mood.
const artwork: Record<CareActionIconName, React.ReactNode> = {
  tea: [
    <Path key="cup" d="M10 18 h16 v7 a8 8 0 01-8 8h0 a8 8 0 01-8-8z" stroke="#8B6F4E" strokeWidth="1.5" fill="none" strokeLinejoin="round" />,
    <Path key="handle" d="M26 20 q5 0 5 4.5 t-5 4.5" stroke="#8B6F4E" strokeWidth="1.3" fill="none" />,
    <Path key="steam-left" d="M14 10 q2.5 3 0 5.5" stroke="#8B6F4E" strokeWidth="1.1" fill="none" opacity="0.55" />,
    <Path key="steam-right" d="M19 9 q2.5 3 0 5.5" stroke="#8B6F4E" strokeWidth="1.1" fill="none" opacity="0.55" />,
  ],
  breath: [
    <Circle key="inner" cx="20" cy="20" r="4" stroke="#8B6F4E" strokeWidth="1.4" fill="none" />,
    <Circle key="middle" cx="20" cy="20" r="9.5" stroke="#8B6F4E" strokeWidth="1.2" fill="none" opacity="0.55" />,
    <Circle key="outer" cx="20" cy="20" r="15" stroke="#8B6F4E" strokeWidth="1" fill="none" opacity="0.3" />,
  ],
  message: <Path d="M9 12h22a2 2 0 012 2v10a2 2 0 01-2 2H18l-6 5v-5h-3a2 2 0 01-2-2V14a2 2 0 012-2z" stroke="#8B6F4E" strokeWidth="1.4" fill="none" strokeLinejoin="round" />,
  move: [
    <Circle key="head" cx="20" cy="9" r="3" stroke="#8B6F4E" strokeWidth="1.4" fill="none" />,
    <Path key="body" d="M20 13 v9 M20 15 L12 10 M20 15 L28 10 M20 22 L14 32 M20 22 L26 32" stroke="#8B6F4E" strokeWidth="1.4" strokeLinecap="round" fill="none" />,
  ],
  write: <Path d="M11 29 L25.5 14.5 a2.2 2.2 0 013.1 3.1L14 32l-5 1z" stroke="#8B6F4E" strokeWidth="1.4" fill="none" strokeLinejoin="round" />,
};

/** Decorative only: the adjacent action text supplies the accessible name. */
export function CareActionIcon({ name }: { name: CareActionIconName }) {
  return <Svg width="40" height="40" viewBox="0 0 40 40" fill="none"
    accessible={false} aria-hidden focusable={false} style={{ flexShrink: 0 }}>
    {artwork[name]}
  </Svg>;
}
