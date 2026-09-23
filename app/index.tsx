import { Redirect } from 'expo-router';

import { FeedbackState } from '@/src/components/FeedbackState';
import { Screen } from '@/src/components/Screen';
import { useAppStore } from '@/src/state/appStore';

export default function Index() {
  const initialized = useAppStore((state) => state.initialized);
  const error = useAppStore((state) => state.initializationError);
  const profile = useAppStore((state) => state.profile);
  if (error) return <Screen><FeedbackState kind="error" title="Local database unavailable" message={error} /></Screen>;
  if (!initialized || !profile) return <Screen><FeedbackState kind="loading" title="Opening WalletWise" message="Preparing your private local ledger." /></Screen>;
  return <Redirect href={profile.onboardingCompleted ? '/(tabs)' : '/onboarding'} />;
}
