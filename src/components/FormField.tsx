import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { radius, spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';

interface Props extends ComponentProps<typeof TextInput> {
  label: string;
  error?: string;
  suffix?: string;
}

export function FormField({ label, error, suffix, style, ...inputProps }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputShell, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border }]}>
        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          style={[styles.input, { color: colors.text }, style]}
        />
        {suffix ? <Text style={[styles.suffix, { color: colors.textMuted }]}>{suffix}</Text> : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600' },
  inputShell: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 50, paddingHorizontal: spacing.md, fontSize: 16 },
  suffix: { paddingRight: spacing.md, fontSize: 15, fontWeight: '600' },
  error: { fontSize: 13, lineHeight: 18 },
});
