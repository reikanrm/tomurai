import type { ReactNode } from 'react';
import { View } from 'react-native';

export function ModalBackground({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return <View style={{ flex: 1 }} accessibilityElementsHidden={hidden}
    importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>{children}</View>;
}
