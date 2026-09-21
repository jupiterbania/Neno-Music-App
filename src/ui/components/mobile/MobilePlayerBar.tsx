import { useEffect, useRef, memo, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  HeartActiveIcon,
  HeartIcon,
  PauseActiveIcon,
  PlayActiveIcon,
  SkipNextIcon,
} from "@/ui/icons";
import { SpinnerSteps } from "@/components/motion/loader";
import {
  playerController,
  shallowEqual,
  useLibraryState,
  usePlayerSelector,
} from "../../../player/playerStore";
import { TrackArtwork } from "../TrackArtwork";
import { useTrackContextMenu } from "../TrackContextMenu";

interface MobilePlayerBarProps {
  onOpenNowPlaying: () => void;
  className?: string;
}

// Lightweight isolated progress bar to prevent re-rendering the entire player bar on timer ticks
const MiniPlayerProgress = memo(function MiniPlayerProgress({
  trackId,
  isPlaying,
}: {
  trackId?: string;
  isPlaying: boolean;
}) {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trackId) {
      if (progressRef.current) progressRef.current.style.width = "0%";
      return;
    }

    const update = () => {
      const dur = playerController.getDuration();
      const curr = playerController.getCurrentTime();
      if (dur > 0 && progressRef.current) {
        const pct = Math.min(100, Math.max(0, (curr / dur) * 100));
        progressRef.current.style.width = `${pct}%`;
      }
    };

    update();
    if (!isPlaying) return;

    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [trackId, isPlaying]);

  return (
    <div className="h-[2.5px] w-full bg-white/10 overflow-hidden rounded-t-2xl">
      <div
        ref={progressRef}
        className="h-full bg-gradient-to-r from-red-500 to-rose-400 transition-[width] duration-500 ease-linear"
        style={{ width: "0%" }}
      />
    </div>
  );
});

export function MobilePlayerBarInner({ onOpenNowPlaying, className }: MobilePlayerBarProps) {
  const state = usePlayerSelector(
    (player) => ({
      currentTrack: player.currentTrack,
      status: player.status,
    }),
    shallowEqual,
  );
  const libraryState = useLibraryState();
  const { toggleTrackLike } = useTrackContextMenu();

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const currentTrack = state.currentTrack;
  const isPlaying = state.status === "playing";
  const isLoading = state.status === "loading";

  if (!currentTrack) return null;

  // O(1) lookup using a Set instead of O(n) .some() scan on every render
  const isLiked = useMemo(() => {
    const likedIds = new Set(libraryState.library?.likedSongs.map((t) => t.id));
    return likedIds.has(currentTrack.id);
  }, [libraryState.library?.likedSongs, currentTrack.id]);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    playerController.togglePlayPause();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    void playerController.skipToNext();
  };

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleTrackLike(currentTrack);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    const duration = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    // Swipe up opens Now Playing immediately
    if (deltaY < -25 && Math.abs(deltaY) > Math.abs(deltaX)) {
      onOpenNowPlaying();
      return;
    }

    // Horizontal swipe for skip tracks
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) && duration < 500) {
      if (deltaX < 0) {
        void playerController.skipToNext();
      } else {
        void playerController.skipToPrevious();
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        layout
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        onClick={onOpenNowPlaying}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-2xl transform-gpu will-change-transform",
          "bg-[#1c1d22] border border-white/15 shadow-[0_12px_36px_rgba(0,0,0,0.65)]",
          "cursor-pointer select-none",
          className,
        )}
      >
        {/* Top Progress Line */}
        <MiniPlayerProgress trackId={currentTrack.id} isPlaying={isPlaying} />

        {/* Structured Content Row */}
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Track Artwork Thumbnail */}
          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl shadow-md border border-white/10">
            <TrackArtwork
              artworkUrl={currentTrack.artworkUrl}
              size={48}
              className="size-full object-cover"
            />
            {isPlaying && (
              <span className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
            )}
          </div>

          {/* Title & Artist - Cleanly Structured & Animated */}
          <div className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTrack.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col truncate"
              >
                <span className="truncate text-sm font-semibold tracking-tight text-white leading-tight">
                  {currentTrack.title || "Unknown Track"}
                </span>
                <span className="truncate text-xs font-normal text-white/65 leading-normal mt-0.5">
                  {currentTrack.artist || "Unknown Artist"}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Action Icons - Structured with uniform touch targets & spring feedback */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Like button */}
            <motion.button
              type="button"
              onClick={handleToggleLike}
              whileTap={{ scale: 0.82 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="flex size-10 items-center justify-center text-white/70 hover:text-white transition-colors"
              aria-label={isLiked ? "Unlike track" : "Like track"}
            >
              {isLiked ? (
                <HeartActiveIcon size={20} className="text-red-500 scale-110 drop-shadow-[0_2px_8px_rgba(239,68,68,0.5)]" />
              ) : (
                <HeartIcon size={20} />
              )}
            </motion.button>

            {/* Play / Pause Circular Button */}
            <motion.button
              type="button"
              onClick={handlePlayPause}
              whileTap={{ scale: 0.84 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-lg hover:opacity-90 transition-opacity"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <SpinnerSteps size={18} className="text-black" />
              ) : isPlaying ? (
                <PauseActiveIcon size={18} />
              ) : (
                <PlayActiveIcon size={18} className="translate-x-0.5" />
              )}
            </motion.button>

            {/* Skip Next Button */}
            <motion.button
              type="button"
              onClick={handleNext}
              whileTap={{ scale: 0.82 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="flex size-10 items-center justify-center text-white/75 hover:text-white transition-colors"
              aria-label="Next track"
            >
              <SkipNextIcon size={22} />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export const MobilePlayerBar = memo(MobilePlayerBarInner);
