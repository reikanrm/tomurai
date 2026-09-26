import type { ReactNode } from 'react';

// Keep the page mounted, but remove its controls from focus and accessibility
// while the React Native Web Modal renders in its separate portal.
export function ModalBackground({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return <div inert={hidden} aria-hidden={hidden}
    style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>{children}</div>;
}
