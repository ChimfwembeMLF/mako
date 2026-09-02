import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { fonts, rounded, spacing, typography } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Sheet({ visible, onClose, title, children, contentStyle }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.canvas,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
            contentStyle,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          {title ? (
            <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.displaySemi }]}>
              {title}
            </Text>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type SheetRowProps = {
  label: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  right?: React.ReactNode;
};

export function SheetRow({ label, subtitle, selected, onPress, right }: SheetRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: selected ? colors['primary-pale'] : 'transparent',
          borderColor: colors.border,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.ink, fontFamily: fonts.bodySemi }]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.mute, fontFamily: fonts.body }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(14, 15, 12, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: rounded.xl,
    borderTopRightRadius: rounded.xl,
    maxHeight: '80%',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.displayXs,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: rounded.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  rowLabel: {
    ...typography.bodyMdStrong,
  },
  rowSub: {
    ...typography.bodySm,
    marginTop: spacing.xxs,
  },
});
