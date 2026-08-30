import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';

interface ScreenProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  scroll?: boolean;
  testID?: string;
}

export function Screen({ title, subtitle, action, children, scroll = true, testID }: ScreenProps) {
  const { colors } = useTheme();
  const content = (
    <View style={styles.content} testID={testID}>
      {(title || action) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title ? <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
          </View>
          {action}
        </View>
      )}
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{content}</ScrollView>
        ) : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xs },
  headerText: { flex: 1, paddingRight: spacing.md },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: spacing.xs },
});
