import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { AccountProfile, Track } from "../../datasource/types";
import type { PlayerControllerActions } from "../../player/playerStore";
import { ChevronRightIcon, PlayActiveIcon } from "../icons";
import { AccountAvatar } from "./AccountSwitcher";
import { TrackArtwork } from "./TrackArtwork";
import { useTrackContextMenu } from "./TrackContextMenu";

interface SpeedDialSectionProps {
  tracks: readonly Track[];
  account?: AccountProfile | null;
  playerController: PlayerControllerActions;
  onOpenSpeedDial?: () => void;
  isLoading?: boolean;
  className?: string;
}

const ITEMS_PER_PAGE = 9;
const MAX_SPEED_DIAL_ITEMS = 27;

export function SpeedDialSection({
  tracks,
  account,
  playerController,
  onOpenSpeedDial,
  isLoading = false,
  className,
}: SpeedDialSectionProps) {
  const { openTrackMenu } = useTrackContextMenu();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Sliced items up to 27 (3 pages of 9)
  const speedDialTracks = useMemo(
    () => tracks.slice(0, MAX_SPEED_DIAL_ITEMS),
    [tracks],
  );

  const totalPages = Math.max(1, Math.ceil(speedDialTracks.length / ITEMS_PER_PAGE));

  // Chunk into pages of 9 items
  const pages = useMemo(() => {
    const chunks: Track[][] = [];
    for (let i = 0; i < speedDialTracks.length; i += ITEMS_PER_PAGE) {
      chunks.push(speedDialTracks.slice(i, i + ITEMS_PER_PAGE));
    }
    return chunks;
  }, [speedDialTracks]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const pageIndex = Math.round(el.scrollLeft / el.clientWidth);
    setCurrentPage(pageIndex);
  }, []);

  const scrollToPage = (pageIndex: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({
      left: pageIndex * el.clientWidth,
      behavior: "smooth",
    });
    setCurrentPage(pageIndex);
  };

  const playTrack = (track: Track) => {
    void playerController.playTrackById(track.id, speedDialTracks, true);
  };

  if (!isLoading && speedDialTracks.length === 0) {
    return null;
  }

  return (
    <section className={cn("flex flex-col gap-3.5 select-none", className)}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenSpeedDial}
          className="group flex items-center gap-3 text-left transition-transform active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-0.5"
        >
          <AccountAvatar
            artworkUrl={account?.artworkUrl}
            className="size-7 sm:size-8 rounded-full border border-white/10 shrink-0"
            iconSize={16}
          />
          <div className="flex flex-col justify-center min-w-0">
            {account?.name && (
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider line-clamp-1 leading-none mb-1">
                {account.name}
              </span>
            )}
            <div className="flex items-center gap-1 text-foreground group-hover:text-primary transition-colors">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight leading-none">
                Speed dial
              </h2>
              <ChevronRightIcon
                size={22}
                className="text-muted-foreground/80 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
              />
            </div>
          </div>
        </button>
      </div>

      {/* ── 3x3 Grid Paged Carousel ─────────────────────────────────────── */}
      <div className="relative w-full">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex w-full overflow-x-auto snap-x snap-mandatory no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {isLoading ? (
            <div className="w-full shrink-0 snap-start grid grid-cols-3 grid-rows-3 gap-2 sm:gap-3">
              {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square w-full rounded-xl sm:rounded-2xl bg-card/60 animate-pulse border border-white/5"
                />
              ))}
            </div>
          ) : (
            pages.map((pageItems, pageIdx) => (
              <div
                key={`speed-dial-page-${pageIdx}`}
                className="w-full shrink-0 snap-start grid grid-cols-3 grid-rows-3 gap-2 sm:gap-3"
              >
                {pageItems.map((track) => (
                  <div
                    key={track.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => playTrack(track)}
                    onMouseEnter={() => playerController.warmTrack(track)}
                    onTouchStart={() => playerController.warmTrack(track)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        playTrack(track);
                      }
                    }}
                    onContextMenu={(e) => openTrackMenu(e, track)}
                    className={cn(
                      "group relative aspect-square w-full rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer select-none",
                      "border border-white/5 bg-card/80 transition-all duration-200",
                      "hover:border-white/20 hover:shadow-lg active:scale-[0.97]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    {/* Artwork */}
                    <TrackArtwork
                      artworkUrl={track.artworkUrl}
                      size={240}
                      iconSize={32}
                      variant="album"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Gradient Overlay for Readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />

                    {/* Desktop Play Overlay Icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <div className="size-10 rounded-full bg-primary/95 text-primary-foreground flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <PlayActiveIcon size={18} className="translate-x-0.5" />
                      </div>
                    </div>

                    {/* Title Text */}
                    <div className="absolute bottom-2 left-2 right-2 sm:bottom-2.5 sm:left-2.5 sm:right-2.5 pointer-events-none">
                      <span className="line-clamp-2 text-xs sm:text-sm font-bold text-white leading-tight drop-shadow-md tracking-tight">
                        {track.title}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Pagination Indicator Dots ───────────────────────────────────── */}
      {totalPages > 1 && !isLoading && (
        <div className="flex items-center justify-center gap-1.5 py-1">
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToPage(idx)}
              aria-label={`Go to speed dial page ${idx + 1}`}
              className={cn(
                "transition-all duration-300 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                currentPage === idx
                  ? "w-4.5 sm:w-5 h-1.5 bg-white shadow-xs"
                  : "size-1.5 bg-white/30 hover:bg-white/60",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
