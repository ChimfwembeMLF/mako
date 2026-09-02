import React from 'react';
import { View, type ViewProps } from 'react-native';
import { AppShellGate } from '../context/AppShellChromeContext';

type Props = ViewProps & {
  children: React.ReactNode;
  /** Hide workspace header (e.g. auth screens) */
  hideHeader?: boolean;
};

/** Standard tab screen wrapper with workspace switcher header */
export function TabShell({ children, hideHeader, style, ...rest }: Props) {
  return (
    <AppShellGate hideHeader={hideHeader}>
      <View style={[{ flex: 1 }, style]} {...rest}>
        {children}
      </View>
    </AppShellGate>
  );
}
