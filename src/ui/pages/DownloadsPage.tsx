import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  CloseIcon,
  CompassIcon,
  DownloadIcon,
  PlayActiveIcon,
  SearchIcon,
  ShuffleIcon,
  TrashIcon,
} from "@/ui/icons";
import type { Album, Artist, Playlist, Track } from "../../datasource/types";
import type { LibraryController } from "../../player/LibraryController";
import type { PlayerControllerActions } from "../../player/playerStore";
import {
  cancelDownload,
  DEFAULT_OFFLINE_MAX_BYTES,
  getOfflineMaxBytes,
  removeAllDownloads,
  useOfflineState,
} from "../../player/offlineStore";
import { TrackRow } from "../components/TrackRow";
import { TrackArtwork } from "../components/TrackArtwork";
import { useTrackContextMenu } from "../components/TrackContextMenu";
import { useNowPlaying } from "../hooks/useNowPlaying";

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

interface DownloadsPageProps {
  playerController: PlayerControllerActions;
  libraryController: LibraryController;
  onOpenAlbum?: (album: Album) => void;
  onOpenArtist?: (artist: Artist) => void;
  onOpenPlaylist?: (playlist: Playlist) => void;
  onOpenBrowse?: () => void;
}

export function DownloadsPage({
  playerController,
  libraryController: _libraryController,
  onOpenAlbum: _onOpenAlbum,
  onOpenArtist: _onOpenArtist,
  onOpenPlaylist: _onOpenPlaylist,
  onOpenBrowse,
}: DownloadsPageProps) {
  const offline = useOfflineState();
  const maxBytes = getOfflineMaxBytes() || DEFAULT_OFFLINE_MAX_BYTES;
  const [query, setQuery] = useState("");
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
  const { currentTrackId, isPlaying } = useNowPlaying();
  const { openTrackMenu, openPlaylistPicker } = useTrackContextMenu();

  const downloads = useMemo(
    () =>
      Object.values(offline.entries).sort(
        (left, right) => right.downloadedAt - left.downloadedAt,
      ),
    [offline.entries],
  );

  const inFlight = useMemo(() => {
    const ids = [
      ...(offline.downloadingId ? [offline.downloadingId] : []),
      ...offline.queued,
    ];
    return ids
      .map((id) => offline.pending[id])
      .filter((track): track is NonNullable<typeof track> => Boolean(track));
  }, [offline.downloadingId, offline.pending, offline.queued]);

  const filteredDownloads = useMemo(() => {
    if (!query.trim()) return downloads;
    const lower = query.trim().toLowerCase();
    return downloads.filter(
      (entry) =>
        entry.track.title.toLowerCase().includes(lower) ||
        entry.track.artist?.toLowerCase().includes(lower) ||
        entry.track.album?.toLowerCase().includes(lower),
    );
  }, [downloads, query]);

  const usedPercent = Math.min(100, Math.round((offline.usedBytes / maxBytes) * 100));

  const playAllDownloads = (shuffle = false) => {
    if (downloads.length === 0) return;
    const tracks = downloads.map((entry) => entry.track);
    if (shuffle) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      void playerController.playTrackById(shuffled[0].id, shuffled);
    } else {
      void playerController.playTrackById(tracks[0].id, tracks);
    }
  };

  const playTrack = (track: Track) => {
    const allTracks = downloads.map((item) => item.track);
    void playerController.playTrackById(track.id, allTracks.length > 0 ? allTracks : [track]);
  };

  return (
    <div className="flex flex-col gap-6 pb-40 md:pb-12 w-full max-w-full">
      {/* ── Systematic Page Header ── */}
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <DownloadIcon size={20} aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Downloads
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground pl-0.5">
          Offline library · {downloads.length} {downloads.length === 1 ? "song" : "songs"} ·{" "}
          {formatBytes(offline.usedBytes)} used
          {inFlight.length > 0 ? ` · ${inFlight.length} in progress` : ""}
        </p>
      </header>

      {/* ── Empty State ── */}
      {downloads.length === 0 && inFlight.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-card border border-border/50 text-primary shadow-sm">
            <DownloadIcon size={38} aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1.5 max-w-sm">
            <h2 className="text-lg font-bold text-foreground">No downloaded music</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Download your favorite tracks and albums to listen offline anytime, anywhere, with zero
              data usage.
            </p>
          </div>
          {onOpenBrowse && (
            <button
              type="button"
              onClick={onOpenBrowse}
              className="mt-2 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95 hover:bg-primary/90"
            >
              <CompassIcon size={16} />
              <span>Explore Music</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── Systematic Storage & Playback Action Card ── */}
          <div className="flex flex-col gap-4 rounded-2xl bg-card/75 border border-border/40 p-4 sm:p-5 shadow-xs">
            {/* Header with Title and Remove All */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-base font-bold text-foreground">Offline Storage</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatBytes(offline.usedBytes)} of {formatBytes(maxBytes)} allocated ({usedPercent}%)
                  {offline.downloadingId
                    ? offline.progress !== null
                      ? ` · downloading ${offline.progress}%`
                      : " · downloading"
                    : ""}
                </span>
              </div>

              {downloads.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirmRemoveAll) {
                      void removeAllDownloads();
                      setConfirmRemoveAll(false);
                      return;
                    }
                    setConfirmRemoveAll(true);
                  }}
                  onBlur={() => setConfirmRemoveAll(false)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all shrink-0 select-none",
                    confirmRemoveAll
                      ? "bg-destructive text-destructive-foreground shadow-sm shadow-destructive/20 animate-pulse"
                      : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20",
                  )}
                >
                  <TrashIcon size={14} />
                  <span>{confirmRemoveAll ? "Confirm Remove All" : "Remove All"}</span>
                </button>
              )}
            </div>

            {/* Storage Meter Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${Math.max(2, usedPercent)}%` }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>

            {/* Play All & Shuffle Buttons */}
            {downloads.length > 0 && (
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => playAllDownloads(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98] hover:bg-primary/90"
                >
                  <PlayActiveIcon size={16} />
                  <span>Play All</span>
                </button>
                <button
                  type="button"
                  onClick={() => playAllDownloads(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-card py-2.5 px-4 text-sm font-semibold text-foreground border border-border/50 transition-transform active:scale-[0.98] hover:bg-muted"
                  aria-label="Shuffle all downloaded songs"
                >
                  <ShuffleIcon size={16} />
                  <span>Shuffle</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Active In-Flight Downloads Section ── */}
          {inFlight.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>Downloading</span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.2 text-xs font-semibold text-primary tabular-nums">
                    {inFlight.length}
                  </span>
                </h2>
              </div>

              <div className="flex flex-col gap-1.5">
                {inFlight.map((track, index) => {
                  const isActive = offline.downloadingId === track.id;
                  const progress = isActive ? offline.progress : null;

                  return (
                    <div
                      key={`pending:${track.id}`}
                      className="flex items-center gap-3 rounded-xl bg-card/50 border border-border/30 p-2.5"
                    >
                      <TrackArtwork
                        className="size-10 shrink-0 rounded-lg"
                        size={40}
                        artworkUrl={track.artworkUrl}
                        iconSize={18}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-xs font-medium text-foreground">
                          {track.title}
                        </span>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>
                            {isActive
                              ? progress !== null
                                ? `Downloading ${progress}%`
                                : "Downloading..."
                              : `Queued (${index + 1} of ${inFlight.length})`}
                          </span>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full bg-primary transition-all duration-300",
                              progress === null && "w-1/3 animate-pulse",
                            )}
                            style={progress !== null ? { width: `${progress}%` } : undefined}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => cancelDownload(track.id)}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Cancel download"
                        aria-label={`Cancel download of ${track.title}`}
                      >
                        <CloseIcon size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Downloaded Songs Section ── */}
          {downloads.length > 0 && (
            <section className="flex flex-col gap-3">
              {/* Optional Search Bar when many tracks */}
              {downloads.length > 4 && (
                <div className="relative w-full">
                  <SearchIcon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search downloaded songs..."
                    className="w-full rounded-xl bg-card/60 border border-border/40 pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Systematic Song Rows */}
              <div className="flex flex-col divide-y divide-border/10 rounded-2xl bg-card/25 border border-border/30 overflow-hidden">
                <AnimatePresence initial={false}>
                  {filteredDownloads.map((entry, index) => (
                    <TrackRow
                      key={entry.track.id}
                      track={entry.track}
                      index={index}
                      isCurrent={currentTrackId === entry.track.id}
                      isPlaying={isPlaying && currentTrackId === entry.track.id}
                      onSelect={() => playTrack(entry.track)}
                      onContextMenu={(event) => openTrackMenu(event, entry.track)}
                      onQuickAdd={() => openPlaylistPicker(entry.track)}
                      onQuickAddToQueue={() => playerController.addToQueue(entry.track)}
                      showDownload
                      showRating
                      trailing={
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatBytes(entry.byteLength)}
                        </span>
                      }
                    />
                  ))}
                </AnimatePresence>

                {filteredDownloads.length === 0 && query && (
                  <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No downloaded songs matching &ldquo;{query}&rdquo;.
                  </p>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
