import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth },
});
