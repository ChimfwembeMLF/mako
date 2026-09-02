import React from 'react';
import { View, type ViewProps } from 'react-native';
import { AppShellHeader } from './AppShellHeader';
import { useTheme } from '../context/ThemeContext';

type Props = ViewProps & {
  children: React.ReactNode;
  /** Hide workspace header (e.g. auth screens) */
  hideHeader?: boolean;
};

/** Standard tab screen wrapper with workspace switcher header */
export function TabShell({ children, hideHeader, style, ...rest }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[{ flex: 1, backgroundColor: colors['canvas-soft'] }, style]} {...rest}>
      {!hideHeader ? <AppShellHeader /> : null}
      {children}
    </View>
  );
}
