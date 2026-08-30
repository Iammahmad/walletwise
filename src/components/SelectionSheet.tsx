import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';

export interface SelectionOption { value: string; label: string; detail?: string }

interface Props {
  visible: boolean;
  title: string;
  options: SelectionOption[];
  selected?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function SelectionSheet({ visible, title, options, selected, onSelect, onClose }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close selection" style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={onClose}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          </View>
          <ScrollView>
            {options.map((option) => (
              <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected === option.value }} onPress={() => onSelect(option.value)} style={[styles.option, { borderBottomColor: colors.border }]}>
                <View style={styles.optionText}>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                  {option.detail ? <Text style={[styles.detail, { color: colors.textMuted }]}>{option.detail}</Text> : null}
                </View>
                {selected === option.value ? <Ionicons name="checkmark-circle" size={24} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '72%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontSize: 20, fontWeight: '700' },
  option: { minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  detail: { fontSize: 13, marginTop: 2 },
});
