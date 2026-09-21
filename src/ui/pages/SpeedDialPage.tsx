import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Album, Artist, Playlist, SpeedDialItem, Track } from "../../datasource/types";
import type { LibraryController, LibraryState } from "../../player/LibraryController";
import type { PlayerControllerActions } from "../../player/playerStore";
import { ArrowLeftIcon, MenuDotsIcon, PlayActiveIcon, ShuffleIcon } from "../icons";
import { AccountAvatar } from "../components/AccountSwitcher";
import { TrackArtwork } from "../components/TrackArtwork";
import { useTrackContextMenu } from "../components/TrackContextMenu";
import { useNowPlaying } from "../hooks/useNowPlaying";

interface SpeedDialPageProps {
  playerController: PlayerControllerActions;
  libraryController: LibraryController;
  libraryState: LibraryState;
  speedDialItems?: readonly SpeedDialItem[];
  speedDialTracks?: readonly Track[];
  onBack: () => void;
  onOpenAlbum?: (album: Album) => void;
  onOpenArtist?: (artist: Artist) => void;
  onOpenPlaylist?: (playlist: Playlist) => void;
}

export function SpeedDialPage({
  playerController,
  libraryController: _libraryController,
  libraryState,
  speedDialItems: customItems,
  speedDialTracks: customTracks,
  onBack,
  onOpenAlbum,
  onOpenArtist,
  onOpenPlaylist,
}: SpeedDialPageProps) {
  const { currentTrackId, isPlaying } = useNowPlaying();
  const { openTrackMenu } = useTrackContextMenu();

  const account = libraryState.library?.account;

  // Derive all speed dial items
  const items = useMemo<SpeedDialItem[]>(() => {
    if (customItems && customItems.length > 0) {
      return [...customItems];
    }
    if (customTracks && customTracks.length > 0) {
      return customTracks.map((track) => ({ kind: "track" as const, item: track }));
    }
    const historyTracks = libraryState.library?.recentlyPlayed ?? [];
    return historyTracks.map((track) => ({ kind: "track" as const, item: track }));
  }, [customItems, customTracks, libraryState.library?.recentlyPlayed]);

  // Extract all tracks for Play All / Shuffle
  const allTracks = useMemo<Track[]>(() => {
    return items
      .filter((entry): entry is { kind: "track"; item: Track } => entry.kind === "track")
      .map((entry) => entry.item);
  }, [items]);

  const playAll = (shuffle = false) => {
    if (allTracks.length === 0) return;
    if (shuffle) {
      const shuffled = [...allTracks].sort(() => Math.random() - 0.5);
      void playerController.playTrackById(shuffled[0].id, shuffled, true);
    } else {
      void playerController.playTrackById(allTracks[0].id, allTracks, true);
    }
  };

  const handleItemClick = (entry: SpeedDialItem) => {
    switch (entry.kind) {
      case "track":
        void playerController.playTrackById(entry.item.id);
        break;
      case "album":
        onOpenAlbum?.(entry.item);
        break;
      case "playlist":
        onOpenPlaylist?.(entry.item);
        break;
      case "artist":
        onOpenArtist?.(entry.item);
        break;
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ── Top Header ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-card hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Back"
          >
            <ArrowLeftIcon size={22} />
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Speed dial
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {allTracks.length > 0 && (
            <button
              type="button"
              onClick={() => playAll(true)}
              className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-95 border border-white/5"
              aria-label="Shuffle playback"
            >
              <ShuffleIcon size={14} />
              <span className="hidden sm:inline">Shuffle</span>
            </button>
          )}

          <AccountAvatar
            artworkUrl={account?.artworkUrl}
            className="size-9 rounded-full border border-white/10 shadow-xs"
            iconSize={18}
          />
        </div>
      </header>

      {/* ── Grid of Mixed Speed Dial Items ─────────────────────────────── */}
      {items.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <p className="text-base font-semibold text-foreground">No speed dial items yet</p>
          <p className="text-xs">Songs, albums and artists you listen to on YouTube Music will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {items.map((entry, index) => {
            const isTrack = entry.kind === "track";
            const isArtist = entry.kind === "artist";
            const isAlbum = entry.kind === "album";
            const isPlaylist = entry.kind === "playlist";

            const title = isArtist ? entry.item.name : entry.item.title;
            const isCurrent = isTrack && currentTrackId === entry.item.id;

            let subtitle = "Song";
            if (isTrack) {
              subtitle = `Song • ${entry.item.artist || "Unknown Artist"}`;
            } else if (isAlbum) {
              subtitle = `Album • ${entry.item.artist || "Unknown Artist"}`;
            } else if (isPlaylist) {
              subtitle = `Playlist • ${entry.item.owner || "YouTube Music"}`;
            } else if (isArtist) {
              subtitle = "Artist";
            }

            return (
              <div
                key={`${entry.kind}-${entry.item.id || index}`}
                role="button"
                tabIndex={0}
                onClick={() => handleItemClick(entry)}
                onMouseEnter={() => {
                  if (isTrack) playerController.warmTrack(entry.item);
                }}
                onTouchStart={() => {
                  if (isTrack) playerController.warmTrack(entry.item);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleItemClick(entry);
                  }
                }}
                onContextMenu={(e) => {
                  if (isTrack) openTrackMenu(e, entry.item);
                }}
                className="group flex flex-col gap-2 rounded-2xl p-2 select-none cursor-pointer text-left transition-all duration-150 hover:bg-card/75 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* Artwork */}
                <div
                  className={cn(
                    "relative aspect-square w-full overflow-hidden bg-muted/40 shadow-sm border border-white/5",
                    isArtist ? "rounded-full" : "rounded-2xl",
                  )}
                >
                  <TrackArtwork
                    artworkUrl={entry.item.artworkUrl}
                    size={280}
                    iconSize={36}
                    variant={isArtist ? "artist" : "album"}
                    className={cn(
                      "size-full object-cover transition-transform duration-300 group-hover:scale-105",
                      isArtist && "rounded-full",
                    )}
                  />

                  {/* Playing Pulse or Hover Play Button for Track */}
                  {isTrack && isCurrent && isPlaying ? (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="size-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg animate-pulse">
                        <PlayActiveIcon size={20} className="translate-x-0.5" />
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="size-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <PlayActiveIcon size={20} className="translate-x-0.5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex items-start justify-between gap-1.5 min-w-0">
                  <div className="flex flex-1 flex-col min-w-0 gap-0.5">
                    <span
                      className={cn(
                        "truncate text-sm font-semibold tracking-tight transition-colors",
                        isCurrent ? "text-primary" : "text-foreground group-hover:text-primary",
                      )}
                    >
                      {title}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {subtitle}
                    </span>
                  </div>

                  {isTrack && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTrackMenu(e, entry.item);
                      }}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground active:scale-90 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="More options"
                    >
                      <MenuDotsIcon size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
