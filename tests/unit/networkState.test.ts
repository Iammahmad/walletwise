import {
  isConnectivityTransition,
  isNetworkOnline,
} from "@/src/services/networkState";

describe("network state deduplication", () => {
  it("does not treat repeated unchanged Android network events as transitions", () => {
    expect(isConnectivityTransition(null, true)).toBe(true);
    expect(isConnectivityTransition(true, true)).toBe(false);
    expect(isConnectivityTransition(false, false)).toBe(false);
  });

  it("detects a real offline-to-online transition for synchronization", () => {
    expect(isConnectivityTransition(false, true)).toBe(true);
    expect(
      isNetworkOnline({ isConnected: true, isInternetReachable: true }),
    ).toBe(true);
    expect(
      isNetworkOnline({ isConnected: true, isInternetReachable: false }),
    ).toBe(false);
    expect(
      isNetworkOnline({ isConnected: false, isInternetReachable: null }),
    ).toBe(false);
  });
});
