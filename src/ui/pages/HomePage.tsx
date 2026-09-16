import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CylinderCarousel } from "@/components/motion/cylinder-carousel";
import { PlayActiveIcon, RefreshIcon } from "@/ui/icons";
import { cn } from "@/lib/utils";
import type { Album, Artist, BrowsePage, Playlist, Track } from "../../datasource/types";
import type { LibraryController, LibraryState } from "../../player/LibraryController";
import type { PlayerControllerActions } from "../../player/playerStore";
import type { SearchController } from "../../player/SearchController";
import { AlbumCard } from "../components/AlbumCard";
import { DiceCard } from "../components/DiceCard";
import { PickCard } from "../components/PickCard";
import { TrackArtwork } from "../components/TrackArtwork";
import { useTrackContextMenu } from "../components/TrackContextMenu";
import { HomeDestinations, type HomeDestinationHandlers } from "../components/HomeDestinations";
import { ArtistLinks } from "../components/ArtistLinks";
import { BrowseShelves } from "../components/BrowseShelves";
import { usePlayHistory } from "../../player/playHistory";
import { useMadeForYouVisible, useYtmHomeFeedVisible } from "../settings/homeSections";
import { AlbumGridSkeleton, PickCardSkeleton } from "../components/Skeleton";
import { useIsMobile } from "../hooks/useIsMobile";
import { MobileHeader } from "../components/mobile/MobileHeader";
import { logInternalError } from "../../internal/logging";

const FALLBACK_QUERIES = [
  "new music",
  "popular songs",
  "indie mix",
  "electronic mix",
  "late night music",
  "discover weekly",
];

/*
 * The carousel hands each item a square slot; PickCard is portrait and centres itself inside
 * it, so PICKS_ITEM_SIZE is the card's *height* and the width follows from PICKS_ASPECT.
 * Telling the carousel that aspect (see `itemAspect`) is what lets the cards grow this
 * large: without it the fit rule reserves width for a square the card never fills.
 */
const PICKS_ASPECT = 3 / 4;
const PICKS_VISIBLE_ITEMS = 5;
const PICKS_ITEM_SIZE = 250;
/** How far the carousel shrinks its edge cards. */
const PICKS_MIN_SCALE = 0.72;

/*
 * Skeleton slots to feed the carousel while suggestions load. Unlike the other loading counts on
 * this page, there is no real count to match here — `topSuggestions` does not exist yet — so
 * this is just enough for the wraparound to feel like a shelf rather than three cards rattling
 * around an empty drum.
 */
const PICKS_SKELETON_COUNT = 8;

/*
 * Curve depth. The default is 35% of the item size, which on cards this large lifts the
 * centre ones ~38px above the midline — past the stage's clip-path, so their tops get cut.
 * A flatter arc keeps the cylinder legible and the row inside its box.
 */
const PICKS_ARC = 68;

/*
 * Stage height must clear the tallest thing that can happen: the card, plus half the arc
 * (convex raises the centre cards), plus the hover lift. Sized so nothing reaches the clip
 * edge rather than exactly hugging the card.
 */
const PICKS_STAGE_HEIGHT = PICKS_ITEM_SIZE + PICKS_ARC ;

/*
 * How each section is sliced from the underlying lists — named rather than left as the literal
 * arguments to `.slice()`, so a skeleton can ask for exactly this many placeholders instead of a
 * second, hand-picked number that only happens to agree with the real count today.
 */
const RECENT_COMPACT_COUNT = 6;
const RECENT_LARGE_COUNT = 18;
const TOP_SUGGESTIONS_COUNT = 11;
/** Same size as "Listen again" — two rows of recommendations should read as two equal shelves. */
const MORE_SUGGESTIONS_COUNT = RECENT_LARGE_COUNT;

const suggestionCache = new Map<string, Track[]>();
const suggestionLoads = new Map<string, Promise<Track[]>>();
const EMPTY_TRACKS: Track[] = [];

/**
 * Module-level persistent cache across screen switches.
 * Prevents recommendations and home shelves from re-randomizing when switching tabs or pages.
 */
