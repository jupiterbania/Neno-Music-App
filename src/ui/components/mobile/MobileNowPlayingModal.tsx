import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  BookmarkIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DislikeActiveIcon,
  DislikeIcon,
  DownloadIcon,
  DragHandleIcon,
  HeadphonesRoundIcon,
  LikeActiveIcon,
  LikeIcon,
  MoreVerticalIcon,
  PauseActiveIcon,
  PlayActiveIcon,
  QuoteIcon,
  RepeatActiveIcon,
  RepeatIcon,
  RepeatOneActiveIcon,
  ScreencastIcon,
  ShareIcon,
  ShuffleActiveIcon,
  ShuffleIcon,
  SkipNextIcon,
  SkipPreviousIcon,
  YTSaveIcon,
} from "@/ui/icons";
import { SpinnerSteps } from "@/components/motion/loader";
import {
  libraryController,
  playerController,
  shallowEqual,
  useLibraryState,
  usePlayerSelector,
  usePlayerSessionSelector,
} from "../../../player/playerStore";
import type { PlayerSession } from "../../../player/PlayerController";
import type { Lyrics, Track } from "../../../datasource/types";
import { TrackArtwork } from "../TrackArtwork";
import { SeekBar } from "../player/SeekBar";
import { useTrackContextMenu } from "../TrackContextMenu";
import { formatMinutesSeconds } from "@/lib/utils";
import { findActiveLineIndex, isSyncedLyrics } from "../../pages/lyricsTiming";
import {
  cancelDownload,
  getOfflineStatus,
  queueDownload,
  removeDownload,
  useOfflineState,
} from "../../../player/offlineStore";

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type QueueSheetState = "collapsed" | "half" | "full";
type AudioMode = "audio" | "lyrics";

const EMPTY_QUEUE: Track[] = [];
const EMPTY_UPCOMING_TRACKS: { track: Track; absoluteIndex: number; position: number }[] = [];

function selectQueueSlice(session: PlayerSession | null) {
  return {
    queue: session?.queue ?? EMPTY_QUEUE,
    queueIndex: session?.queueIndex ?? -1,
    manualQueueLength: session?.manualQueueLength ?? 0,
    stopAfterQueueIndex: session?.stopAfterQueueIndex ?? null,
    queueWindowStart: session?.queueWindowStart ?? 0,
  };
}

function queueSliceEqual(
  a: ReturnType<typeof selectQueueSlice>,
  b: ReturnType<typeof selectQueueSlice>,
) {
  return (
    a.queueIndex === b.queueIndex &&
    a.manualQueueLength === b.manualQueueLength &&
    a.stopAfterQueueIndex === b.stopAfterQueueIndex &&
    a.queueWindowStart === b.queueWindowStart &&
    a.queue.length === b.queue.length &&
    a.queue.every((track, index) => track === b.queue[index])
  );
}

