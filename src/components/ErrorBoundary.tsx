import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { logSafeError } from '@/src/services/errors';

interface State { failed: boolean }

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { logSafeError('ui-boundary', { message: error.message, componentStack: info.componentStack }); }
  render() {
    if (this.state.failed) {
      return <View style={styles.root}><Text style={styles.title}>SpendSpeak needs a restart</Text><Text style={styles.message}>Your local data is safe. Close and reopen the app to continue.</Text></View>;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F7F5EF' }, title: { fontSize: 22, fontWeight: '700', color: '#17201C' }, message: { marginTop: 12, textAlign: 'center', color: '#65716B', lineHeight: 21 } });