let persistentHomeFeed: BrowsePage | null = null;
let persistentSuggestions: Track[] | null = null;

/**
 * Cap on memoized suggestion sets.
 *
 * The key carries both the tab and a signature of the recently-played list, so a new entry
 * appears for every tab and again on every library refresh — and each holds 36 full tracks.
 * Unbounded, that grew for as long as the app stayed open.
 *
 * Insertion order gives LRU for free: reads re-insert, so eviction takes the coldest.
 */
const MAX_SUGGESTION_ENTRIES = 20;

function readSuggestionCache(key: string): Track[] | undefined {
  const hit = suggestionCache.get(key);
  if (hit === undefined) return undefined;
  suggestionCache.delete(key);
  suggestionCache.set(key, hit);
  return hit;
}

function writeSuggestionCache(key: string, tracks: Track[]): void {
  suggestionCache.delete(key);
  suggestionCache.set(key, tracks);

  for (const coldest of [...suggestionCache.keys()]) {
    if (suggestionCache.size <= MAX_SUGGESTION_ENTRIES) break;
    suggestionCache.delete(coldest);
  }
}

interface HomePageProps {
  tabId: string;
  playerController: PlayerControllerActions;
  libraryController: LibraryController;
  libraryState: LibraryState;
  searchController: SearchController;
  onSignIn: () => Promise<void>;
  destinations: HomeDestinationHandlers;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onOpenAlbum?: (album: Album) => void;
  onOpenArtist?: (artist: Artist) => void;
  onOpenPlaylist?: (playlist: Playlist) => void;
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function uniqueTracks(tracks: readonly Track[]): Track[] {
  return [...new Map(tracks.map((track) => [track.id, track])).values()];
}

export function HomePage({
  tabId,
  playerController,
  libraryController,
  libraryState,
  searchController,
  onSignIn,
  destinations,
  onOpenSearch,
  onOpenSettings,
  onOpenAlbum,
  onOpenArtist,
  onOpenPlaylist,
}: HomePageProps) {
  const isMobile = useIsMobile();
  const { openTrackMenu } = useTrackContextMenu();
  const showMadeForYou = useMadeForYouVisible();
  const showYtmHomeFeed = useYtmHomeFeedVisible();
  const recentlyPlayed = useMemo(
    () => libraryState.library?.recentlyPlayed ?? EMPTY_TRACKS,
    [libraryState.library],
  );
  const recentTrackKey = recentlyPlayed.map((track) => track.id).join(":");
  /*
   * Computed before the state below, not after, so the initial render can read the cache under
   * the key writes actually use. It previously seeded from `tabId` alone — a key nothing ever
   * stored — so the memo never hit and Home opened on a spinner every single time, which is
   * the exact thing this cache exists to prevent.
   */
  const suggestionCacheKey = recentlyPlayed.length > 0
    ? `${tabId}:recent:${recentTrackKey}`
    : `${tabId}:${libraryState.status}:empty`;
  const [suggestions, setSuggestions] = useState<Track[]>(
    () => persistentSuggestions ?? readSuggestionCache(suggestionCacheKey) ?? [],
  );
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(
    () => !persistentSuggestions && !suggestionCache.has(suggestionCacheKey),
  );
  const [isSurpriseSpinning, setIsSurpriseSpinning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadIdRef = useRef(0);
  /*
   * What is shown as "Recently played": this session's plays first, then YouTube's history.
   * The library snapshot only refreshes on start-up, so on its own the row sat unchanged
   * however much you listened. Suggestions still seed from the snapshot alone — keying them
   * on the live list would refetch them after every song.
   */
  const playHistory = usePlayHistory();
  const recentPlays = useMemo(
    () => uniqueTracks([...playHistory.map((entry) => entry.track), ...recentlyPlayed]),
    [playHistory, recentlyPlayed],
  );
  const isWaitingForLibrary = !libraryState.library
    && (
      libraryState.status === "restoring"
      || libraryState.status === "loading"
      || libraryState.status === "authorizing"
    );

  // ── YTM Home Feed ────────────────────────────────────────────────────────
  const [ytmHomeFeed, setYtmHomeFeed] = useState<BrowsePage | null>(
    () => persistentHomeFeed,
  );
  const [isLoadingHomeFeed, setIsLoadingHomeFeed] = useState(false);

  const hasYtmListenAgain = useMemo(
    () =>
      showYtmHomeFeed &&
      Boolean(
        ytmHomeFeed?.shelves.some((shelf) =>
          shelf.title.toLocaleLowerCase().includes("listen again"),
        ),
      ),
    [showYtmHomeFeed, ytmHomeFeed],
  );

  useEffect(() => {
    if (!showYtmHomeFeed) return;
    if (libraryState.status !== "ready") return;
    // Preserve persistent cache across screen navigation
    if (persistentHomeFeed) {
      setYtmHomeFeed(persistentHomeFeed);
      return;
    }

    let cancelled = false;
    setIsLoadingHomeFeed(true);
    libraryController
      .getBrowsePage("home")
      .then((page) => {
        if (!cancelled) {
          persistentHomeFeed = page;
          setYtmHomeFeed(page);
          setIsLoadingHomeFeed(false);
        }
      })
      .catch((error: unknown) => {
        logInternalError("HomePage.ytmHomeFeed failed", error);
        if (!cancelled) setIsLoadingHomeFeed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryController, libraryState.status, showYtmHomeFeed]);

  useEffect(() => {
    if (isWaitingForLibrary) {
      loadIdRef.current += 1;
      setSuggestions([]);
      setIsLoadingSuggestions(true);
      return;
    }

    // Preserve persistent suggestions across screen navigation
    if (persistentSuggestions && persistentSuggestions.length > 0) {
      setSuggestions(persistentSuggestions);
      setIsLoadingSuggestions(false);
      return;
    }

    const cached = readSuggestionCache(suggestionCacheKey);
    if (cached) {
      persistentSuggestions = cached;
      setSuggestions(cached);
      setIsLoadingSuggestions(false);
      return;
    }

    const loadId = ++loadIdRef.current;
    setIsLoadingSuggestions(true);

    let loadPromise = suggestionLoads.get(suggestionCacheKey);
    if (!loadPromise) {
      loadPromise = (async () => {
        const seeds = shuffle(recentlyPlayed).slice(0, 3);
        let loaded: Track[] = [];

        if (seeds.length > 0) {
          const recommendationSets = await Promise.allSettled(
            seeds.map((seed) => libraryController.getRecommendations(seed)),
          );
          loaded = recommendationSets.flatMap((result) =>
            result.status === "fulfilled" ? result.value : []
          );
        }

        if (loaded.length < 12) {
          const query = FALLBACK_QUERIES[Math.floor(Math.random() * FALLBACK_QUERIES.length)];
          try {
            loaded.push(...await searchController.searchTracks(query));
          } catch {
            // Recent tracks still provide a useful offline fallback.
          }
        }

        return shuffle(uniqueTracks([...loaded, ...recentlyPlayed])).slice(0, 36);
      })();
      suggestionLoads.set(suggestionCacheKey, loadPromise);
    }

    void loadPromise.then((loadedSuggestions) => {
      writeSuggestionCache(suggestionCacheKey, loadedSuggestions);
      suggestionLoads.delete(suggestionCacheKey);
      persistentSuggestions = loadedSuggestions;
      if (loadId !== loadIdRef.current) return;
      setSuggestions(loadedSuggestions);
      setIsLoadingSuggestions(false);
    });
  }, [
    isWaitingForLibrary,
    libraryController,
    recentlyPlayed,
    searchController,
    suggestionCacheKey,
  ]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setIsLoadingSuggestions(true);
    if (showYtmHomeFeed && libraryState.status === "ready") {
      setIsLoadingHomeFeed(true);
    }

    persistentSuggestions = null;
    persistentHomeFeed = null;
    suggestionCache.clear();
    suggestionLoads.clear();

    const fetchSuggestions = async () => {
      try {
        const seeds = shuffle(recentlyPlayed).slice(0, 3);
        let loaded: Track[] = [];

        if (seeds.length > 0) {
          const recommendationSets = await Promise.allSettled(
            seeds.map((seed) => libraryController.getRecommendations(seed)),
          );
          loaded = recommendationSets.flatMap((result) =>
            result.status === "fulfilled" ? result.value : []
          );
        }

        if (loaded.length < 12) {
          const query = FALLBACK_QUERIES[Math.floor(Math.random() * FALLBACK_QUERIES.length)];
          try {
            loaded.push(...await searchController.searchTracks(query));
          } catch {
            // fallback
          }
        }

        const fresh = shuffle(uniqueTracks([...loaded, ...recentlyPlayed])).slice(0, 36);
        persistentSuggestions = fresh;
        writeSuggestionCache(suggestionCacheKey, fresh);
        setSuggestions(fresh);
      } catch (err) {
        logInternalError("HomePage.handleRefresh suggestions failed", err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    const fetchHomeFeed = async () => {
      if (!showYtmHomeFeed || libraryState.status !== "ready") {
        setIsLoadingHomeFeed(false);
        return;
      }
      try {
        const page = await libraryController.getBrowsePage("home");
        persistentHomeFeed = page;
        setYtmHomeFeed(page);
      } catch (err) {
        logInternalError("HomePage.handleRefresh ytmHomeFeed failed", err);
      } finally {
        setIsLoadingHomeFeed(false);
      }
    };

    await Promise.allSettled([fetchSuggestions(), fetchHomeFeed()]);
    setIsRefreshing(false);
  }, [
    isRefreshing,
    libraryController,
    libraryState.status,
    recentlyPlayed,
    searchController,
    showYtmHomeFeed,
    suggestionCacheKey,
  ]);

  const compactRecent = useMemo(
    () => recentPlays.slice(0, RECENT_COMPACT_COUNT),
    [recentPlays],
  );
  const largeRecent = useMemo(
    () => recentPlays.slice(RECENT_COMPACT_COUNT, RECENT_COMPACT_COUNT + RECENT_LARGE_COUNT),
    [recentPlays],
  );
  const topSuggestions = suggestions.slice(0, TOP_SUGGESTIONS_COUNT);
  const moreSuggestions = suggestions.slice(
    TOP_SUGGESTIONS_COUNT,
    TOP_SUGGESTIONS_COUNT + MORE_SUGGESTIONS_COUNT,
  );
  const surpriseSuggestions = suggestions.slice(TOP_SUGGESTIONS_COUNT);

  const playTrack = (track: Track, queue: readonly Track[]) => {
    void playerController.playTrackById(track.id, queue, true);
  };

  const playSurprise = () => {
    if (surpriseSuggestions.length === 0 || isSurpriseSpinning) return;
    setIsSurpriseSpinning(true);
    window.setTimeout(() => {
      const selected = surpriseSuggestions[
        Math.floor(Math.random() * surpriseSuggestions.length)
      ];
      setIsSurpriseSpinning(false);
      playTrack(selected, surpriseSuggestions);
    }, 720);
  };

  const madeForYouSection = (
    <section
      className={`flex flex-col gap-3 overflow-y-visible ${
        isLoadingSuggestions ? "opacity-60" : "opacity-100 transition-opacity"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-foreground">Made for you</h3>
        {!isMobile && (
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-all hover:bg-card hover:text-foreground active:scale-95 disabled:opacity-50"
            aria-label="Refresh recommendations"
          >
            <RefreshIcon size={14} className={cn(isRefreshing && "animate-spin text-primary")} />
            <span>{isRefreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
        )}
      </div>

      {isMobile ? (
        <div className="flex w-full gap-2.5 sm:gap-3 overflow-x-auto no-scrollbar snap-x py-1 px-0.5">
          {isLoadingSuggestions ? (
            Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="w-32 sm:w-36 shrink-0 aspect-[3/4] snap-start">
                <PickCardSkeleton />
              </div>
            ))
          ) : (
            <>
              <div className="w-32 sm:w-36 shrink-0 aspect-[3/4] snap-start">
                <DiceCard
                  tracks={surpriseSuggestions}
                  isSpinning={isSurpriseSpinning}
                  onClick={playSurprise}
                />
              </div>
              {topSuggestions.map((track) => (
                <div key={track.id} className="w-32 sm:w-36 shrink-0 aspect-[3/4] snap-start">
                  <PickCard
                    artworkUrl={track.artworkUrl}
                    title={track.title}
                    subtitle={track.artist}
                    onContextMenu={(event) => openTrackMenu(event, track)}
                    onSelect={() => playTrack(track, suggestions)}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <CylinderCarousel
          key={isLoadingSuggestions ? "skeleton" : "content"}
          itemSize={PICKS_ITEM_SIZE}
          height={PICKS_STAGE_HEIGHT}
          visibleItems={PICKS_VISIBLE_ITEMS}
          itemAspect={PICKS_ASPECT}
          arc={PICKS_ARC}
          minScale={PICKS_MIN_SCALE}
          variant="convex"
          className="-mx-4 cursor-grab active:cursor-grabbing overflow-x-clip overflow-y-visible"
        >
          {isLoadingSuggestions ? (
            Array.from({ length: PICKS_SKELETON_COUNT }, (_, index) => (
              <PickCardSkeleton key={index} />
            ))
          ) : (
            [
              <DiceCard
                key="dice"
                tracks={surpriseSuggestions}
                isSpinning={isSurpriseSpinning}
                onClick={playSurprise}
              />,
              ...topSuggestions.map((track) => (
                <PickCard
                  key={track.id}
                  artworkUrl={track.artworkUrl}
                  title={track.title}
                  subtitle={track.artist}
                  onContextMenu={(event) => openTrackMenu(event, track)}
                  onSelect={() => playTrack(track, suggestions)}
                />
              )),
            ]
          )}
        </CylinderCarousel>
      )}
      {isLoadingSuggestions && <span className="sr-only" role="status">Loading suggestions</span>}
    </section>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-7 pb-8">
      {isMobile && onOpenSearch && (
        <MobileHeader
          onOpenSearch={onOpenSearch}
          onSignIn={onSignIn}
          onOpenSettings={onOpenSettings}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      )}

      {libraryState.status === "signed-out" && (
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl bg-card/80 border border-border/50 p-4 shadow-sm">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-bold text-foreground">You&apos;re not signed in</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Sign in to access your YouTube Music history, playlists, and albums.</p>
          </div>
          <button
            type="button"
            onClick={() => void onSignIn()}
            className="self-start sm:self-auto shrink-0 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition-transform active:scale-95 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </button>
        </section>
      )}

      {showMadeForYou && madeForYouSection}

      {/* Directly under the carousel: the picks are what you came for, these are where you
          go when none of them appeal. */}
      <HomeDestinations {...destinations} />

      {/* ── YouTube Music Home Feed ──────────────────────────────────────────
          Personalized shelves from FEmusic_home — same data YTM's own Home tab shows.
          Only rendered when the user is signed in (status === "ready"). */}
      {showYtmHomeFeed && libraryState.status === "ready" && (
        <div className="flex flex-col gap-8">
          {isLoadingHomeFeed && !ytmHomeFeed && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Loading your feed…</h2>
                <span className="text-xs text-muted-foreground animate-pulse">Updating…</span>
              </div>
              <AlbumGridSkeleton count={12} label="Loading your feed" />
            </section>
          )}
          {ytmHomeFeed && ytmHomeFeed.shelves.length > 0 && (
            <BrowseShelves
              shelves={ytmHomeFeed.shelves}
              playerController={playerController}
              onOpenAlbum={onOpenAlbum ?? (() => {})}
              onOpenArtist={onOpenArtist ?? (() => {})}
              onOpenPlaylist={onOpenPlaylist ?? (() => {})}
            />
          )}
        </div>
      )}

      {compactRecent.length === 0 && isWaitingForLibrary && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Recently played</h2>
          <div
            className="grid grid-cols-2 gap-2 sm:gap-2.5 sm:[grid-template-columns:repeat(auto-fill,minmax(14.5rem,1fr))]"
            role="status"
            aria-label="Loading recently played"
          >
            {Array.from({ length: RECENT_COMPACT_COUNT }, (_, index) => (
              <div
                key={index}
                className="flex items-center gap-2.5 rounded-xl border border-border/20 bg-card/25 p-1.5 animate-pulse"
              >
                <div
                  className="size-11 shrink-0 rounded-lg bg-foreground/10"
                  style={{ animationDelay: `${index * 50}ms` }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div
                    className="h-3 w-3/4 rounded-md bg-foreground/10"
                    style={{ animationDelay: `${index * 50}ms` }}
                  />
                  <div
                    className="h-2.5 w-1/2 rounded-md bg-foreground/10"
                    style={{ animationDelay: `${index * 50}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {compactRecent.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Recently played</h2>
            {isMobile && (
              <button
                type="button"
                onClick={destinations.onOpenHistory}
                className="text-xs font-semibold text-primary"
              >
                See all
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5 sm:[grid-template-columns:repeat(auto-fill,minmax(14.5rem,1fr))]">
            {compactRecent.map((track) => (
              <div
                key={track.id}
                className="group/recent relative flex items-center gap-2.5 rounded-xl border border-border/35 bg-card/60 backdrop-blur-sm p-1.5 text-left transition-all hover:bg-card hover:border-border/70 active:scale-[0.97] overflow-hidden"
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus:outline-none"
                  onContextMenu={(event) => openTrackMenu(event, track)}
                  onClick={() => playTrack(track, recentPlays)}
                >
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg shadow-xs">
                    <TrackArtwork
                      className="size-full object-cover"
                      size={44}
                      artworkUrl={track.artworkUrl}
                      iconSize={20}
                    />
                    <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/40 opacity-0 group-hover/recent:opacity-100 transition-opacity">
                      <PlayActiveIcon size={16} className="text-white" />
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center pr-1 text-foreground">
                    <strong className="truncate text-xs font-semibold leading-snug group-hover/recent:text-primary transition-colors">
                      {track.title}
                    </strong>
                    <span className="truncate text-[10px] text-muted-foreground mt-0.5">
                      {track.artist || "Unknown Artist"}
                    </span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {moreSuggestions.length === 0 && isLoadingSuggestions && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">More recommendations</h2>
          <AlbumGridSkeleton count={MORE_SUGGESTIONS_COUNT} label="Loading more recommendations" />
        </section>
      )}

      {moreSuggestions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">More recommendations</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:[grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
            {moreSuggestions.map((track) => (
              <AlbumCard
                key={track.id}
                artworkUrl={track.artworkUrl}
                title={track.title}
                subtitleContent={<ArtistLinks artists={track.artists} fallback={track.artist} />}
                onContextMenu={(event) => openTrackMenu(event, track)}
                onClick={() => playTrack(track, suggestions)}
              />
            ))}
          </div>
        </section>
      )}

      {!hasYtmListenAgain && largeRecent.length === 0 && isWaitingForLibrary && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Listen again</h2>
          <AlbumGridSkeleton count={RECENT_LARGE_COUNT} label="Loading listen again" />
        </section>
      )}

      {!hasYtmListenAgain && largeRecent.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Listen again</h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:[grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
            {largeRecent.map((track) => (
              <AlbumCard
                key={track.id}
                artworkUrl={track.artworkUrl}
                title={track.title}
                subtitleContent={<ArtistLinks artists={track.artists} fallback={track.artist} />}
                onContextMenu={(event) => openTrackMenu(event, track)}
                onClick={() => playTrack(track, recentPlays)}
              />
            ))}
          </div>
        </section>
      )}

      {!isLoadingSuggestions && suggestions.length === 0 && (
        <div className="px-2 py-10 text-center text-sm text-muted-foreground">
          <p>Recommendations could not be loaded.</p>
          {libraryState.status === "signed-out" && (
            <button onClick={() => void onSignIn()}>
              Sign in with YouTube Music
            </button>
          )}
        </div>
      )}
    </div>
  );
}
