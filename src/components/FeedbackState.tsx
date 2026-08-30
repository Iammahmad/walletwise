import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';

interface Props {
  kind: 'loading' | 'empty' | 'error' | 'offline';
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function FeedbackState({ kind, title, message, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const defaults = {
    loading: ['Loading', 'Getting everything ready.'],
    empty: ['Nothing here yet', 'Your entries will appear here.'],
    error: ['Could not load this', 'Please try again.'],
    offline: ['You are offline', 'Local features still work. Cloud changes will sync later.'],
  }[kind];
  return (
    <View style={styles.container} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      {kind === 'loading' ? <ActivityIndicator size="large" color={colors.primary} /> : <Ionicons name={kind === 'error' ? 'alert-circle-outline' : kind === 'offline' ? 'cloud-offline-outline' : 'leaf-outline'} size={32} color={kind === 'error' ? colors.danger : colors.primary} />}
      <Text style={[styles.title, { color: colors.text }]}>{title ?? defaults[0]}</Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>{message ?? defaults[1]}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
});
