/**
 * audioKeepalive.ts
 *
 * Keeps the WebView active in the background on mobile (Android) and desktop.
 *
 * Problem:
 * Neno Music decodes audio natively in Rust (`cpal`/`symphonia`/`rodio`) rather than
 * through an HTML5 `<audio>` element. When the screen locks or the window is minimized,
 * Android OS and Chromium see no active HTML media in the WebView and treat it as an
 * idle background webpage:
 *   1. Timers (`setTimeout`, `setInterval`) are clamped or frozen.
 *   2. IPC calls via `evaluateJavascript` (such as `native-audio-ended`) are queued
 *      and deferred until the app is brought back to the foreground.
 *
 * Solution:
 * By keeping a zero-audibility (volume ~0.001) silent audio loop playing in the WebView
 * whenever playback is active or loading, Chromium and Android's audio subsystem recognize
 * the WebView as an active media session. This prevents renderer suspension and allows
 * `handleTrackEnded` and auto-next transitions to execute seamlessly with zero delay.
 */

import { useEffect, useRef } from "react";
import { usePlayerSelector } from "./playerStore";
import { isAndroidEnvironment } from "./androidMediaBridge";

/**
 * Creates a valid 1-second 8000Hz 8-bit mono silent WAV blob URL.
 */
function createSilentWavUrl(): string {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // "fmt " sub-chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 1, true); // BlockAlign
  view.setUint16(34, 8, true); // BitsPerSample (8-bit)

  // "data" sub-chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples, true); // Subchunk2Size

  // Dither slightly +/- 1 around 128 to prevent Chromium silence detector from suspending audio engine
  const pcmBytes = new Uint8Array(buffer, 44, numSamples);
  for (let i = 0; i < numSamples; i++) {
    pcmBytes[i] = 128 + (i % 2 === 0 ? 1 : -1);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

let sharedAudioElement: HTMLAudioElement | null = null;
let sharedBlobUrl: string | null = null;

function getOrCreateKeepaliveAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;

  if (!sharedAudioElement) {
    try {
      if (!sharedBlobUrl) {
        sharedBlobUrl = createSilentWavUrl();
      }
      const audio = document.createElement("audio");
      audio.src = sharedBlobUrl;
      audio.loop = true;
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("aria-hidden", "true");
      audio.style.display = "none";
      // 0.001 is completely inaudible to human ears, but non-zero so OS/Chromium
      // audio mixer registers an active media track.
      audio.volume = 0.001;
      if (document.body) {
        document.body.appendChild(audio);
      } else {
        document.documentElement?.appendChild(audio);
      }
      sharedAudioElement = audio;
    } catch {
      return null;
    }
  }

  return sharedAudioElement;
}

export function startAudioKeepalive(): void {
  // On Android, MediaPlaybackService runs as a foreground service with PARTIAL_WAKE_LOCK
  // and maintains a WebView keepalive timer. Playing a silent HTML5 <audio> element here
  // causes Android AudioManager focus collisions that interrupt active playback.
  if (isAndroidEnvironment()) return;

  try {
    const audio = getOrCreateKeepaliveAudio();
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => {
        // Ignored: will auto-resume on first user interaction
      });
    }
  } catch {
    // Ignored safely
  }
}

export function stopAudioKeepalive(): void {
  try {
    if (sharedAudioElement && !sharedAudioElement.paused) {
      sharedAudioElement.pause();
    }
  } catch {
    // Ignored safely
  }
}

/**
 * React hook mounted once at the app root to keep the WebView message loop
 * alive whenever player status is active.
 */
export function useAudioKeepalive(): void {
  const status = usePlayerSelector((player) => player.status);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const isPlaybackActive = status === "playing" || status === "loading";

    if (isPlaybackActive) {
      startAudioKeepalive();
    } else {
      // 5-second grace period: avoid tearing down audio element on rapid track handovers
      const timer = setTimeout(() => {
        if (statusRef.current !== "playing" && statusRef.current !== "loading") {
          stopAudioKeepalive();
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopAudioKeepalive();
    };
  }, []);
}
