/**
 * androidMediaBridge.ts
 *
 * Bridges the React player state to the Android MediaPlaybackService foreground service.
 *
 * On Android, WebViews and background processes are suspended when the screen locks or
 * the app is minimized. The MediaPlaybackService keeps audio playing via a foreground service
 * with PARTIAL_WAKE_LOCK and shows a lock-screen / notification-shade media control card.
 *
 * This module calls window.AndroidMediaBridge directly (exposed via WebView addJavascriptInterface)
 * and falls back to Tauri invoke where available.
 */

import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isAndroid } from "../ui/platform";
import {
  playerController,
  shallowEqual,
  usePlayerSelector,
} from "./playerStore";
import { getArtworkUrlCandidates } from "../datasource/youtube/artwork";
import { useEffect, useRef } from "react";

// Action strings mirrored from MediaPlaybackService.kt companion object
const ACTION_UPDATE = "com.neno.desktop.ACTION_UPDATE";
const ACTION_STOP = "com.neno.desktop.ACTION_STOP";
const BROADCAST_EVENT = "com.neno.desktop.MEDIA_CONTROL";

interface AndroidMediaBridgeInterface {
  updateMedia(
    title: string,
    artist: string,
    isPlaying: boolean,
    artworkUrl?: string | null,
    durationSec?: number,
    positionSec?: number,
  ): void;
  stopMedia(): void;
}

function getAndroidBridge(): AndroidMediaBridgeInterface | null {
  if (
    typeof window !== "undefined" &&
    (window as unknown as { AndroidMediaBridge?: AndroidMediaBridgeInterface }).AndroidMediaBridge
  ) {
    return (window as unknown as { AndroidMediaBridge: AndroidMediaBridgeInterface }).AndroidMediaBridge;
  }
  return null;
}

export function isAndroidEnvironment(): boolean {
  return isAndroid || typeof (window as unknown as { AndroidMediaBridge?: unknown }).AndroidMediaBridge !== "undefined";
}

/**
 * Sends an intent action to the MediaPlaybackService via direct JS interface or Tauri invoke command.
 */
async function sendServiceAction(
  action: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  if (!isAndroidEnvironment()) return;

  const bridge = getAndroidBridge();
  if (bridge) {
    try {
      if (action === ACTION_UPDATE) {
        bridge.updateMedia(
          String(payload?.title ?? "Neno"),
          String(payload?.artist ?? "Playing"),
          Boolean(payload?.isPlaying ?? true),
          payload?.artworkUrl ? String(payload.artworkUrl) : null,
          Math.round(Number(payload?.durationSec ?? 0)),
          Math.round(Number(payload?.positionSec ?? 0)),
        );
        return;
      }
      if (action === ACTION_STOP) {
        bridge.stopMedia();
        return;
      }
    } catch (e) {
      console.warn("[androidMediaBridge] bridge call error:", e);
    }
  }

  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("android_media_service_action", { action, payload: payload ?? {} });
    } catch {
      // ignore
    }
  }
}

async function updateService(
  title: string,
  artist: string,
  isPlaying: boolean,
  artworkUrl?: string | null,
  durationSec?: number,
  positionSec?: number,
): Promise<void> {
  if (!isAndroidEnvironment()) return;
  await sendServiceAction(ACTION_UPDATE, {
    title,
    artist,
    isPlaying,
    artworkUrl: artworkUrl ?? null,
    durationSec: durationSec ?? 0,
    positionSec: positionSec ?? 0,
  });
}

async function stopService(): Promise<void> {
  if (!isAndroidEnvironment()) return;
  await sendServiceAction(ACTION_STOP);
}

/**
 * React hook: mounts once and keeps the Android MediaPlaybackService in sync
 * with the player state for the lifetime of the app.
 */