export function MobileNowPlayingModal({ isOpen, onClose }: MobileNowPlayingModalProps) {
  // Mode toggles
  const [queueSheetState, setQueueSheetState] = useState<QueueSheetState>("collapsed");
  const [audioMode, setAudioMode] = useState<AudioMode>("audio");
  const [isDisliked, setIsDisliked] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Lyrics state
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsActiveIndex, setLyricsActiveIndex] = useState(-1);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lyricsLineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const isLyricsUserScrollingRef = useRef(false);
  const userScrollResumeTimerRef = useRef<number | null>(null);

  // Player state
  const state = usePlayerSelector(
    (player) => ({
      currentTrack: player.currentTrack,
      status: player.status,
      playbackOrderMode: player.playbackOrderMode,
      shuffleEnabled: player.shuffleEnabled,
    }),
    shallowEqual,
  );
  const libraryState = useLibraryState();
  useOfflineState();
  const { toggleTrackLike, openPlaylistPicker, openTrackMenu } = useTrackContextMenu();

  // Queue state
  const { queue, queueIndex, queueWindowStart } = usePlayerSessionSelector(
    selectQueueSlice,
    queueSliceEqual,
  );

  const currentTrack = state.currentTrack;
  const isPlaying = state.status === "playing";
  const isLoading = state.status === "loading";
  const isShuffle = state.shuffleEnabled;
  const isRepeatAll = state.playbackOrderMode === "repeat-all";
  const isRepeatOne = state.playbackOrderMode === "repeat-one";

  const isLiked =
    Boolean(currentTrack) &&
    (libraryState.library?.likedSongs.some((track) => track.id === currentTrack?.id) ?? false);

  const downloadStatus = currentTrack ? getOfflineStatus(currentTrack.id) : "absent";

  // Calculate upcoming queue tracks (only compute when modal is actually open)
  const upcomingTracks = useMemo(() => {
    if (!isOpen) return EMPTY_UPCOMING_TRACKS;
    const start = Math.max(queueIndex + 1, 0);
    const entries: { track: Track; absoluteIndex: number; position: number }[] = [];
    for (let offset = 0; start + offset < queue.length; offset += 1) {
      entries.push({
        track: queue[start + offset],
        absoluteIndex: queueWindowStart + start + offset,
        position: offset + 1,
      });
    }
    return entries;
  }, [isOpen, queue, queueIndex, queueWindowStart]);

  // Touch gesture state references
  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  // Reset states on modal close/open
  useEffect(() => {
    if (isOpen) {
      setQueueSheetState("collapsed");
    }
  }, [isOpen]);

  // Fetch lyrics when track changes or when lyrics mode is active and modal is open
  useEffect(() => {
    if (!isOpen || !currentTrack || audioMode !== "lyrics") return;
    let cancelled = false;
    setLyricsLoading(true);
    setLyrics(null);
    setLyricsActiveIndex(-1);

    playerController
      .getLyrics(currentTrack)
      .then((res) => {
        if (!cancelled) setLyrics(res);
      })
      .catch(() => {
        if (!cancelled) setLyrics(null);
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentTrack?.id, audioMode]);

  // Track active lyric line in real-time
  useEffect(() => {
    if (!isOpen || audioMode !== "lyrics" || !lyrics || !isSyncedLyrics(lyrics)) {
      setLyricsActiveIndex(-1);
      return;
    }

    const interval = setInterval(() => {
      const currentTime = playerController.getCurrentTime();
      const nextIndex = findActiveLineIndex(lyrics.lines, currentTime);
      setLyricsActiveIndex((prev) => {
        if (prev !== nextIndex) {
          if (!isLyricsUserScrollingRef.current && nextIndex >= 0) {
            const lineEl = lyricsLineRefs.current[nextIndex];
            const container = lyricsContainerRef.current;
            if (lineEl && container) {
              container.scrollTo({
                top: Math.max(
                  0,
                  lineEl.offsetTop - container.clientHeight / 2 + lineEl.offsetHeight / 2,
                ),
                behavior: "smooth",
              });
            }
          }
          return nextIndex;
        }
        return prev;
      });
    }, 250);

    return () => clearInterval(interval);
  }, [isOpen, audioMode, lyrics]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToastMessage(null), 2500);
  };

  // Header "Playing from" label (matches Image 2's "{Title} Mix")
  const playingFromTitle =
    currentTrack?.title
      ? `${currentTrack.title} Mix`
      : currentTrack?.album || (currentTrack?.artist ? `${currentTrack.artist} Mix` : "Up Next");

  // Cast click handler - displays "Coming soon" as requested
  const handleCastClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    showToast("Coming soon");
  };

  // Realistic/stable like count formatted like YouTube Music (e.g. 11K)
  const likeCountText = useMemo(() => {
    if (!currentTrack) return "11K";
    if (currentTrack.viewCount) {
      const approx = Math.max(1000, Math.round(currentTrack.viewCount * 0.04));
      if (approx >= 1_000_000) return `${(approx / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
      if (approx >= 1_000) return `${Math.round(approx / 1_000)}K`;
      return `${approx}`;
    }
    // Stable pseudo-hash based on track id so count doesn't jump randomly
    let hash = 0;
    for (let i = 0; i < currentTrack.id.length; i++) {
      hash = (hash * 31 + currentTrack.id.charCodeAt(i)) & 0xfffff;
    }
    const count = 5 + (hash % 90);
    return `${count}K`;
  }, [currentTrack]);

  // Save upcoming queue as a new playlist
  const handleSaveQueueAsPlaylist = async () => {
    if (saveStatus !== "idle") return;
    setSaveStatus("saving");
    const title = currentTrack?.album
      ? `${currentTrack.album} Queue`
      : currentTrack?.title
      ? `${currentTrack.title} Mix`
      : "My Queue";
    const trackIds = [
      ...(currentTrack ? [currentTrack.id] : []),
      ...upcomingTracks.map((entry) => entry.track.id),
    ];
    try {
      await libraryController.createPlaylist(title, { trackIds });
      setSaveStatus("saved");
      showToast("Saved queue to playlists!");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("idle");
    }
  };


  // Handle Like
  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentTrack) return;
    if (isDisliked) setIsDisliked(false);
    toggleTrackLike(currentTrack);
  };

  // Handle Dislike
  const handleToggleDislike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentTrack) return;
    if (isLiked) {
      toggleTrackLike(currentTrack);
    }
    setIsDisliked((prev) => !prev);
  };

  // Handle Save
  const handleSaveToPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentTrack) return;
    openPlaylistPicker(currentTrack);
  };

  // Handle Download
  const handleToggleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentTrack) return;
    if (downloadStatus === "ready") {
      void removeDownload(currentTrack.id);
      showToast("Download removed");
    } else if (downloadStatus === "downloading" || downloadStatus === "queued") {
      cancelDownload(currentTrack.id);
      showToast("Download cancelled");
    } else {
      queueDownload(currentTrack);
      showToast("Downloading track...");
    }
  };

  // Handle Share button
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentTrack) return;
    const shareUrl = `https://music.youtube.com/watch?v=${encodeURIComponent(currentTrack.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: currentTrack.title,
          text: `Listening to ${currentTrack.title} by ${currentTrack.artist}`,
          url: shareUrl,
        });
      } catch {
        // User dismissed share dialog
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Link copied to clipboard!");
      } catch {
        showToast("Failed to copy link");
      }
    }
  };

  // Switch between audio and lyrics view; collapse queue sheet when entering lyrics
  const handleSetAudioMode = (mode: "audio" | "lyrics") => {
    setAudioMode(mode);
    if (mode === "lyrics" && queueSheetState !== "collapsed") {
      setQueueSheetState("collapsed");
    }
  };

  // Lyrics user scroll handler to prevent jitter
  const handleLyricsScroll = () => {
    isLyricsUserScrollingRef.current = true;
    if (userScrollResumeTimerRef.current) window.clearTimeout(userScrollResumeTimerRef.current);
    userScrollResumeTimerRef.current = window.setTimeout(() => {
      isLyricsUserScrollingRef.current = false;
    }, 3500);
  };

  // Handle touch events on the drag handle / sheet header
  const handleSheetTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleSheetTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    const deltaX = touchStartXRef.current
      ? e.changedTouches[0].clientX - touchStartXRef.current
      : 0;

    touchStartYRef.current = null;
    touchStartXRef.current = null;

    if (Math.abs(deltaY) > 30 && Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY < 0) {
        // Swiped UP
        if (queueSheetState === "collapsed") {
          setQueueSheetState("half");
        } else if (queueSheetState === "half") {
          setQueueSheetState("full");
        }
      } else {
        // Swiped DOWN
        if (queueSheetState === "full") {
          setQueueSheetState("half");
        } else if (queueSheetState === "half") {
          setQueueSheetState("collapsed");
        } else if (queueSheetState === "collapsed") {
          // In collapsed state, swiping down on queue bar minimizes player
          onClose();
        }
      }
    }
  };

  // Touch gestures on main player body / poster / controls to swipe up or down
  const handlePlayerBodyTouchStart = (e: React.TouchEvent) => {
    if (audioMode === "lyrics") return;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handlePlayerBodyTouchEnd = (e: React.TouchEvent) => {
    if (audioMode === "lyrics") {
      touchStartYRef.current = null;
      touchStartXRef.current = null;
      return;
    }
    if (touchStartYRef.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    const deltaX = touchStartXRef.current
      ? e.changedTouches[0].clientX - touchStartXRef.current
      : 0;
    touchStartYRef.current = null;
    touchStartXRef.current = null;

    if (Math.abs(deltaY) > 30 && Math.abs(deltaY) > Math.abs(deltaX)) {
      if (deltaY < -40) {
        // Swiped UP -> expand queue sheet
        if (queueSheetState === "collapsed") {
          setQueueSheetState("half");
        } else if (queueSheetState === "half") {
          setQueueSheetState("full");
        }
      } else if (deltaY > 35) {
        // Swiped DOWN
        if (queueSheetState === "full") {
          setQueueSheetState("half");
        } else if (queueSheetState === "half") {
          setQueueSheetState("collapsed");
        } else if (queueSheetState === "collapsed") {
          // Return to mini player
          onClose();
        }
      }
    }
  };

  // Header specific touch gestures (swipe down anywhere on header minimizes)
  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    const deltaX = touchStartXRef.current
      ? e.changedTouches[0].clientX - touchStartXRef.current
      : 0;
    touchStartYRef.current = null;
    touchStartXRef.current = null;

    if (deltaY > 25 && Math.abs(deltaY) > Math.abs(deltaX)) {
      onClose();
    }
  };

  // Queue list scroll container top pull-down handling
  const queueTouchStartYRef = useRef<number | null>(null);
  const queueScrollTopRef = useRef<number>(0);

  const handleQueueListTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    queueTouchStartYRef.current = e.touches[0].clientY;
    queueScrollTopRef.current = e.currentTarget.scrollTop;
  };

  const handleQueueListTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (queueTouchStartYRef.current === null) return;
    const deltaY = e.touches[0].clientY - queueTouchStartYRef.current;
    const scrollTop = e.currentTarget.scrollTop;

    // If at top of list and pulling down, let gesture bubble to parent sheet drag handler
    if (queueScrollTopRef.current <= 0 && scrollTop <= 0 && deltaY > 0) {
      return;
    }
    // Otherwise stop propagation so list container scrolls
    e.stopPropagation();
  };

  const handleQueueListTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (queueTouchStartYRef.current === null) return;
    const deltaY = e.changedTouches[0].clientY - queueTouchStartYRef.current;
    const scrollTop = e.currentTarget.scrollTop;

    if (queueScrollTopRef.current <= 0 && scrollTop <= 0 && deltaY > 35) {
      if (queueSheetState === "full") {
        setQueueSheetState("half");
      } else if (queueSheetState === "half") {
        setQueueSheetState("collapsed");
      }
    }
    queueTouchStartYRef.current = null;
  };

  // Drag-to-reorder track in queue state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; insertAfter: boolean } | null>(null);

  const pointerDragRef = useRef<{
    pointerId: number;
    sourceIndex: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const dropTargetRef = useRef<{ index: number; insertAfter: boolean } | null>(null);
  const isDraggingRef = useRef(false);

  const handleRowDragStart = (e: React.PointerEvent, absoluteIndex: number) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Ignored if pointer capture fails
    }

    pointerDragRef.current = {
      pointerId: e.pointerId,
      sourceIndex: absoluteIndex,
      startY: e.clientY,
      isDragging: false,
    };
    dropTargetRef.current = null;
    setDropTarget(null);
  };

  const handleRowDragMove = (e: React.PointerEvent) => {
    const drag = pointerDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;

    const deltaY = Math.abs(e.clientY - drag.startY);
    if (!drag.isDragging && deltaY > 4) {
      drag.isDragging = true;
      isDraggingRef.current = true;
      setDraggedIndex(drag.sourceIndex);
    }

    if (!drag.isDragging) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    const targetEl = elements
      .map((el) => el.closest<HTMLElement>("[data-queue-index]"))
      .find((el) => Boolean(el) && Number(el?.dataset.queueIndex) !== drag.sourceIndex);

    if (!targetEl) {
      setDropTarget(null);
      dropTargetRef.current = null;
      return;
    }

    const targetIndex = Number(targetEl.dataset.queueIndex);
    const bounds = targetEl.getBoundingClientRect();
    const insertAfter = e.clientY >= bounds.top + bounds.height / 2;

    const newDrop = { index: targetIndex, insertAfter };
    dropTargetRef.current = newDrop;
    setDropTarget(newDrop);
  };

  const handleRowDragEnd = (e: React.PointerEvent) => {
    const drag = pointerDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const drop = dropTargetRef.current;
    if (drag.isDragging && drop && drop.index !== drag.sourceIndex) {
      playerController.moveQueueTrack(drag.sourceIndex, drop.index, drop.insertAfter);
    }

    pointerDragRef.current = null;
    dropTargetRef.current = null;
    setDraggedIndex(null);
    setDropTarget(null);

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="mobile-now-playing-modal"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-[#050505] text-foreground select-none overflow-hidden"
        >
          {/* Dynamic Ambient Background reacting to Artwork */}
          {currentTrack?.artworkUrl && (
            <div
              key={currentTrack.artworkUrl}
              className="absolute inset-0 -z-20 pointer-events-none scale-150 bg-cover bg-center opacity-30 blur-3xl transition-opacity duration-700"
              style={{ backgroundImage: `url("${currentTrack.artworkUrl}")` }}
            />
          )}
          <div className="absolute inset-0 -z-10 pointer-events-none bg-gradient-to-b from-black/40 via-[#0a0a0a]/80 to-[#050505]" />

          {/* ── TOP HEADER (Chevron, Headphones/Lyrics Switcher, Cast, 3-Dots) ── */}
          {queueSheetState !== "full" && (
            <header
              onTouchStart={handleHeaderTouchStart}
              onTouchEnd={handleHeaderTouchEnd}
              className="relative flex items-center justify-between px-3 pt-9 pb-2 z-20 transition-colors duration-200"
            >
              {/* Minimize button */}
              <button
                type="button"
                onClick={onClose}
                className="flex size-10 items-center justify-center rounded-full text-white transition-transform active:scale-90 hover:opacity-80"
                aria-label="Minimize now playing"
              >
                <ChevronDownIcon size={28} />
              </button>

              {/* Audio (Headphone) vs Lyrics Switcher Pill — absolutely centred so unequal L/R buttons don't shift it */}
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center rounded-full bg-black/40 backdrop-blur-md p-0.5 border border-white/10 shadow-sm">
                {/* Song / Audio Mode */}
                <button
                  type="button"
                  onClick={() => handleSetAudioMode("audio")}
                  className={cn(
                    "flex h-7 px-3 items-center justify-center rounded-full transition-all active:scale-95",
                    audioMode === "audio"
                      ? "bg-white/20 text-white shadow-sm font-medium"
                      : "text-white/60 hover:text-white/90",
                  )}
                  aria-label="Audio mode"
                  title="Song View"
                >
                  <HeadphonesRoundIcon size={18} />
                </button>

                {/* Lyrics Mode */}
                <button
                  type="button"
                  onClick={() => handleSetAudioMode("lyrics")}
                  className={cn(
                    "flex h-7 px-3 items-center justify-center rounded-full transition-all active:scale-95",
                    audioMode === "lyrics"
                      ? "bg-white/20 text-white shadow-sm font-medium"
                      : "text-white/60 hover:text-white/90",
                  )}
                  aria-label="Lyrics mode"
                  title="Lyrics View"
                >
                  <QuoteIcon size={16} />
                </button>
              </div>

              {/* Right Action Icons: Cast & 3-dots Menu */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCastClick}
                  className="flex size-10 items-center justify-center rounded-full text-white/90 transition-transform active:scale-90 hover:text-white"
                  aria-label="Cast audio"
                >
                  <ScreencastIcon size={22} />
                </button>
                <button
                  type="button"
                  onClick={(e) => currentTrack && openTrackMenu(e, currentTrack)}
                  className="flex size-10 items-center justify-center rounded-full text-white/90 transition-transform active:scale-90 hover:text-white"
                  aria-label="More options"
                >
                  <MoreVerticalIcon size={22} />
                </button>
              </div>
            </header>
          )}

          {/* ── MAIN PLAYER CONTENT (Collapsed & Half States) ── */}
          {queueSheetState !== "full" && (
            <div
              onTouchStart={audioMode === "audio" ? handlePlayerBodyTouchStart : undefined}
              onTouchEnd={audioMode === "audio" ? handlePlayerBodyTouchEnd : undefined}
              className={cn(
                "flex flex-1 flex-col overflow-hidden z-10",
                queueSheetState === "half" ? "pb-[52vh]" : audioMode === "lyrics" ? "pb-2" : "pb-14",
              )}
            >
              {/* ── AUDIO MODE VIEW ── */}
              {audioMode === "audio" ? (
                <div className="flex flex-1 flex-col justify-between overflow-hidden pb-1">
                  {/* Square Contained Artwork Card (YouTube Music Style) */}
                  <div className="flex flex-1 items-center justify-center px-6 py-2 min-h-0">
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-2xl shadow-[0_16px_44px_rgba(0,0,0,0.85)] select-none border border-white/5",
                        queueSheetState === "half"
                          ? "size-36 sm:size-44 aspect-square"
                          : "w-[84vw] max-w-[340px] max-h-[38vh] aspect-square",
                      )}
                    >
                      <TrackArtwork
                        artworkUrl={currentTrack?.artworkUrl}
                        className="size-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Metadata & Controls Container (Systematic YT Music Structure) */}
                  <div className="shrink-0 flex flex-col gap-3 px-6 pb-2">
                    {/* Song Title & Artist */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h2 className="truncate text-[22px] leading-tight font-bold tracking-tight text-white drop-shadow-sm">
                          {currentTrack?.title || "No track playing"}
                        </h2>
                        <ChevronRightIcon size={18} className="text-white/60 shrink-0" />
                      </div>
                      <p className="truncate text-sm font-normal text-white/70 mt-0.5">
                        {currentTrack?.artist || "Unknown Artist"}
                      </p>
                    </div>

                    {/* ACTION PILLS ROW (Like/Dislike, Lyrics, Save, Share, Download) */}
                    {queueSheetState === "collapsed" && (
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        {/* Like / Dislike Combined Pill */}
                        <div className="flex items-center rounded-full bg-white/10 hover:bg-white/15 border border-transparent h-9 px-3.5 gap-2.5 text-xs font-medium text-white shrink-0">
                          <button
                            type="button"
                            onClick={handleToggleLike}
                            className={cn(
                              "flex items-center gap-1.5 transition-colors active:scale-95",
                              isLiked ? "text-white font-bold" : "text-white/90 hover:text-white",
                            )}
                            aria-label="Like"
                          >
                            {isLiked ? (
                              <LikeActiveIcon size={18} className="fill-current text-white" />
                            ) : (
                              <LikeIcon size={18} />
                            )}
                            <span>{likeCountText}</span>
                          </button>
                          <div className="h-3.5 w-px bg-white/20" />
                          <button
                            type="button"
                            onClick={handleToggleDislike}
                            className={cn(
                              "transition-colors active:scale-95",
                              isDisliked ? "text-white font-bold" : "text-white/90 hover:text-white",
                            )}
                            aria-label="Dislike"
                          >
                            {isDisliked ? (
                              <DislikeActiveIcon size={18} className="fill-current text-white" />
                            ) : (
                              <DislikeIcon size={18} />
                            )}
                          </button>
                        </div>

                        {/* Lyrics Pill */}
                        <button
                          type="button"
                          onClick={() => handleSetAudioMode("lyrics")}
                          className="flex items-center gap-2 rounded-full h-9 px-4 text-xs font-medium shrink-0 active:scale-95 transition-all bg-white/10 hover:bg-white/15 text-white/90 hover:text-white"
                        >
                          <QuoteIcon size={16} />
                          <span>Lyrics</span>
                        </button>

                        {/* Save to Playlist Pill */}
                        <button
                          type="button"
                          onClick={handleSaveToPlaylist}
                          className="flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 h-9 px-4 text-xs font-medium text-white/90 hover:text-white active:scale-95 transition-all shrink-0"
                        >
                          <YTSaveIcon size={18} />
                          <span>Save</span>
                        </button>

                        {/* Share Pill */}
                        <button
                          type="button"
                          onClick={handleShare}
                          className="flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 h-9 px-4 text-xs font-medium text-white/90 hover:text-white active:scale-95 transition-all shrink-0"
                        >
                          <ShareIcon size={18} />
                          <span>Share</span>
                        </button>

                        {/* Download Pill */}
                        <button
                          type="button"
                          onClick={handleToggleDownload}
                          className={cn(
                            "flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 h-9 px-4 text-xs font-medium active:scale-95 transition-all shrink-0",
                            downloadStatus === "ready"
                              ? "text-white font-semibold"
                              : "text-white/90 hover:text-white",
                          )}
                          aria-label="Download"
                          title={
                            downloadStatus === "ready"
                              ? "Downloaded (click to remove)"
                              : "Download track"
                          }
                        >
                          {downloadStatus === "downloading" ? (
                            <SpinnerSteps size={16} className="text-white" />
                          ) : downloadStatus === "ready" ? (
                            <CheckIcon size={18} className="text-white" />
                          ) : (
                            <DownloadIcon size={18} />
                          )}
                          <span>{downloadStatus === "ready" ? "Downloaded" : downloadStatus === "downloading" ? "Downloading" : "Download"}</span>
                        </button>
                      </div>
                    )}

                    {/* SEEKBAR PROGRESS */}
                    <div className="w-full mt-3">
                      <SeekBar layout="stacked" />
                    </div>

                    {/* MAIN TRANSPORT CONTROLS */}
                    <div className="flex items-center justify-between w-full px-2 mt-2 mb-1">
                      {/* Shuffle */}
                      <button
                        type="button"
                        onClick={() => playerController.toggleShuffle()}
                        className={cn(
                          "flex size-11 items-center justify-center transition-colors active:scale-90",
                          isShuffle ? "text-white" : "text-white/70 hover:text-white",
                        )}
                        aria-label="Shuffle"
                      >
                        {isShuffle ? <ShuffleActiveIcon size={24} /> : <ShuffleIcon size={24} />}
                      </button>

                      {/* Skip Previous */}
                      <button
                        type="button"
                        onClick={() => void playerController.skipToPrevious()}
                        className="flex size-12 items-center justify-center text-white transition-transform active:scale-90 hover:opacity-80"
                        aria-label="Previous track"
                      >
                        <SkipPreviousIcon size={32} />
                      </button>

                      {/* Big White Circular Play/Pause */}
                      <button
                        type="button"
                        onClick={() => void playerController.togglePlayPause()}
                        className="flex size-16 items-center justify-center rounded-full bg-white text-black shadow-2xl transition-transform active:scale-90 hover:scale-105"
                        aria-label={isPlaying ? "Pause" : "Play"}
                      >
                        {isLoading ? (
                          <SpinnerSteps size={32} className="text-black" />
                        ) : isPlaying ? (
                          <PauseActiveIcon size={32} />
                        ) : (
                          <PlayActiveIcon size={32} className="translate-x-0.5" />
                        )}
                      </button>

                      {/* Skip Next */}
                      <button
                        type="button"
                        onClick={() => void playerController.skipToNext()}
                        className="flex size-12 items-center justify-center text-white transition-transform active:scale-90 hover:opacity-80"
                        aria-label="Next track"
                      >
                        <SkipNextIcon size={32} />
                      </button>

                      {/* Repeat */}
                      <button
                        type="button"
                        onClick={() => playerController.cyclePlaybackOrderMode()}
                        className={cn(
                          "flex size-11 items-center justify-center transition-colors active:scale-90",
                          isRepeatAll || isRepeatOne
                            ? "text-white"
                            : "text-white/70 hover:text-white",
                        )}
                        aria-label="Repeat mode"
                      >
                        {isRepeatOne ? (
                          <RepeatOneActiveIcon size={24} />
                        ) : isRepeatAll ? (
                          <RepeatActiveIcon size={24} />
                        ) : (
                          <RepeatIcon size={24} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
              /* ── LIVE SYNCED LYRICS VIEW ── */
              <div className="flex flex-1 flex-col justify-between overflow-hidden px-6 pt-2">
                <div
                  ref={lyricsContainerRef}
                  onScroll={handleLyricsScroll}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="flex-1 overflow-y-auto overscroll-contain py-8 touch-pan-y no-scrollbar"
                >
                  {lyricsLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-white/60">
                      <SpinnerSteps size={32} className="text-primary" />
                      <span className="text-sm font-medium">Loading lyrics...</span>
                    </div>
                  ) : !lyrics || lyrics.lines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-white/50 px-4">
                      <p className="text-base font-semibold text-white/80">
                        No lyrics available for this song
                      </p>
                      <p className="text-xs text-white/50">
                        Enjoy the music or switch back to the poster view anytime.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-5 pb-20">
                      {lyrics.lines.map((line, index) => {
                        const isActive = isSyncedLyrics(lyrics) && index === lyricsActiveIndex;
                        const isSeekable =
                          typeof line.startTimeSec === "number" && line.text.trim().length > 0;

                        return (
                          <div
                            key={index}
                            ref={(el) => {
                              lyricsLineRefs.current[index] = el;
                            }}
                            onClick={() => {
                              if (isSeekable && typeof line.startTimeSec === "number") {
                                void playerController.seekTo(line.startTimeSec);
                              }
                            }}
                            className={cn(
                              "transition-all duration-300 select-text leading-relaxed",
                              isSeekable ? "cursor-pointer" : "cursor-default",
                              isActive
                                ? "text-white font-bold text-2xl sm:text-3xl scale-[1.03] origin-left drop-shadow-md"
                                : "text-white/40 font-semibold text-lg sm:text-xl hover:text-white/70",
                            )}
                          >
                            {line.text || "♪"}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Compact Seekbar & Controls under Lyrics */}
                <div
                  className="flex flex-col gap-2 pt-2 border-t border-white/10 bg-[#080808] -mx-6 px-6 pb-2"
                >
                  <div className="w-full">
                    <SeekBar layout="stacked" />
                  </div>
                  <div className="flex items-center justify-between pb-1">
                    <button
                      type="button"
                      onClick={() => void playerController.skipToPrevious()}
                      className="flex size-10 items-center justify-center text-white transition-transform active:scale-90"
                      aria-label="Previous track"
                    >
                      <SkipPreviousIcon size={26} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void playerController.togglePlayPause()}
                      className="flex size-13 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform active:scale-90"
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <PauseActiveIcon size={26} />
                      ) : (
                        <PlayActiveIcon size={26} className="translate-x-0.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void playerController.skipToNext()}
                      className="flex size-10 items-center justify-center text-white transition-transform active:scale-90"
                      aria-label="Next track"
                    >
                      <SkipNextIcon size={26} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── UP NEXT QUEUE BOTTOM SHEET (Only in Audio Mode) ── */}
        {audioMode === "audio" && (
          <motion.div
          animate={{
            height:
              queueSheetState === "full"
                ? "100%"
                : queueSheetState === "half"
                ? "52%"
                : "48px",
          }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 flex flex-col transition-colors duration-200",
            queueSheetState === "full"
              ? "bg-[#080808] text-foreground"
              : queueSheetState === "half"
              ? "bg-[#141414] rounded-t-3xl border-t border-white/15 shadow-[0_-16px_48px_rgba(0,0,0,0.85)]"
              : "bg-black/30 backdrop-blur-md border-t border-white/10 cursor-pointer hover:bg-black/50",
          )}
        >
          {/* DRAG HANDLE & HEADER BAR */}
          <div
            onTouchStart={handleSheetTouchStart}
            onTouchEnd={handleSheetTouchEnd}
            onClick={() => {
              if (queueSheetState === "collapsed") {
                setQueueSheetState("half");
              }
            }}
            className="flex shrink-0 flex-col pt-2 pb-2 px-4 cursor-grab active:cursor-grabbing select-none"
          >
            {/* STAGE 2: STICKY MINI PLAYER BAR */}
            {queueSheetState === "full" && (
              <div className="flex items-center justify-between pb-3 pt-1 border-b border-white/10">
                <div
                  onClick={() => setQueueSheetState("half")}
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                >
                  <div className="size-11 shrink-0 overflow-hidden rounded-lg shadow border border-white/10">
                    <TrackArtwork
                      artworkUrl={currentTrack?.artworkUrl}
                      size={44}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold text-white">
                      {currentTrack?.title || "No track playing"}
                    </span>
                    <span className="truncate text-xs font-medium text-white/60">
                      {currentTrack?.artist || "Unknown Artist"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCastClick}
                    className="flex size-9 items-center justify-center text-white/80 hover:text-white"
                    aria-label="Cast"
                  >
                    <ScreencastIcon size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void playerController.togglePlayPause()}
                    className="flex size-9 items-center justify-center text-white hover:opacity-80 active:scale-90"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? <PauseActiveIcon size={22} /> : <PlayActiveIcon size={22} />}
                  </button>
                </div>
              </div>
            )}

            {/* Horizontal Pill Drag Handle */}
            <div className="mx-auto h-1 w-11 rounded-full bg-white/40 my-1" />

            {/* "Playing from [Source]" Peek / Header */}
            {queueSheetState === "collapsed" ? (
              <div className="text-center pb-1">
                <span className="truncate text-xs font-medium text-white/80">
                  {playingFromTitle}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1 pb-1">
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-medium text-white/50 leading-tight">
                    Playing from
                  </span>
                  <span className="truncate text-sm font-bold text-white leading-tight">
                    {playingFromTitle}
                  </span>
                </div>

                {/* Save Queue as Playlist Button */}
                <button
                  type="button"
                  onClick={handleSaveQueueAsPlaylist}
                  disabled={saveStatus !== "idle"}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  <BookmarkIcon size={14} />
                  <span>
                    {saveStatus === "saving"
                      ? "Saving..."
                      : saveStatus === "saved"
                      ? "Saved!"
                      : "Save"}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* UP NEXT TRACK LIST */}
          {queueSheetState !== "collapsed" && (
            <div
              onTouchStart={handleQueueListTouchStart}
              onTouchMove={handleQueueListTouchMove}
              onTouchEnd={handleQueueListTouchEnd}
              className="flex-1 overflow-y-auto overscroll-contain px-4 pb-20 touch-pan-y divide-y divide-white/5"
            >
              {upcomingTracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-white/50 text-xs">
                  <p>No upcoming tracks in queue.</p>
                </div>
              ) : (
                upcomingTracks.map(({ track, absoluteIndex }) => (
                  <div
                    key={`${track.id}-${absoluteIndex}`}
                    data-queue-index={absoluteIndex}
                    onClick={() => {
                      if (!isDraggingRef.current) {
                        void playerController.playQueueTrackAt(absoluteIndex);
                      }
                    }}
                    onPointerMove={handleRowDragMove}
                    onPointerUp={handleRowDragEnd}
                    onPointerCancel={handleRowDragEnd}
                    className={cn(
                      "flex items-center justify-between gap-3 py-2.5 transition-all cursor-pointer rounded-lg px-2 group relative select-none",
                      draggedIndex === absoluteIndex ? "bg-white/10 opacity-50 scale-[1.01]" : "active:bg-white/5",
                      dropTarget?.index === absoluteIndex && dropTarget.insertAfter && "border-b-2 border-primary pb-1",
                      dropTarget?.index === absoluteIndex && !dropTarget.insertAfter && "border-t-2 border-primary pt-1",
                    )}
                  >
                    <div className="size-11 shrink-0 overflow-hidden rounded-lg shadow-sm border border-white/10">
                      <TrackArtwork
                        artworkUrl={track.artworkUrl}
                        size={44}
                        className="size-full object-cover"
                      />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-white group-hover:text-primary transition-colors">
                        {track.title}
                      </span>
                      <span className="truncate text-xs font-medium text-white/60">
                        {track.artist || "Unknown Artist"}
                        {track.durationSec ? ` • ${formatMinutesSeconds(track.durationSec)}` : ""}
                      </span>
                    </div>

                    <div
                      onPointerDown={(e) => handleRowDragStart(e, absoluteIndex)}
                      className="flex size-10 shrink-0 items-center justify-center text-white/50 hover:text-white active:text-white cursor-grab active:cursor-grabbing touch-none"
                      aria-label="Hold and drag to reorder"
                      title="Hold and drag to reorder"
                    >
                      <DragHandleIcon size={22} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          </motion.div>
        )}

        {/* Feedback toast */}
        {toastMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] rounded-full bg-[#202118] px-4 py-2 text-xs font-semibold text-white border border-white/20 shadow-2xl animate-fade-in">
            {toastMessage}
          </div>
        )}
      </motion.div>
    )}
  </AnimatePresence>
);
}
