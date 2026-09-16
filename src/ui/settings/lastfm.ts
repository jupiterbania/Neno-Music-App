import { useSyncExternalStore } from "react";
import {
  hydrateLocalBooleanSetting,
  readLocalBooleanSetting,
  writeLocalBooleanSetting,
} from "../../internal/durableLocalSetting";

const STORAGE_KEY = "lastfm-scrobbling-enabled";
const CHANGE_EVENT = "lastfm-settings-change";

function readLastFmScrobblingEnabled() {
  return readLocalBooleanSetting(STORAGE_KEY, true);
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function setLastFmScrobblingEnabled(enabled: boolean) {
  writeLocalBooleanSetting(STORAGE_KEY, enabled, CHANGE_EVENT);
}

export async function hydrateLastFmSettings() {
  await hydrateLocalBooleanSetting(STORAGE_KEY, true, CHANGE_EVENT);
}

export function useLastFmScrobblingEnabled() {
  return useSyncExternalStore(subscribe, readLastFmScrobblingEnabled, () => true);
}

const USERNAME_KEY = "lastfm-session-username";

export function readCachedLastFmUsername(): string | null {
  try {
    return localStorage.getItem(USERNAME_KEY);
  } catch {
    return null;
  }
}

export function writeCachedLastFmUsername(username: string | null): void {
  try {
    if (username) {
      localStorage.setItem(USERNAME_KEY, username);
    } else {
      localStorage.removeItem(USERNAME_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}