export function useAndroidMediaBridge(): void {
  const state = usePlayerSelector(
    (player) => ({
      currentTrack: player.currentTrack,
      status: player.status,
    }),
    shallowEqual,
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  // Push player state changes to the Android service
  useEffect(() => {
    if (!isAndroidEnvironment()) return;

    const { currentTrack, status } = stateRef.current;

    if (!currentTrack) {
      void stopService();
      return;
    }

    const isPlaying = status === "playing";
    const duration = Math.round(playerController.getDuration() || currentTrack.durationSec || 0);
    const position = Math.round(playerController.getCurrentTime() || 0);
    const hdArtworkUrl = currentTrack.artworkUrl
      ? (getArtworkUrlCandidates(currentTrack.artworkUrl, 1200)[0] ?? currentTrack.artworkUrl)
      : null;

    void updateService(
      currentTrack.title ?? "Unknown Track",
      currentTrack.artist ?? "Unknown Artist",
      isPlaying,
      hdArtworkUrl,
      duration,
      position,
    );
  }, [state.currentTrack, state.status]);

  // Periodic position sync during playback for notification seekbars
  useEffect(() => {
    if (!isAndroidEnvironment() || state.status !== "playing" || !state.currentTrack) return;

    // Immediate first tick so the notification seekbar does not lag on track start.
    const firstTickId = window.setTimeout(() => {
      const track = stateRef.current.currentTrack;
      if (!track) return;
      const duration = Math.round(playerController.getDuration() || track.durationSec || 0);
      const position = Math.round(playerController.getCurrentTime() || 0);
      const hdArtworkUrl = track.artworkUrl
        ? (getArtworkUrlCandidates(track.artworkUrl, 1200)[0] ?? track.artworkUrl)
        : null;
      void updateService(
        track.title ?? "Unknown Track",
        track.artist ?? "Unknown Artist",
        true,
        hdArtworkUrl,
        duration,
        position,
      );
    }, 500);

    const interval = window.setInterval(() => {
      const track = stateRef.current.currentTrack;
      if (!track) return;
      const duration = Math.round(playerController.getDuration() || track.durationSec || 0);
      const position = Math.round(playerController.getCurrentTime() || 0);
      const hdArtworkUrl = track.artworkUrl
        ? (getArtworkUrlCandidates(track.artworkUrl, 1200)[0] ?? track.artworkUrl)
        : null;
      void updateService(
        track.title ?? "Unknown Track",
        track.artist ?? "Unknown Artist",
        true,
        hdArtworkUrl,
        duration,
        position,
      );
    }, 1000);

    return () => {
      window.clearTimeout(firstTickId);
      window.clearInterval(interval);
    };
  }, [state.currentTrack?.id, state.status]);

  // Listen for media control commands broadcast from the notification bar / MainActivity
  useEffect(() => {
    if (!isAndroidEnvironment()) return;

    const handleCommand = (command: string) => {
      if (command.startsWith("seekTo:")) {
        const sec = parseFloat(command.substring(7));
        if (!isNaN(sec)) {
          void playerController.seekTo(sec);
        }
        return;
      }

      switch (command) {
        case "play":
          void playerController.play().catch((err) => {
            console.warn("[androidMediaBridge] play command failed:", err);
          });
          break;
        case "pause":
          void playerController.pause().catch((err) => {
            console.warn("[androidMediaBridge] pause command failed:", err);
          });
          break;
        case "toggle":
        case "playPause":
          void playerController.togglePlayPause().catch((err) => {
            console.warn("[androidMediaBridge] togglePlayPause failed:", err);
          });
          break;
        case "next":
          void playerController.skipToNext().catch((err) => {
            console.warn("[androidMediaBridge] skipToNext failed:", err);
          });
          break;
        case "prev":
          void playerController.skipToPrevious().catch((err) => {
            console.warn("[androidMediaBridge] skipToPrevious failed:", err);
          });
          break;
        default:
          break;
      }
    };

    // 1. Direct window callback
    (window as unknown as { __neno_media_command?: (cmd: string) => void; __zuno_media_command?: (cmd: string) => void }).__neno_media_command = handleCommand;
    (window as unknown as { __zuno_media_command?: (cmd: string) => void }).__zuno_media_command = handleCommand;

    // 2. CustomEvent on window
    const customEventListener = (event: Event) => {
      const detail = (event as CustomEvent<{ command: string }>).detail;
      if (detail?.command) {
        handleCommand(detail.command);
      }
    };
    window.addEventListener(BROADCAST_EVENT, customEventListener);

    // 3. Tauri event listener fallback
    let unlistenPromise: Promise<() => void> | null = null;
    if (isTauri()) {
      unlistenPromise = listen<{ command: string }>(BROADCAST_EVENT, (event) => {
        const command = event.payload?.command;
        if (command) {
          handleCommand(command);
        }
      });
    }

    return () => {
      delete (window as unknown as { __neno_media_command?: unknown }).__neno_media_command;
      delete (window as unknown as { __zuno_media_command?: unknown }).__zuno_media_command;
      window.removeEventListener(BROADCAST_EVENT, customEventListener);
      void unlistenPromise?.then((fn) => fn());
    };
  }, []);
}

export { isAndroidEnvironment as isAndroidTauri };
