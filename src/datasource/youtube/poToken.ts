/**
 * Proof-of-Origin tokens for googlevideo media URLs.
 *
 * Since August 2024 a signed URL minted by a web client is only served to a request whose
 * session can prove it came from a real browser. Without a PO token googlevideo grants a short
 * grace and then answers 403 — which is exactly the observed shape of the download bug: the
 * first track saved, every one after it was refused at *both* request styles, so no header
 * combination could have fixed it.
 *
 * BotGuard is not bypassed here; it is satisfied. It probes `window`, `document`, `navigator`
 * and friends, and a shimmed environment fails those checks — which is why this lives in the
 * frontend. The WebView is a real browser, so the VM runs natively, and `bgutils-js` was already
 * a dependency. The Rust alternative (rustypipe-botguard) would have embedded V8 + JSDOM to
 * simulate the browser this app already is.
 */

import { BotGuardClient, getChallenge } from "bgutils-js/botguard";
import { WebPoMinter } from "bgutils-js/webpo";
import { buildURL, getHeaders } from "bgutils-js/utils";
import type { WebPoSignalOutput } from "bgutils-js/shared-types";

import { logInternalInfo, logInternalWarn } from "../../internal/logging";
import { tauriFetch } from "./tauriFetch";
import { isAndroid } from "../../ui/platform";

/** YouTube's BotGuard request key. Constant across clients; not a secret. */
const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";

/** Used when the integrity response omits a TTL. Google's own default is 12 hours. */
const FALLBACK_TTL_SECONDS = 12 * 60 * 60;

/** Re-attest this long before expiry so a token never dies mid-download. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

type CachedMinter = { minter: WebPoMinter; expiresAt: number };

let cached: Promise<CachedMinter> | null = null;
let lastWorkingMinter: WebPoMinter | null = null;

/*
 * On Android WebView, cross-origin POST requests to Google RPC endpoints are blocked by CORS.
 * We use tauriFetch (native reqwest proxy via Tauri IPC) on Android or whenever globalThis.fetch fails.
 */
const attestationFetch: typeof fetch = async (input, init) => {
  if (isAndroid) {
    return tauriFetch(input, init as any);
  }
  try {
    const res = await globalThis.fetch(input, init);
    if (res.ok) return res;
  } catch {
    // Desktop CORS or network issue: fall back to tauriFetch
  }
  return tauriFetch(input, init as any);
};

async function attest(): Promise<CachedMinter> {
  const challenge = await getChallenge({ requestKey: REQUEST_KEY, fetchFunction: attestationFetch });

  const interpreterJavascript =
    challenge.interpreterJavascript?.privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (!interpreterJavascript) {
    throw new Error("BotGuard challenge carried no interpreter script.");
  }

  /*
   * Injected as a real <script> rather than run through `new Function`, because the VM registers
   * itself on `window` under `challenge.globalName` and expects document scope. Tauri's CSP is
   * null, so this is allowed. Keyed by interpreterHash so a re-attest reuses the loaded VM.
   */
  const interpreterId = challenge.interpreterHash ?? "botguard-interpreter";
  if (!document.getElementById(interpreterId)) {
    const script = document.createElement("script");
    script.id = interpreterId;
    script.type = "text/javascript";
    script.textContent = interpreterJavascript;
    document.head.appendChild(script);
  }

  const botguard = await BotGuardClient.create({
    globalName: challenge.globalName,
    globalObject: window,
    program: challenge.program,
  });

  // Populated as a side effect of the snapshot; the minter is one of the functions it collects.
  const webPoSignalOutput: WebPoSignalOutput = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });

  const response = await attestationFetch(buildURL("GenerateIT"), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify([REQUEST_KEY, botguardResponse]),
  });
  if (!response.ok) {
    throw new Error(`Integrity token request returned HTTP ${response.status}.`);
  }

  const [integrityToken, estimatedTtlSecs, , websafeFallbackToken] = (await response.json()) as [
    string?,
    number?,
    number?,
    string?,
  ];
  /*
   * A fallback token is what Google returns when it does not trust the runtime. It mints tokens
   * that look entirely normal and are then rejected downstream, so its presence is the
   * difference between "attested" and "politely declined".
   */
  logInternalInfo("poToken.integrity issued", {
    hasToken: Boolean(integrityToken),
    fallbackPresent: Boolean(websafeFallbackToken),
    ttlSeconds: estimatedTtlSecs ?? null,
  });
  if (!integrityToken) {
    throw new Error("Integrity token response contained no token.");
  }

  const minter = await WebPoMinter.create({ integrityToken }, webPoSignalOutput);
  lastWorkingMinter = minter;
  const ttlMs = (estimatedTtlSecs ?? FALLBACK_TTL_SECONDS) * 1000;
  const expiresAt = Date.now() + Math.max(ttlMs - REFRESH_MARGIN_MS, 0);

  // Proactively refresh before expiry so user requests never hit a cold attestation
  const refreshInMs = Math.max(10_000, expiresAt - Date.now() - 60_000);
  if (typeof window !== "undefined") {
    setTimeout(() => {
      cached = null;
      warmPoToken();
    }, refreshInMs);
  }

  logInternalInfo("poToken.attest succeeded", { ttlSeconds: estimatedTtlSecs ?? FALLBACK_TTL_SECONDS });
  return { minter, expiresAt };
}

function getMinter(): Promise<CachedMinter> {
  if (!cached) {
    cached = attest().catch((error) => {
      cached = null; // A failed attestation must not be cached, or the app never recovers.
      throw error;
    });
  }
  return cached;
}

/**
 * Runs the BotGuard challenge ahead of the first play, off the critical path.
 *
 * `attest()` is the ~3s half of first-play latency — a fixed Google-side cost, paid once and
 * cached for `getMinter`'s TTL regardless of when it runs. Calling this while the app is
 * otherwise idle (after the library loads) means the first `mintPoToken` call finds the minter
 * already warm instead of blocking playback on it. Errors are swallowed: a failed pre-attest
 * just leaves `mintPoToken` to try again, exactly as if this had never been called.
 */
export function warmPoToken(): void {
  void getMinter().catch((error) => {
    logInternalWarn("poToken.warm failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

// Eagerly pre-warm on load so the first song click is instant
if (typeof window !== "undefined") {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(() => warmPoToken(), { timeout: 2000 });
  } else {
    setTimeout(() => warmPoToken(), 800);
  }
}

/**
 * Mints a PO token bound to `contentBinding` — a visitor ID for session tokens, a video ID for
 * per-content ones.
 *
 * Returns undefined rather than throwing: attestation is a hardening step, and a broken BotGuard
 * (Google rotates it) must degrade to the pre-PO-token behaviour instead of taking playback down.
 */
export async function mintPoToken(contentBinding: string): Promise<string | undefined> {
  if (!contentBinding) return undefined;

  try {
    const entryPromise = (async () => {
      let entry = await getMinter();
      if (Date.now() >= entry.expiresAt) {
        cached = null;
        entry = await getMinter();
      }
      return entry;
    })();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("PO token attestation timed out")), 6000),
    );
    const entry = await Promise.race([entryPromise, timeoutPromise]);
    return await entry.minter.mintAsWebsafeString(contentBinding);
  } catch (error) {
    if (lastWorkingMinter) {
      try {
        const fallbackToken = await lastWorkingMinter.mintAsWebsafeString(contentBinding);
        if (fallbackToken) {
          logInternalInfo("poToken.mint recovered using last working minter", { contentBinding });
          return fallbackToken;
        }
      } catch {
        // Ignore fallback error
      }
    }
    logInternalWarn("poToken.mint failed, continuing without one", {
      message: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
