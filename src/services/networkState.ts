interface ReachabilityState {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}

export function isNetworkOnline(state: ReachabilityState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export function isConnectivityTransition(
  previous: boolean | null,
  next: boolean,
): boolean {
  return previous === null || previous !== next;
}
