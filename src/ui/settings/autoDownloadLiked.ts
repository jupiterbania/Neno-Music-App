import { useSyncExternalStore } from "react";
import {
  hydrateLocalBooleanSetting,
  readLocalBooleanSetting,
  writeLocalBooleanSetting,
} from "../../internal/durableLocalSetting";

const STORAGE_KEY = "auto-download-liked-enabled";
const CHANGE_EVENT = "auto-download-liked-change";

let cached: boolean | null = null;

export function readAutoDownloadLikedEnabled(): boolean {
  if (cached === null) {
    cached = readLocalBooleanSetting(STORAGE_KEY, false);
  }
  return cached;
}

function invalidate() {
  cached = null;
}

if (typeof window !== "undefined") {
  window.addEventListener(CHANGE_EVENT, invalidate);
  window.addEventListener("storage", invalidate);
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export async function hydrateAutoDownloadLiked(): Promise<void> {
  await hydrateLocalBooleanSetting(STORAGE_KEY, false, CHANGE_EVENT);
  invalidate();
}

export function setAutoDownloadLikedEnabled(enabled: boolean): void {
  cached = enabled;
  writeLocalBooleanSetting(STORAGE_KEY, enabled, CHANGE_EVENT);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAutoDownloadLikedEnabled(): boolean {
  return useSyncExternalStore(subscribe, readAutoDownloadLikedEnabled, () => false);
}
