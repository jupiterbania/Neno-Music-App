import { useEffect, useRef, useState, memo } from "react";
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
const MiniPlayerProgress = memo(function MiniPlayerProgress({ trackId }: { trackId?: string }) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (!trackId) {
      setPercent(0);
      return;
    }
    const interval = setInterval(() => {
      const dur = playerController.getDuration();
      const curr = playerController.getCurrentTime();
      if (dur > 0) {
        setPercent(Math.min(100, Math.max(0, (curr / dur) * 100)));
      }
    }, 400);

    return () => clearInterval(interval);
  }, [trackId]);

  return (
    <div className="h-[2px] w-full bg-white/10 overflow-hidden rounded-t-2xl">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
});

export function MobilePlayerBar({ onOpenNowPlaying, className }: MobilePlayerBarProps) {
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

  const isLiked =
    libraryState.library?.likedSongs.some((track) => track.id === currentTrack.id) ?? false;

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
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={onOpenNowPlaying}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "relative flex w-full flex-col overflow-hidden rounded-2xl",
          "bg-[#1c1d16] border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)]",
          "active:scale-[0.99] transition-transform duration-100 cursor-pointer select-none",
          className,
        )}
      >
        {/* Top Progress Line */}
        <MiniPlayerProgress trackId={currentTrack.id} />

        {/* Structured Content Row */}
        <div className="flex items-center gap-3 px-3 py-2">
          {/* Track Artwork Thumbnail */}
          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl shadow-md border border-white/10">
            <TrackArtwork
              artworkUrl={currentTrack.artworkUrl}
              size={48}
              className="size-full object-cover"
            />
          </div>

          {/* Title & Artist - Cleanly Structured & Truncated */}
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="truncate text-sm font-semibold tracking-tight text-white leading-tight">
              {currentTrack.title || "Unknown Track"}
            </span>
            <span className="truncate text-xs font-normal text-white/65 leading-normal mt-0.5">
              {currentTrack.artist || "Unknown Artist"}
            </span>
          </div>

          {/* Action Icons - Structured with uniform 40px touch targets */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Like button */}
            <button
              type="button"
              onClick={handleToggleLike}
              className="flex size-10 items-center justify-center text-white/70 active:scale-90 hover:text-white transition-transform"
              aria-label={isLiked ? "Unlike track" : "Like track"}
            >
              {isLiked ? (
                <HeartActiveIcon size={20} className="text-red-500 scale-110" />
              ) : (
                <HeartIcon size={20} />
              )}
            </button>

            {/* Play / Pause Circular Button */}
            <button
              type="button"
              onClick={handlePlayPause}
              className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-md active:scale-90 transition-transform hover:opacity-90"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <SpinnerSteps size={18} className="text-black" />
              ) : isPlaying ? (
                <PauseActiveIcon size={18} />
              ) : (
                <PlayActiveIcon size={18} className="translate-x-0.5" />
              )}
            </button>

            {/* Skip Next Button */}
            <button
              type="button"
              onClick={handleNext}
              className="flex size-10 items-center justify-center text-white/75 active:scale-90 hover:text-white transition-transform"
              aria-label="Next track"
            >
              <SkipNextIcon size={22} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
