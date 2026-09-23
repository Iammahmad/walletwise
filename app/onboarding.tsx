import { Ionicons } from '@expo/vector-icons';
import { getCalendars, getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/Button';
import { Card } from '@/src/components/Card';
import { Screen } from '@/src/components/Screen';
import { SelectionSheet } from '@/src/components/SelectionSheet';
import { updateProfile } from '@/src/db/repository';
import { SUPPORTED_CURRENCIES } from '@/src/domain/money';
import { normalizeError } from '@/src/services/errors';
import { spacing } from '@/src/design/tokens';
import { useTheme } from '@/src/design/ThemeProvider';
import { useAppStore } from '@/src/state/appStore';

const TIMEZONES = ['Asia/Karachi', 'UTC', 'Asia/Dubai', 'Asia/Kolkata', 'Europe/London', 'America/New_York'];
const LOCALES = ['en-PK', 'en-US', 'en-GB', 'en-IN', 'en-AE'];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const profile = useAppStore((state) => state.profile);
  const setProfile = useAppStore((state) => state.setProfile);
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState(profile?.defaultCurrency ?? getLocales()[0]?.currencyCode ?? 'USD');
  const [locale, setLocale] = useState(profile?.locale ?? getLocales()[0]?.languageTag ?? 'en-US');
  const [timezone, setTimezone] = useState(profile?.timezone ?? getCalendars()[0]?.timeZone ?? 'UTC');
  const [sheet, setSheet] = useState<'currency' | 'locale' | 'timezone' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (openAuth = false) => {
    setSaving(true);
    try {
      setError(null);
      const next = await updateProfile({ defaultCurrency: currency, locale, timezone, onboardingCompleted: true });
      setProfile(next);
      if (openAuth) router.replace('/auth'); else router.replace('/(tabs)');
    } catch (caught) {
      setError(normalizeError(caught).message);
    } finally { setSaving(false); }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.progress}>{[0, 1, 2].map((item) => <View key={item} style={[styles.dot, { backgroundColor: item <= step ? colors.primary : colors.border }]} />)}</View>
      {step === 0 ? (
        <View style={styles.hero}>
          <View style={[styles.logo, { backgroundColor: colors.primarySoft }]}><Ionicons name="mic" size={38} color={colors.primary} /></View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Money tracking that listens.</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>Record spending in seconds by typing or speaking. Your ledger lives on this device first, and you decide if it ever goes to the cloud.</Text>
          <Card><Feature icon="phone-portrait-outline" title="Works without an account" text="Manual entries and standard voice parsing stay available offline." /><Feature icon="shield-checkmark-outline" title="Private by design" text="No audio recordings are stored, and voice drafts always require review." /></Card>
          <Button label="Get started" onPress={() => setStep(1)} />
        </View>
      ) : null}
      {step === 1 ? (
        <View style={styles.hero}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Make it yours</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>These defaults control formatting and date interpretation. You can change them later.</Text>
          <Choice label="Default currency" value={currency} onPress={() => setSheet('currency')} />
          <Choice label="Locale" value={locale} onPress={() => setSheet('locale')} />
          <Choice label="Timezone" value={timezone} onPress={() => setSheet('timezone')} />
          <Button label="Continue" onPress={() => setStep(2)} />
          <Button label="Back" variant="ghost" onPress={() => setStep(0)} />
        </View>
      ) : null}
      {step === 2 ? (
        <View style={styles.hero}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Local first. Cloud optional.</Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>Cash, Bank, and your starter categories are ready. Continue privately on this device, or sign in to enable Firebase backup and device synchronization.</Text>
          <Card><Feature icon="cloud-offline-outline" title="Local-only mode" text="Nothing depends on signing in. You can enable backup later in Settings." /><Feature icon="sparkles-outline" title="Optional cloud AI" text="AI parsing is off by default and only works after sign-in. Deterministic parsing runs first." /></Card>
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
          <Button label="Continue without an account" onPress={() => void finish()} loading={saving} />
          <Button label="Sign in for backup" variant="secondary" onPress={() => void finish(true)} disabled={saving} />
          <Button label="Back" variant="ghost" onPress={() => setStep(1)} />
        </View>
      ) : null}
      <SelectionSheet visible={sheet === 'currency'} title="Default currency" selected={currency} options={SUPPORTED_CURRENCIES.map((value) => ({ value, label: value }))} onSelect={(value) => { setCurrency(value); setSheet(null); }} onClose={() => setSheet(null)} />
      <SelectionSheet visible={sheet === 'locale'} title="Locale" selected={locale} options={LOCALES.map((value) => ({ value, label: value }))} onSelect={(value) => { setLocale(value); setSheet(null); }} onClose={() => setSheet(null)} />
      <SelectionSheet visible={sheet === 'timezone'} title="Timezone" selected={timezone} options={[...new Set([timezone, ...TIMEZONES])].map((value) => ({ value, label: value }))} onSelect={(value) => { setTimezone(value); setSheet(null); }} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function Feature({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  const { colors } = useTheme();
  return <View style={styles.feature}><Ionicons name={icon} size={22} color={colors.primary} /><View style={styles.featureText}><Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.featureBody, { color: colors.textMuted }]}>{text}</Text></View></View>;
}

function Choice({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Card><Text style={[styles.choiceLabel, { color: colors.textMuted }]}>{label}</Text><Text onPress={onPress} accessibilityRole="button" style={[styles.choiceValue, { color: colors.text }]}>{value}  <Ionicons name="chevron-down" size={16} color={colors.primary} /></Text></Card>;
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: spacing.md },
  dot: { width: 30, height: 4, borderRadius: 4 },
  hero: { flex: 1, justifyContent: 'center', gap: spacing.md },
  logo: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.8 },
  body: { fontSize: 17, lineHeight: 25 },
  feature: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700' },
  featureBody: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  choiceLabel: { fontSize: 12, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.6 },
  choiceValue: { fontSize: 17, fontWeight: '600', marginTop: spacing.xs, paddingVertical: spacing.xs },
});
