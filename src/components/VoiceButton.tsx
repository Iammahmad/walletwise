import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { VoiceState } from '@/src/domain/types';
import { radius, spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';

interface Props {
  state?: VoiceState;
  onPress: () => void;
  label?: string;
  disabled?: boolean;
}

export function VoiceButton({ state = 'idle', onPress, label = 'Add with voice', disabled = false }: Props) {
  const { colors } = useTheme();
  const listening = state === 'listening';
  const description = listening
    ? 'Microphone listening. Tap to stop.'
    : disabled
      ? `${label}. Microphone control is temporarily unavailable.`
      : `${label}. Microphone is ready.`;
  return (
    <View style={styles.wrapper}>
      {listening ? <View style={[styles.pulse, { backgroundColor: colors.primarySoft }]} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={description}
        accessibilityState={{ disabled, busy: disabled }}
        disabled={disabled}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          onPress();
        }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary, opacity: disabled ? 0.5 : pressed ? 0.84 : 1 },
        ]}
      >
        <Ionicons name={listening ? 'stop' : 'mic'} color={colors.white} size={30} />
      </Pressable>
      <Text style={[styles.label, { color: colors.text }]}>{listening ? 'Listening…' : label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  button: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  pulse: {
    position: 'absolute',
    top: 3,
    width: 86,
    height: 86,
    borderRadius: radius.pill,
    opacity: 0.8,
  },
  label: { fontSize: 14, fontWeight: '600' },
});
