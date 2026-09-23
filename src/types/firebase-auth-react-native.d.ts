import "firebase/auth";
import type { Persistence } from "firebase/auth";

declare module "firebase/auth" {
  interface ReactNativeStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }

  export function getReactNativePersistence(
    storage: ReactNativeStorage,
  ): Persistence;
}
