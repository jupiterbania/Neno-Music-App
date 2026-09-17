import { useSyncExternalStore } from "react";

/**
 * Target language for lyric translation, or "off".
 *
 * Off by default and off is a real value, not an absence: translation goes out to a
 * third-party endpoint with the words of whatever is playing, so it happens because someone
 * asked for it rather than because nobody changed a setting.
 */
const STORAGE_KEY = "lyrics-translation-lang";
const CHANGE_EVENT = "lyrics-translation-change";

export const TRANSLATION_OFF = "off";

/** Codes the endpoint accepts; includes popular Indian, Asian, and global languages. */
export const TRANSLATION_LANGUAGES = [
  "hi", // Hindi
  "en", // English
  "bn", // Bengali
  "pa", // Punjabi
  "mr", // Marathi
  "gu", // Gujarati
  "ta", // Tamil
  "te", // Telugu
  "kn", // Kannada
  "ml", // Malayalam
  "ur", // Urdu
  "ne", // Nepali
  "es", // Spanish
  "fr", // French
  "de", // German
  "it", // Italian
  "pt", // Portuguese
  "ru", // Russian
  "tr", // Turkish
  "ar", // Arabic
  "ja", // Japanese
  "ko", // Korean
  "zh-CN", // Chinese
  "id", // Indonesian
  "vi", // Vietnamese
  "th", // Thai
  "pl", // Polish
  "nl", // Dutch
  "sv", // Swedish
];

const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi (हिन्दी)",
  en: "English",
  bn: "Bengali (বাংলা)",
  pa: "Punjabi (ਪੰਜਾਬੀ)",
  mr: "Marathi (मराठी)",
  gu: "Gujarati (ગુજરાતી)",
  ta: "Tamil (தமிழ்)",
  te: "Telugu (తెలుగు)",
  kn: "Kannada (ಕನ್ನಡ)",
  ml: "Malayalam (മലയാളം)",
  ur: "Urdu (اردو)",
  ne: "Nepali (नेपाली)",
  es: "Spanish (Español)",
  fr: "French (Français)",
  de: "German (Deutsch)",
  it: "Italian (Italiano)",
  pt: "Portuguese (Português)",
  ru: "Russian (Русский)",
  tr: "Turkish (Türkçe)",
  ar: "Arabic (العربية)",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
  "zh-CN": "Chinese (中文)",
  id: "Indonesian (Bahasa)",
  vi: "Vietnamese (Tiếng Việt)",
  th: "Thai (ไทย)",
  pl: "Polish (Polski)",
  nl: "Dutch (Nederlands)",
  sv: "Swedish (Svenska)",
};

/**
 * Native label with English name for instant clarity across all locales.
 */
export function getLanguageLabel(code: string): string {
  if (NATIVE_LANGUAGE_NAMES[code]) return NATIVE_LANGUAGE_NAMES[code];
  try {
    return new Intl.DisplayNames(undefined, { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function getLyricsTranslationLang(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || TRANSLATION_OFF;
  } catch {
    return TRANSLATION_OFF;
  }
}

export function setLyricsTranslationLang(lang: string): void {
  try {
    if (lang === TRANSLATION_OFF) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Quota or a locked profile: the choice still applies for this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  // Not optional in a multi-window app: without it the other window never sees the change.
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useLyricsTranslationLang(): string {
  return useSyncExternalStore(subscribe, getLyricsTranslationLang, () => TRANSLATION_OFF);
}
