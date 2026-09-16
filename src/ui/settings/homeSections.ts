import { useSyncExternalStore } from "react";
import {
  hydrateLocalBooleanSetting,
  readLocalBooleanSetting,
  writeLocalBooleanSetting,
} from "../../internal/durableLocalSetting";

/**
 * Which optional sections the home page carries.
 *
 * Visibility only. "Made for you" shares its fetched suggestions with the surprise button and
 * the "More recommendations" strip, so hiding the carousel hides the carousel — it does not
 * stop the recommendations being fetched, and those other two keep working.
 */
const MADE_FOR_YOU_KEY = "home-made-for-you-visible";
const CHANGE_EVENT = "home-sections-change";

/**
 * Whether the YouTube Music personalized home feed shelves are shown on the Home page.
 *
 * Fetched from FEmusic_home — the same feed YouTube Music's own Home tab uses. Requires a
 * signed-in session to be personalized; signed-out users see a generic discovery feed.
 */
const YTM_HOME_FEED_KEY = "home-ytm-feed-visible";

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  // Another window writes the same key.
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function readMadeForYouVisible(): boolean {
  return readLocalBooleanSetting(MADE_FOR_YOU_KEY, true);
}

export function setMadeForYouVisible(visible: boolean) {
  writeLocalBooleanSetting(MADE_FOR_YOU_KEY, visible, CHANGE_EVENT);
}

export function useMadeForYouVisible(): boolean {
  return useSyncExternalStore(subscribe, readMadeForYouVisible, () => true);
}

export function readYtmHomeFeedVisible(): boolean {
  return readLocalBooleanSetting(YTM_HOME_FEED_KEY, true);
}

export function setYtmHomeFeedVisible(visible: boolean) {
  writeLocalBooleanSetting(YTM_HOME_FEED_KEY, visible, CHANGE_EVENT);
}

export function useYtmHomeFeedVisible(): boolean {
  return useSyncExternalStore(subscribe, readYtmHomeFeedVisible, () => true);
}

export async function hydrateHomeSectionSettings() {
  await hydrateLocalBooleanSetting(MADE_FOR_YOU_KEY, true, CHANGE_EVENT);
  await hydrateLocalBooleanSetting(YTM_HOME_FEED_KEY, true, CHANGE_EVENT);
}
