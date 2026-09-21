import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Album, Artist, Playlist, Track } from "../../datasource/types";
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
  speedDialTracks: customTracks,
  onBack,
  onOpenAlbum: _onOpenAlbum,
  onOpenArtist: _onOpenArtist,
  onOpenPlaylist: _onOpenPlaylist,
}: SpeedDialPageProps) {
  const { currentTrackId, isPlaying } = useNowPlaying();
  const { openTrackMenu } = useTrackContextMenu();

  const account = libraryState.library?.account;

  // Derive all speed dial tracks from custom prop, recentlyPlayed, etc.
  const tracks = useMemo<Track[]>(() => {
    if (customTracks && customTracks.length > 0) {
      return [...customTracks];
    }
    return libraryState.library?.recentlyPlayed ?? [];
  }, [customTracks, libraryState.library?.recentlyPlayed]);

  const playAll = (shuffle = false) => {
    if (tracks.length === 0) return;
    if (shuffle) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      void playerController.playTrackById(shuffled[0].id, shuffled, true);
    } else {
      void playerController.playTrackById(tracks[0].id, tracks, true);
    }
  };

  const playTrack = (track: Track) => {
    void playerController.playTrackById(track.id);
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
          {tracks.length > 0 && (
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

      {/* ── Grid of Songs ──────────────────────────────────────────────── */}
      {tracks.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
          <p className="text-base font-semibold text-foreground">No speed dial songs yet</p>
          <p className="text-xs">Songs you listen to on YouTube Music will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {tracks.map((track) => {
            const isCurrent = currentTrackId === track.id;

            return (
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
                className="group flex flex-col gap-2 rounded-2xl p-2 select-none cursor-pointer text-left transition-all duration-150 hover:bg-card/75 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* Square Artwork */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-muted/40 shadow-sm border border-white/5">
                  <TrackArtwork
                    artworkUrl={track.artworkUrl}
                    size={280}
                    iconSize={36}
                    variant="album"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Playing Pulse or Hover Play Button */}
                  {isCurrent && isPlaying ? (
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
                      {track.title}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      Song • {track.artist || "Unknown Artist"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTrackMenu(e, track);
                    }}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground active:scale-90 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="More options"
                  >
                    <MenuDotsIcon size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
