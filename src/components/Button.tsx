import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { radius, spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, accessibilityHint, testID }: ButtonProps) {
  const { colors } = useTheme();
  const background = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.dangerSoft : variant === 'ghost' ? 'transparent' : colors.surfaceMuted;
  const foreground = variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.base, { backgroundColor: background, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.82 : 1 }, variant !== 'ghost' && variant !== 'primary' ? styles.border : null]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : icon ? <Ionicons name={icon} size={20} color={foreground} /> : null}
      <Text style={[styles.label, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.xs },
  border: { borderWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 16, fontWeight: '600' },
});
