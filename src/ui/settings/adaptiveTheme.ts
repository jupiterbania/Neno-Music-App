import { useSyncExternalStore } from "react";
import {
  hydrateLocalBooleanSetting,
  readLocalBooleanSetting,
  writeLocalBooleanSetting,
} from "../../internal/durableLocalSetting";

const STORAGE_KEY = "adaptive-theme-enabled";
const CHANGE_EVENT = "adaptive-theme-change";

let cached: boolean | null = null;

export function readAdaptiveThemeEnabled(): boolean {
  if (cached === null) {
    cached = readLocalBooleanSetting(STORAGE_KEY, true);
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

export function applyAdaptiveTheme(enabled = readAdaptiveThemeEnabled()): void {
  if (typeof document === "undefined") return;
  document.documentElement.toggleAttribute("data-adaptive-theme", enabled);
}

export async function hydrateAdaptiveTheme(): Promise<void> {
  await hydrateLocalBooleanSetting(STORAGE_KEY, true, CHANGE_EVENT, applyAdaptiveTheme);
  invalidate();
}

export function setAdaptiveThemeEnabled(enabled: boolean): void {
  cached = enabled;
  writeLocalBooleanSetting(STORAGE_KEY, enabled, CHANGE_EVENT);
  applyAdaptiveTheme(enabled);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useAdaptiveThemeEnabled(): boolean {
  return useSyncExternalStore(subscribe, readAdaptiveThemeEnabled, () => true);
}
