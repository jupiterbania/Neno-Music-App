/**
 * Unified share utility.
 *
 * Tries:
 * 1. Android Media Bridge (native Android share sheet with all apps)
 * 2. Web Share API (navigator.share)
 * 3. Clipboard fallback (navigator.clipboard.writeText)
 *
 * Returns { shared: boolean, copied: boolean }
 */
export type ShareOptions = {
  title?: string;
  text?: string;
  url: string;
};

export async function shareContent(options: ShareOptions): Promise<{ shared: boolean; copied: boolean }> {
  const { title = "", text = "", url } = options;

  // 1. Android native bridge (Tauri Android WebView)
  const androidBridge = typeof window !== "undefined" && (window as any).AndroidMediaBridge;
  if (androidBridge && typeof androidBridge.shareText === "function") {
    try {
      androidBridge.shareText(title, text, url);
      return { shared: true, copied: false };
    } catch {
      // Fall through if bridge invocation fails
    }
  }

  // 2. Web Share API (Mobile Browsers / WebViews with share support)
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: title || undefined,
        text: text || undefined,
        url: url || undefined,
      });
      return { shared: true, copied: false };
    } catch (err: any) {
      // User cancelled/dismissed share sheet
      if (err?.name === "AbortError") {
        return { shared: true, copied: false };
      }
      // If permission denied or unsupported, fall through to clipboard
    }
  }

  // 3. Fallback: Copy to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { shared: false, copied: true };
    } catch {
      return { shared: false, copied: false };
    }
  }

  return { shared: false, copied: false };
}
