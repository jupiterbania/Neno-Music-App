import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlbumActiveIcon,
  MusicNoteActiveIcon,
  PlayActiveIcon,
  PlaylistActiveIcon,
  SearchIcon,
  ShuffleIcon,
  UserActiveIcon,
} from "@/ui/icons";
import { SpinnerSteps } from "@/components/motion/loader";
import type {
  Album,
  Artist,
  Playlist,
  SearchCategory,
  SearchResults,
  Track,
} from "../../datasource/types";
import {
  libraryController,
  type PlayerControllerActions,
} from "../../player/playerStore";
import { useNowPlaying } from "../hooks/useNowPlaying";
import { AlbumCard } from "../components/AlbumCard";
import { ArtistLinks } from "../components/ArtistLinks";
import { TrackArtwork } from "../components/TrackArtwork";
import { TrackRow } from "../components/TrackRow";
import { TrackListSkeleton, AlbumGridSkeleton } from "../components/Skeleton";
import { usePlaylistContextMenu } from "../components/PlaylistContextMenu";
import { useTrackContextMenu } from "../components/TrackContextMenu";

type SelectableItem =
  | { kind: "track"; track: Track }
  | { kind: "artist"; artist: Artist }
  | { kind: "album"; album: Album }
  | { kind: "playlist"; playlist: Playlist };

type SearchScope = "all" | "songs" | "artists" | "albums" | "playlists";

const SCOPES: Array<{
  value: SearchScope;
  label: string;
  field: keyof SearchResults;
  category?: SearchCategory;
}> = [
  { value: "all", label: "All", field: "tracks" },
  { value: "songs", label: "Songs", field: "tracks", category: "song" },
  { value: "artists", label: "Artists", field: "artists", category: "artist" },
  { value: "albums", label: "Albums", field: "albums", category: "album" },
  { value: "playlists", label: "Playlists", field: "playlists", category: "playlist" },
];

const EMPTY_RESULTS: SearchResults = { artists: [], tracks: [], albums: [], playlists: [] };

function buildFlatItems(results: SearchResults): SelectableItem[] {
  const items: SelectableItem[] = [];
  // Strict hierarchy: Songs first, then Artists, then Albums, then Playlists
  for (const track of results.tracks) items.push({ kind: "track", track });
  for (const artist of results.artists) items.push({ kind: "artist", artist });
  for (const album of results.albums) items.push({ kind: "album", album });
  for (const playlist of results.playlists) items.push({ kind: "playlist", playlist });
  return items;
}

function ArtistGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:[grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col items-center gap-2.5 rounded-2xl bg-card/25 p-4 border border-border/20 animate-pulse"
        >
          <div
            className="size-24 sm:size-28 rounded-full bg-foreground/10"
            style={{ animationDelay: `${index * 60}ms` }}
          />
          <div
            className="h-4 w-24 rounded-md bg-foreground/10 mt-1"
            style={{ animationDelay: `${index * 60}ms` }}
          />
          <div
            className="h-3 w-16 rounded-md bg-foreground/10"
            style={{ animationDelay: `${index * 60}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

export function SearchResultsPage({
  query,
  results,
  isLoading,
  playerController,
  onPlayTrack,
  onOpenArtist,
  onOpenAlbum,
  onOpenPlaylist,
}: {
  query: string;
  results: SearchResults;
  isLoading: boolean;
  playerController: PlayerControllerActions;
  onPlayTrack?: (track: Track) => Promise<void> | void;
  onOpenArtist: (artist: Artist) => void;
  onOpenAlbum: (album: Album) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
}) {
  const { openTrackMenu, openPlaylistPicker } = useTrackContextMenu();
  const { openPlaylistMenu, openAlbumMenu } = usePlaylistContextMenu();
  const [scope, setScope] = useState<SearchScope>("all");

  const { currentTrackId, isPlaying: isCurrentPlaying } = useNowPlaying();

  useEffect(() => setScope("all"), [query]);

  const [deepResults, setDeepResults] = useState<SearchResults | null>(null);
  const [isDeepLoading, setIsDeepLoading] = useState(false);
  const deepCacheRef = useRef<Map<string, SearchResults>>(new Map());

  useEffect(() => {
    const category = SCOPES.find((item) => item.value === scope)?.category;
    if (!category || !query.trim()) {
      setDeepResults(null);
      setIsDeepLoading(false);
      return;
    }

    const cacheKey = `${query.trim().toLowerCase()}:${category}`;
    const cached = deepCacheRef.current.get(cacheKey);
    if (cached) {
      setDeepResults(cached);
      setIsDeepLoading(false);
      return;
    }

    let active = true;
    setIsDeepLoading(true);
    void libraryController
      .searchCategory(query, category, (progressive) => {
        if (!active) return;
        setDeepResults(progressive);
      })
      .then((fetched) => {
        if (!active) return;
        deepCacheRef.current.set(cacheKey, fetched);
        setDeepResults(fetched);
      })
      .catch(() => {
        if (active) setDeepResults(null);
      })
      .finally(() => {
        if (active) setIsDeepLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, scope]);

  const scopedResults = useMemo<SearchResults>(() => {
    if (scope === "all") return results;

    const source = deepResults ?? results;
    const narrowed: SearchResults = {
      artists: scope === "artists" ? source.artists : [],
      tracks: scope === "songs" ? source.tracks : [],
      albums: scope === "albums" ? source.albums : [],
      playlists: scope === "playlists" ? source.playlists : [],
    };
    const total =
      narrowed.artists.length +
      narrowed.tracks.length +
      narrowed.albums.length +
      narrowed.playlists.length;
    return total > 0 || !deepResults
      ? narrowed
      : {
          ...EMPTY_RESULTS,
          artists: scope === "artists" ? results.artists : [],
          tracks: scope === "songs" ? results.tracks : [],
          albums: scope === "albums" ? results.albums : [],
          playlists: scope === "playlists" ? results.playlists : [],
        };
  }, [deepResults, results, scope]);

  const availableScopes = useMemo(
    () =>
      SCOPES.filter(
        (item) => item.value === "all" || results[item.field].length > 0,
      ),
    [results],
  );

  const totalResultsCount =
    scopedResults.artists.length +
    scopedResults.tracks.length +
    scopedResults.albums.length +
    scopedResults.playlists.length;
  const hasResults = totalResultsCount > 0;

  const playTrack = useCallback(
    (track: Track) => {
      if (onPlayTrack) void onPlayTrack(track);
      else void playerController.playTrackById(track.id, scopedResults.tracks, true);
    },
    [onPlayTrack, playerController, scopedResults.tracks],
  );

  const playAllSongs = useCallback(() => {
    if (scopedResults.tracks.length > 0) {
      playTrack(scopedResults.tracks[0]);
    }
  }, [playTrack, scopedResults.tracks]);

  const shuffleSongs = useCallback(() => {
    if (scopedResults.tracks.length > 0) {
      const randomIndex = Math.floor(Math.random() * scopedResults.tracks.length);
      playerController.setShuffleEnabled(true);
      playTrack(scopedResults.tracks[randomIndex]);
    }
  }, [playTrack, playerController, scopedResults.tracks]);

  const flatItems = useMemo(() => buildFlatItems(scopedResults), [scopedResults]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isKeyboardNav, setIsKeyboardNav] = useState(false);

  useEffect(() => {
    setSelectedIndex(0);
    setIsKeyboardNav(false);
  }, [results]);

  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const flatItemsRef = useRef(flatItems);
  flatItemsRef.current = flatItems;
  const hasResultsRef = useRef(hasResults);
  hasResultsRef.current = hasResults;
  const resultsRef = useRef(results);
  resultsRef.current = results;

  const onOpenArtistRef = useRef(onOpenArtist);
  onOpenArtistRef.current = onOpenArtist;
  const onOpenAlbumRef = useRef(onOpenAlbum);
  onOpenAlbumRef.current = onOpenAlbum;
  const onOpenPlaylistRef = useRef(onOpenPlaylist);
  onOpenPlaylistRef.current = onOpenPlaylist;
  const onPlayTrackRef = useRef(onPlayTrack);
  onPlayTrackRef.current = onPlayTrack;
  const playerControllerRef = useRef(playerController);
  playerControllerRef.current = playerController;

  useEffect(() => {
    if (isLoading || !hasResultsRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
        return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIsKeyboardNav(true);
        setSelectedIndex((prev) => Math.min(prev + 1, flatItemsRef.current.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIsKeyboardNav(true);
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const item = flatItemsRef.current[selectedIndexRef.current];
        if (!item) return;
        event.preventDefault();
        switch (item.kind) {
          case "track": {
            const track = item.track;
            if (onPlayTrackRef.current) {
              void onPlayTrackRef.current(track);
            } else {
              void playerControllerRef.current.playTrackById(
                track.id,
                resultsRef.current.tracks,
                true,
              );
            }
            break;
          }
          case "artist":
            onOpenArtistRef.current(item.artist);
            break;
          case "album":
            onOpenAlbumRef.current(item.album);
            break;
          case "playlist":
            onOpenPlaylistRef.current(item.playlist);
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading]);

  useEffect(() => {
    if (!isKeyboardNav) return;
    const el = document.querySelector(`[data-selectable-index="${selectedIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, isKeyboardNav]);

  const handleMouseEnter = useCallback((index: number) => {
    setIsKeyboardNav(false);
    setSelectedIndex(index);
  }, []);

  const selected = useCallback(
    (index: number) =>
      isKeyboardNav && index === selectedIndex ? "bg-primary/15 ring-1 ring-primary/40" : "",
    [isKeyboardNav, selectedIndex],
  );

  const selectedAlbumCard = useCallback(
    (index: number) =>
      isKeyboardNav && index === selectedIndex ? "ring-2 ring-primary/60 rounded-xl" : "",
    [isKeyboardNav, selectedIndex],
  );

  const enterStyle = useCallback(
    (index: number) =>
      ({
        "--search-enter-delay": `${Math.min(Math.max(index, 0), 18) * 20}ms`,
      }) as CSSProperties,
    [],
  );

  return (
    <div className="flex flex-col gap-6 pb-44 md:pb-16 px-1 sm:px-2">
      {/* ── Search Header & Scope Tabs ── */}
      <header className="flex flex-col gap-3 pt-1">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Search Results
            </span>
            {!isLoading && totalResultsCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {totalResultsCount} found
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground truncate">
            &ldquo;{query}&rdquo;
          </h1>
        </div>

        {/* Filter Pills - Horizontally scrollable for mobile phone users */}
        {availableScopes.length > 2 && (
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar overscroll-x-contain select-none"
            role="tablist"
            aria-label="Filter results"
          >
            {availableScopes.map((item) => {
              const isActive = scope === item.value;
              const count =
                item.value === "all"
                  ? results.tracks.length +
                    results.artists.length +
                    results.albums.length +
                    results.playlists.length
                  : results[item.field].length;

              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setScope(item.value)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card/80 border border-border/40 text-muted-foreground hover:bg-card hover:text-foreground",
                  )}
                >
                  <span>{item.label}</span>
                  {count > 0 && item.value !== "all" && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold",
                        isActive ? "bg-black/20 text-white" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── Main Content Area ── */}
      {isLoading || (isDeepLoading && !hasResults) ? (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <div className="h-6 w-28 rounded-md bg-foreground/10 animate-pulse" />
            <TrackListSkeleton count={6} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-6 w-28 rounded-md bg-foreground/10 animate-pulse" />
            <ArtistGridSkeleton count={4} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-6 w-28 rounded-md bg-foreground/10 animate-pulse" />
            <AlbumGridSkeleton count={4} />
          </div>
        </div>
      ) : !hasResults ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-card border border-border/40 text-muted-foreground">
            <SearchIcon size={26} />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <p className="text-base font-semibold text-foreground">No results found</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We couldn&rsquo;t find anything for &ldquo;{query}&rdquo;. Check your spelling or try
              searching with different keywords.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* ════════════ 1. SONGS SECTION (FIRST PRIORITY) ════════════ */}
          {scopedResults.tracks.length > 0 && (
            <section className="flex flex-col gap-3">
              {/* Songs Header with Quick Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MusicNoteActiveIcon size={18} />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">Songs</h2>
                  <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {scopedResults.tracks.length}
                  </span>
                  {scope === "all" && (
                    <button
                      type="button"
                      onClick={() => setScope("songs")}
                      className="ml-1 text-xs font-bold text-primary hover:underline active:scale-95 transition-transform"
                    >
                      See all
                    </button>
                  )}
                  {isDeepLoading && scope === "songs" && (
                    <div className="flex items-center gap-1.5 ml-2 text-xs font-semibold text-primary animate-pulse">
                      <SpinnerSteps size={14} color="currentColor" />
                      <span className="hidden sm:inline">Loading more songs...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={playAllSongs}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95 hover:opacity-90"
                    title="Play all search tracks"
                  >
                    <PlayActiveIcon size={14} />
                    <span>Play All</span>
                  </button>

                  <button
                    type="button"
                    onClick={shuffleSongs}
                    className="flex items-center gap-1.5 rounded-full bg-card border border-border/40 px-3 py-1.5 text-xs font-medium text-foreground transition-all active:scale-95 hover:bg-muted"
                    title="Shuffle search results"
                  >
                    <ShuffleIcon size={14} />
                    <span className="hidden sm:inline">Shuffle</span>
                  </button>
                </div>
              </div>

              {/* Systematic Track List */}
              <div
                className="flex flex-col divide-y divide-border/10 rounded-2xl bg-card/25 border border-border/30 overflow-hidden"
                data-onboarding="search-results"
              >
                {scopedResults.tracks.map((track, displayIndex) => {
                  const index = flatItems.findIndex(
                    (item) => item.kind === "track" && item.track.id === track.id,
                  );
                  const isCurrent = track.id === currentTrackId;
                  const isPlaying = isCurrent && isCurrentPlaying;

                  return (
                    <div
                      key={track.id}
                      data-selectable-index={index}
                      className={cn(
                        "animate-in fade-in transition-colors",
                        selected(index),
                      )}
                      style={enterStyle(index)}
                      onMouseEnter={() => handleMouseEnter(index)}
                    >
                      <TrackRow
                        track={track}
                        index={displayIndex}
                        isCurrent={isCurrent}
                        isPlaying={isPlaying}
                        showArtwork={true}
                        showAlbum={true}
                        showDownload={true}
                        showRating={true}
                        onSelect={() => playTrack(track)}
                        onContextMenu={(event) => openTrackMenu(event, track)}
                        onQuickAddToQueue={() => playerController.addToQueue(track)}
                        onQuickAdd={() => openPlaylistPicker(track)}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Bottom live indicator for streaming category results */}
              {isDeepLoading && scope === "songs" && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-muted-foreground animate-pulse">
                  <SpinnerSteps size={16} color="currentColor" />
                  <span>Loading full catalog of songs from YouTube Music...</span>
                </div>
              )}
            </section>
          )}

          {/* ════════════ 2. ARTISTS SECTION (SECOND PRIORITY) ════════════ */}
          {scopedResults.artists.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <UserActiveIcon size={18} />
                  </div>
                  <h2 className="text-lg font-bold text-foreground">Artists</h2>
                  <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {scopedResults.artists.length}
                  </span>
                  {scope === "all" && (
                    <button
                      type="button"
                      onClick={() => setScope("artists")}
                      className="ml-1 text-xs font-bold text-primary hover:underline active:scale-95 transition-transform"
                    >
                      See all
                    </button>
                  )}
                  {isDeepLoading && scope === "artists" && (
                    <div className="flex items-center gap-1.5 ml-2 text-xs font-semibold text-primary animate-pulse">
                      <SpinnerSteps size={14} color="currentColor" />
                      <span className="hidden sm:inline">Loading more artists...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Advanced Structured Artist Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:[grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr))]">
                {scopedResults.artists.map((artist) => {
                  const index = flatItems.findIndex(
                    (item) => item.kind === "artist" && item.artist.id === artist.id,
                  );
                  return (
                    <button
                      key={artist.id}
                      type="button"
                      data-selectable-index={index}
                      className={cn(
                        "group/artist relative flex flex-col items-center rounded-2xl bg-card/40 border border-border/30 p-3.5 sm:p-4 text-center transition-all duration-200",
                        "active:scale-95 hover:bg-card hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                        "animate-in fade-in",
                        selected(index),
                      )}
                      style={enterStyle(index)}
                      onClick={() => onOpenArtist(artist)}
                      onMouseEnter={() => handleMouseEnter(index)}
                    >
                      {/* Circular Avatar Container with Ambient Glow Ring */}
                      <div className="relative size-24 sm:size-28 shrink-0">
                        <TrackArtwork
                          className="size-full rounded-full object-cover shadow-md ring-2 ring-border/40 group-hover/artist:ring-primary/80 group-hover/artist:shadow-[0_0_24px_rgba(255,0,51,0.35)] transition-all duration-300"
                          size={112}
                          artworkUrl={artist.artworkUrl}
                          iconSize={44}
                          variant="artist"
                          preferProxy
                        />
                        {/* Play Badge Icon on Hover / Active */}
                        <div className="pointer-events-none absolute bottom-0 right-0 grid size-8 sm:size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg opacity-90 sm:opacity-0 group-hover/artist:opacity-100 group-hover/artist:scale-105 transition-all duration-200">
                          <PlayActiveIcon size={16} />
                        </div>
                      </div>

                      {/* Artist Info */}
                      <strong className="mt-3 w-full truncate text-sm sm:text-base font-bold text-foreground group-hover/artist:text-primary transition-colors">
                        {artist.name}
                      </strong>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                        Artist
                      </span>
                      <span className="mt-1 w-full truncate text-xs text-muted-foreground">
                        {artist.subscriberCount || "Artist Profile"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ════════════ 3. ALBUMS SECTION ════════════ */}
          {scopedResults.albums.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <AlbumActiveIcon size={18} />
                </div>
                <h2 className="text-lg font-bold text-foreground">Albums</h2>
                <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {scopedResults.albums.length}
                </span>
                {scope === "all" && (
                  <button
                    type="button"
                    onClick={() => setScope("albums")}
                    className="ml-1 text-xs font-bold text-primary hover:underline active:scale-95 transition-transform"
                  >
                    See all
                  </button>
                )}
                {isDeepLoading && scope === "albums" && (
                  <div className="flex items-center gap-1.5 ml-2 text-xs font-semibold text-primary animate-pulse">
                    <SpinnerSteps size={14} color="currentColor" />
                    <span className="hidden sm:inline">Loading more albums...</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:[grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))]">
                {scopedResults.albums.map((album) => {
                  const index = flatItems.findIndex(
                    (item) => item.kind === "album" && item.album.id === album.id,
                  );
                  return (
                    <div
                      key={album.id}
                      data-selectable-index={index}
                      className={cn(
                        "animate-in fade-in transition-all active:scale-95",
                        selectedAlbumCard(index),
                      )}
                      style={enterStyle(index)}
                      onMouseEnter={() => handleMouseEnter(index)}
                    >
                      <AlbumCard
                        artworkUrl={album.artworkUrl}
                        title={album.title}
                        subtitleContent={
                          <ArtistLinks artists={album.artists} fallback={album.artist} />
                        }
                        onClick={() => onOpenAlbum(album)}
                        onContextMenu={(event) => openAlbumMenu(event, album)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ════════════ 4. PLAYLISTS SECTION ════════════ */}
          {scopedResults.playlists.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PlaylistActiveIcon size={18} />
                </div>
                <h2 className="text-lg font-bold text-foreground">Playlists</h2>
                <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {scopedResults.playlists.length}
                </span>
                {scope === "all" && (
                  <button
                    type="button"
                    onClick={() => setScope("playlists")}
                    className="ml-1 text-xs font-bold text-primary hover:underline active:scale-95 transition-transform"
                  >
                    See all
                  </button>
                )}
                {isDeepLoading && scope === "playlists" && (
                  <div className="flex items-center gap-1.5 ml-2 text-xs font-semibold text-primary animate-pulse">
                    <SpinnerSteps size={14} color="currentColor" />
                    <span className="hidden sm:inline">Loading more playlists...</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:[grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))]">
                {scopedResults.playlists.map((playlist) => {
                  const index = flatItems.findIndex(
                    (item) => item.kind === "playlist" && item.playlist.id === playlist.id,
                  );
                  return (
                    <div
                      key={playlist.id}
                      data-selectable-index={index}
                      className={cn(
                        "animate-in fade-in transition-all active:scale-95",
                        selectedAlbumCard(index),
                      )}
                      style={enterStyle(index)}
                      onMouseEnter={() => handleMouseEnter(index)}
                    >
                      <AlbumCard
                        artworkUrl={playlist.artworkUrl}
                        title={playlist.title}
                        subtitle={playlist.owner}
                        onClick={() => onOpenPlaylist(playlist)}
                        onContextMenu={(event) => openPlaylistMenu(event, playlist)}
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

