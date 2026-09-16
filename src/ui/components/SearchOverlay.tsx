import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  ClockIcon,
  CloseIcon,
  DiscNoteIcon,
  MenuDotsIcon,
  MicIcon,
  PlayActiveIcon,
  PodcastIcon,
  SearchIcon,
  SmileFaceIcon,
  TrendingUpIcon,
  WaveformIcon,
} from "@/ui/icons";
import { SpinnerSteps } from "@/components/motion/loader";
import type { Album, Artist, Playlist, SearchResults, Track } from "../../datasource/types";
import type { SearchController } from "../../player/SearchController";
import { TrackArtwork } from "./TrackArtwork";
import { useTrackContextMenu } from "./TrackContextMenu";
import { isMacOS } from "../platform";
import { usePlaylistContextMenu } from "./PlaylistContextMenu";
import { useIsMobile } from "../hooks/useIsMobile";

const RECENT_SEARCHES_KEY = "yt-music-dock:recent-searches-v2";
const MAX_RECENT_SEARCHES = 12;

export interface RecentSearchEntry {
  id: string;
  type: "query" | "artist" | "track" | "album";
  query: string;
  title?: string;
  subtitle?: string;
  artworkUrl?: string;
  artist?: Artist;
  track?: Track;
  album?: Album;
  timestamp: number;
}

// 2x2 Explore category cards matching screenshot
const EXPLORE_CATEGORIES = [
  {
    id: "new-releases",
    label: "New releases",
    browseTab: "explore",
    query: "New Releases",
    Icon: DiscNoteIcon,
    bg: "bg-[#212121]",
  },
  {
    id: "charts",
    label: "Charts",
    browseTab: "charts",
    query: "Top Charts",
    Icon: TrendingUpIcon,
    bg: "bg-[#212121]",
  },
  {
    id: "moods-genres",
    label: "Moods & genres",
    browseTab: "moods",
    query: "Moods & genres",
    Icon: SmileFaceIcon,
    bg: "bg-[#212121]",
  },
  {
    id: "podcasts",
    label: "Podcasts",
    browseTab: "podcasts",
    query: "Podcasts",
    Icon: PodcastIcon,
    bg: "bg-[#212121]",
  },
];

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function normalizeSearchKey(value: string): string {
  return normalizeSearchText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function searchMatchScore(value: string, query: string): number {
  const normalizedValue = normalizeSearchText(value);
  const normalizedValueKey = normalizeSearchKey(value);
  const queryKey = normalizeSearchKey(query);
  if (!normalizedValue || !query) return 0;
  if (normalizedValue === query) return 4;
  if (normalizedValueKey && queryKey && normalizedValueKey === queryKey) return 4;
  if (normalizedValue.startsWith(query)) return 3;
  if (normalizedValueKey && queryKey && normalizedValueKey.startsWith(queryKey)) return 3;
  if (normalizedValue.includes(query)) return 2;
  if (normalizedValueKey && queryKey && normalizedValueKey.includes(queryKey)) return 2;
  if (query.includes(normalizedValue)) return 1;
  if (normalizedValueKey && queryKey && queryKey.includes(normalizedValueKey)) return 1;
  return 0;
}

const DUMMY_QUERY_NAMES = new Set([
  "radhika sundori 2.0",
  "swami ji please",
  "riding song",
  "super 30",
  "jugalbandi",
  "rebel",
]);

function sanitizeRecentSearchEntries(rawItems: unknown): RecentSearchEntry[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter((item): item is RecentSearchEntry => {
      if (!item || typeof item !== "object") return false;
      const id = String((item as any).id || "");
      const query = String((item as any).query || "").trim();
      if (!query) return false;
      // Strip any hardcoded dummy items from previous sessions
      if (id.startsWith("def-") || id.startsWith("dummy-")) return false;
      if (DUMMY_QUERY_NAMES.has(query.toLowerCase())) return false;
      return true;
    })
    .slice(0, MAX_RECENT_SEARCHES);
}

function loadStoredRecentSearches(): RecentSearchEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) {
      try {
        localStorage.removeItem("yt-music-dock:recent-searches");
      } catch {
        // ignore
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeRecentSearchEntries(parsed);
    if (Array.isArray(parsed) && sanitized.length !== parsed.length) {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    return [];
  }
}

interface SearchOverlayProps {
  isOpen: boolean;
  activeTabId: string;
  searchController: SearchController;
  albums: Album[];
  playlists: Playlist[];
  onClose: () => void;
  onDismiss?: () => void;
  onSubmit: (query: string, openInNewTab: boolean) => void;
  onPlayTrack: (track: Track) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenAlbum: (album: Album) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  onQueryChange?: (query: string) => void;
  onOpenBrowse?: (tab: string) => void;
}

export function SearchOverlay({
  isOpen,
  activeTabId,
  searchController,
  albums,
  playlists,
  onClose,
  onDismiss,
  onSubmit,
  onPlayTrack,
  onOpenArtist,
  onOpenAlbum,
  onOpenPlaylist,
  onQueryChange,
  onOpenBrowse,
}: SearchOverlayProps) {
  const isMobile = useIsMobile();
  const { openTrackMenu } = useTrackContextMenu();
  const { openPlaylistMenu, openAlbumMenu } = usePlaylistContextMenu();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const modifiersRef = useRef({ primary: false, shift: false });
  const recognitionRef = useRef<any>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({
    artists: [],
    tracks: [],
    albums: [],
    playlists: [],
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>(loadStoredRecentSearches);

  // Modals for Voice & Sound Search
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "denied" | "unsupported">("idle");
  const [isSoundModalOpen, setIsSoundModalOpen] = useState(false);

  // Sync recent searches from remote YouTube Music account if available
  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;

    void searchController.getSearchHistory?.().then((remoteQueries) => {
      if (!isCurrent || !remoteQueries || remoteQueries.length === 0) return;
      setRecentSearches((prev) => {
        const existingQueries = new Set(prev.map((item) => item.query.trim().toLowerCase()));
        const additions: RecentSearchEntry[] = [];
        for (const queryStr of remoteQueries) {
          const trimmed = queryStr.trim();
          if (trimmed && !existingQueries.has(trimmed.toLowerCase())) {
            existingQueries.add(trimmed.toLowerCase());
            additions.push({
              id: `ytm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: "query",
              query: trimmed,
              timestamp: Date.now(),
            });
          }
        }
        if (additions.length === 0) return prev;
        const updated = [...prev, ...additions].slice(0, MAX_RECENT_SEARCHES);
        try {
          localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, searchController]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSearchResults({ artists: [], tracks: [], albums: [], playlists: [] });
    setSuggestions([]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [activeTabId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const updateModifier = (event: KeyboardEvent, pressed: boolean) => {
      if (event.key === (isMacOS ? "Meta" : "Control")) {
        modifiersRef.current.primary = pressed;
      }
      if (event.key === "Shift") modifiersRef.current.shift = pressed;
    };
    const resetModifiers = () => {
      modifiersRef.current = { primary: false, shift: false };
    };
    const handleKeyDown = (event: KeyboardEvent) => updateModifier(event, true);
    const handleKeyUp = (event: KeyboardEvent) => updateModifier(event, false);

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", resetModifiers);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", resetModifiers);
      resetModifiers();
    };
  }, [isOpen]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!isOpen || trimmed.length < 1) {
      requestIdRef.current += 1;
      setSearchResults({ artists: [], tracks: [], albums: [], playlists: [] });
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    const timeoutId = window.setTimeout(() => {
      const updatePreview = (results: SearchResults) => {
        if (requestId === requestIdRef.current) setSearchResults(results);
      };
      const updateSuggestions = (nextSuggestions: string[]) => {
        if (requestId === requestIdRef.current) setSuggestions(nextSuggestions);
      };
      void Promise.allSettled([
        searchController.search(trimmed, updatePreview),
        searchController.getSearchSuggestions(trimmed, updateSuggestions),
      ])
        .then(([resultsResult, suggestionsResult]) => {
          if (requestId !== requestIdRef.current) return;
          setSearchResults(
            resultsResult.status === "fulfilled"
              ? resultsResult.value
              : { artists: [], tracks: [], albums: [], playlists: [] },
          );
          setSuggestions(
            suggestionsResult.status === "fulfilled"
              ? suggestionsResult.value
              : [],
          );
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setIsLoading(false);
        });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, query, searchController]);

  const saveRecentSearches = (entries: RecentSearchEntry[]) => {
    setRecentSearches(entries);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(entries));
    } catch {
      // ignore
    }
  };

  const rememberSearch = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    const existingIndex = recentSearches.findIndex(
      (item) => item.query.toLowerCase() === normalized.toLowerCase(),
    );
    let next: RecentSearchEntry[];
    if (existingIndex !== -1) {
      const item = recentSearches[existingIndex];
      next = [{ ...item, timestamp: Date.now() }, ...recentSearches.filter((_, idx) => idx !== existingIndex)];
    } else {
      next = [
        {
          id: `search-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: "query" as const,
          query: normalized,
          timestamp: Date.now(),
        },
        ...recentSearches,
      ].slice(0, MAX_RECENT_SEARCHES);
    }
    saveRecentSearches(next);
  };

  const rememberArtist = (artist: Artist) => {
    const next = [
      {
        id: `artist-${artist.id}`,
        type: "artist" as const,
        query: artist.name,
        title: artist.name,
        subtitle: artist.subscriberCount || "Artist",
        artworkUrl: artist.artworkUrl,
        artist,
        timestamp: Date.now(),
      },
      ...recentSearches.filter(
        (item) => item.id !== `artist-${artist.id}` && item.query.toLowerCase() !== artist.name.toLowerCase(),
      ),
    ].slice(0, MAX_RECENT_SEARCHES);
    saveRecentSearches(next);
  };

  const rememberTrack = (track: Track) => {
    const next = [
      {
        id: `track-${track.id}`,
        type: "track" as const,
        query: track.title,
        title: track.title,
        subtitle: track.artist,
        artworkUrl: track.artworkUrl,
        track,
        timestamp: Date.now(),
      },
      ...recentSearches.filter(
        (item) => item.id !== `track-${track.id}` && item.query.toLowerCase() !== track.title.toLowerCase(),
      ),
    ].slice(0, MAX_RECENT_SEARCHES);
    saveRecentSearches(next);
  };

  const rememberAlbum = (album: Album) => {
    const next = [
      {
        id: `album-${album.id}`,
        type: "album" as const,
        query: album.title,
        title: album.title,
        subtitle: album.artist || "Album",
        artworkUrl: album.artworkUrl,
        album,
        timestamp: Date.now(),
      },
      ...recentSearches.filter(
        (item) => item.id !== `album-${album.id}` && item.query.toLowerCase() !== album.title.toLowerCase(),
      ),
    ].slice(0, MAX_RECENT_SEARCHES);
    saveRecentSearches(next);
  };

  const removeRecentSearch = (id: string) => {
    const next = recentSearches.filter((item) => item.id !== id);
    saveRecentSearches(next);
  };

  const clearAllRecentSearches = () => {
    saveRecentSearches([]);
  };

  const submitQuery = (value: string, openInNewTab = false) => {
    const normalized = value.trim();
    if (!normalized) return;
    onQueryChange?.(normalized);
    rememberSearch(normalized);
    onSubmit(normalized, openInNewTab);
    onClose();
  };

  const handleFillQuery = (text: string) => {
    setQuery(text);
    onQueryChange?.(text);
    inputRef.current?.focus();
  };

  // Voice Search Handler
  const startVoiceSearch = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("unsupported");
      setIsVoiceModalOpen(true);
      return;
    }
    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort?.();
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      setVoiceStatus("listening");
      setVoiceTranscript("");
      setIsVoiceModalOpen(true);
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0]?.transcript || "")
          .join("");
        setVoiceTranscript(transcript);
        if (event.results[0]?.isFinal) {
          recognition.stop();
          window.setTimeout(() => {
            setIsVoiceModalOpen(false);
            submitQuery(transcript, false);
          }, 350);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          setVoiceStatus("denied");
        } else {
          setVoiceStatus("idle");
        }
      };

      recognition.onend = () => {
        if (voiceStatus === "listening") {
          setVoiceStatus("idle");
        }
      };

      recognition.start();
    } catch {
      setVoiceStatus("unsupported");
      setIsVoiceModalOpen(true);
    }
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop?.();
      } catch {
        // ignore
      }
    }
    setIsVoiceModalOpen(false);
    setVoiceStatus("idle");
  };

  // Preview computations
  const libraryPreview = (() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery.length < 2) return null;

    const matchTitle = <T extends Album | Playlist>(items: T[]) => {
      const matches = items.filter((item) =>
        item.title.toLocaleLowerCase().includes(normalizedQuery),
      );
      return (
        matches.find((item) => item.title.toLocaleLowerCase() === normalizedQuery) ??
        matches[0] ??
        null
      );
    };

    const playlist = matchTitle(playlists);
    if (playlist) return { type: "playlist" as const, value: playlist };

    const album = matchTitle(albums);
    if (album) return { type: "album" as const, value: album };

    return null;
  })();

  const remotePreview = (() => {
    const normalizedQuery = normalizeSearchText(query);
    const rankedArtist = searchResults.artists
      .map((artist) => ({
        artist,
        score: searchMatchScore(artist.name, normalizedQuery),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)[0];
    const rankedTrack = searchResults.tracks
      .map((track) => ({
        track,
        score: searchMatchScore(track.title, normalizedQuery),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)[0];

    if (rankedArtist && (!rankedTrack || rankedArtist.score >= rankedTrack.score)) {
      return { type: "artist" as const, value: rankedArtist.artist };
    }
    if (rankedTrack) return { type: "track" as const, value: rankedTrack.track };
    if (searchResults.tracks[0]) {
      return { type: "track" as const, value: searchResults.tracks[0] };
    }
    if (searchResults.artists[0]) {
      return { type: "artist" as const, value: searchResults.artists[0] };
    }
    if (searchResults.albums[0]) {
      return { type: "album" as const, value: searchResults.albums[0] };
    }
    if (searchResults.playlists[0]) {
      return { type: "playlist" as const, value: searchResults.playlists[0] };
    }
    return null;
  })();

  const normalizedPreviewQuery = normalizeSearchText(query);
  const preview =
    remotePreview?.type === "artist" &&
    normalizeSearchText(remotePreview.value.name) === normalizedPreviewQuery
      ? remotePreview
      : libraryPreview ?? remotePreview;

  const openPreview = () => {
    if (!preview) return;
    rememberSearch(query);
    if (preview.type === "playlist") onOpenPlaylist(preview.value);
    if (preview.type === "album") {
      rememberAlbum(preview.value);
      onOpenAlbum(preview.value);
    }
    if (preview.type === "artist") {
      rememberArtist(preview.value);
      onOpenArtist(preview.value);
    }
    if (preview.type === "track") {
      rememberTrack(preview.value);
      onPlayTrack(preview.value);
    }
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      (onDismiss ?? onClose)();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const openInNewTab =
        (isMacOS ? event.metaKey : event.ctrlKey) ||
        event.shiftKey ||
        modifiersRef.current.primary ||
        modifiersRef.current.shift;

      if (query.trim()) {
        submitQuery(query, openInNewTab);
      }
    }
  };

  const searchedMediaItems = useMemo(
    () => recentSearches.filter((item) => item.type === "track" || item.type === "artist" || item.type === "album"),
    [recentSearches],
  );
  const searchedQueries = useMemo(
    () => recentSearches.filter((item) => item.type === "query"),
    [recentSearches],
  );

  return (
    <AnimatePresence>
      {isOpen && (
    <motion.div
      key="search-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn(
        "fixed inset-0 z-[70] flex flex-col bg-[#030303] text-foreground select-none overflow-hidden",
        !isMobile && "md:bg-black/90 md:backdrop-blur-xl md:justify-start md:pt-6",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <motion.div
        initial={{ y: isMobile ? 24 : 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: isMobile ? 24 : 8, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={cn("flex flex-1 flex-col h-full w-full mx-auto", !isMobile && "max-w-2xl")}
      >
        {/* ────────────── Top YouTube Music Search Bar ────────────── */}
        <header className="sticky top-0 z-20 flex items-center gap-2.5 px-3 pt-[max(env(safe-area-inset-top,0px),12px)] pb-3 bg-[#030303]/95 backdrop-blur-xl border-b border-white/5">
          {/* Back Arrow */}
          <button
            type="button"
            onClick={onDismiss ?? onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/80 transition-transform active:scale-90 hover:bg-white/10 hover:text-white"
            aria-label="Back"
          >
            <ArrowLeftIcon size={24} />
          </button>

          {/* Search Pill Capsule */}
          <div className="relative flex min-w-0 flex-1 items-center rounded-full bg-[#212121] px-4 py-2 border border-white/5 shadow-inner">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                onQueryChange?.(event.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type to search"
              aria-label="Type to search"
              className="w-full bg-transparent text-[15px] font-normal text-white placeholder:text-white/50 outline-none pr-2"
              autoFocus
            />

            {/* Clear Button if text typed */}
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  onQueryChange?.("");
                  inputRef.current?.focus();
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-white/60 hover:text-white active:scale-90"
                aria-label="Clear search"
              >
                <CloseIcon size={18} />
              </button>
            )}

            {/* Mic & Audio Waveform Icons (when no text typed or as action buttons) */}
            {query.length === 0 && (
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                <button
                  type="button"
                  onClick={startVoiceSearch}
                  className="flex size-8 items-center justify-center rounded-full text-white/80 transition-transform hover:bg-white/10 hover:text-white active:scale-90"
                  aria-label="Voice search"
                  title="Voice search"
                >
                  <MicIcon size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsSoundModalOpen(true)}
                  className="flex size-8 items-center justify-center rounded-full text-white/80 transition-transform hover:bg-white/10 hover:text-white active:scale-90"
                  aria-label="Search with sound or hum"
                  title="Sound search"
                >
                  <WaveformIcon size={20} />
                </button>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="flex size-7 shrink-0 items-center justify-center text-primary animate-pulse">
              <SpinnerSteps size={18} color="currentColor" />
            </div>
          )}
        </header>

        {/* ────────────── Search Screen Body ────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-2 pb-32 no-scrollbar">
          {query.trim().length >= 1 ? (
            /* ────────────── ACTIVE QUERY: AUTOCOMPLETE & PREVIEWS ────────────── */
            <div className="flex flex-col gap-5 pt-1">
              {/* Autocomplete Suggestions with ↗ arrow to fill */}
              {suggestions.length > 0 && (
                <section className="flex flex-col">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      className="flex items-center justify-between py-2.5 px-1 hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => submitQuery(suggestion, false)}
                        className="flex flex-1 items-center gap-3.5 text-left focus:outline-none"
                      >
                        <SearchIcon size={18} className="shrink-0 text-white/50" />
                        <span className="truncate text-sm font-medium text-white">
                          {suggestion}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFillQuery(suggestion)}
                        className="flex size-8 items-center justify-center text-white/50 hover:text-white active:scale-90"
                        aria-label={`Insert ${suggestion}`}
                      >
                        <ArrowUpRightIcon size={18} />
                      </button>
                    </div>
                  ))}
                </section>
              )}

              {/* Top Result Preview Card */}
              {preview && (
                <section className="flex flex-col gap-1.5 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 px-1">
                    Top Result
                  </span>
                  <button
                    type="button"
                    onClick={openPreview}
                    onContextMenu={
                      preview.type === "track"
                        ? (event) => openTrackMenu(event, preview.value)
                        : preview.type === "playlist"
                          ? (event) => openPlaylistMenu(event, preview.value)
                          : preview.type === "album"
                            ? (event) => openAlbumMenu(event, preview.value)
                            : undefined
                    }
                    className="flex w-full items-center gap-3.5 rounded-2xl bg-[#1e1e1e] p-3 text-left transition-all active:scale-[0.98] hover:bg-[#252525] border border-white/5"
                  >
                    <TrackArtwork
                      className={cn(
                        "size-14 shrink-0 object-cover shadow-md",
                        preview.type === "artist" ? "rounded-full" : "rounded-xl",
                      )}
                      size={56}
                      artworkUrl={preview.value.artworkUrl}
                      iconSize={28}
                      loading="eager"
                      variant={preview.type === "artist" ? "artist" : "track"}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="inline-flex w-fit items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary mb-0.5">
                        {preview.type === "artist"
                          ? "Artist"
                          : preview.type === "album"
                            ? "Album"
                            : preview.type === "playlist"
                              ? "Playlist"
                              : "Song"}
                      </span>
                      <strong className="truncate text-sm font-bold text-white">
                        {preview.type === "artist" ? preview.value.name : preview.value.title}
                      </strong>
                      <span className="truncate text-xs text-white/50 mt-0.5">
                        {preview.type === "playlist"
                          ? `Playlist · ${preview.value.owner}`
                          : preview.type === "album"
                            ? `Album · ${preview.value.artist}`
                            : preview.type === "artist"
                              ? preview.value.subscriberCount || "Artist"
                              : preview.value.artist}
                      </span>
                    </div>
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-md transition-transform active:scale-90">
                      <PlayActiveIcon size={16} />
                    </div>
                  </button>
                </section>
              )}

              {/* Instant Songs Preview */}
              {searchResults.tracks.length > 0 && (
                <section className="flex flex-col gap-1">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                      Songs
                    </span>
                    <button
                      type="button"
                      onClick={() => submitQuery(query, false)}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div className="flex flex-col divide-y divide-white/5 rounded-2xl bg-[#181818] border border-white/5 overflow-hidden">
                    {searchResults.tracks.slice(0, 5).map((track) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/5"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            rememberSearch(query);
                            rememberTrack(track);
                            onPlayTrack(track);
                            onClose();
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
                        >
                          <TrackArtwork
                            className="size-11 shrink-0 rounded-lg object-cover"
                            size={44}
                            artworkUrl={track.artworkUrl}
                            iconSize={22}
                            loading="lazy"
                          />
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium text-white">
                              {track.title}
                            </span>
                            <span className="truncate text-xs text-white/50">
                              {track.artist}
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => openTrackMenu(event, track)}
                          className="flex size-8 shrink-0 items-center justify-center text-white/60 hover:text-white"
                          aria-label={`Options for ${track.title}`}
                        >
                          <MenuDotsIcon size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Instant Artists Preview */}
              {searchResults.artists.length > 0 && (
                <section className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 px-1">
                    Artists
                  </span>
                  <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar overscroll-x-contain">
                    {searchResults.artists.map((artist) => (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() => {
                          rememberArtist(artist);
                          onOpenArtist(artist);
                          onClose();
                        }}
                        className="group flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-[#181818] p-2.5 text-center transition-all active:scale-95 hover:bg-[#222]"
                      >
                        <TrackArtwork
                          className="size-16 rounded-full object-cover shadow-sm ring-1 ring-white/10 group-hover:ring-primary/60 transition-all"
                          size={64}
                          artworkUrl={artist.artworkUrl}
                          iconSize={28}
                          loading="lazy"
                          preferProxy
                          variant="artist"
                        />
                        <span className="w-full truncate text-xs font-semibold text-white">
                          {artist.name}
                        </span>
                        <span className="w-full truncate text-[10px] text-white/50">
                          {artist.subscriberCount || "Artist"}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Full Search Action Button */}
              <button
                type="button"
                onClick={() => submitQuery(query, false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 border border-white/10 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] hover:bg-white/15 mt-1"
              >
                <SearchIcon size={16} />
                <span>Search all results for &ldquo;{query}&rdquo;</span>
              </button>
            </div>
          ) : (
            /* ────────────── INITIAL YOUTUBE MUSIC SEARCH SCREEN ────────────── */
            <div className="flex flex-col gap-5 pt-1">
              {/* SECTION: Recent searches (only shown when there are actual recent searches) */}
              {recentSearches.length > 0 && (
                <section className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-[15px] font-bold tracking-tight text-white/90">
                      Recent searches
                    </h2>
                    <button
                      type="button"
                      onClick={clearAllRecentSearches}
                      className="text-xs font-semibold text-white/50 hover:text-white/80 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>

                  {/* Horizontal Carousel of Searched Media Items (tracks/artists/albums clicked from search) */}
                  {searchedMediaItems.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-1 no-scrollbar overscroll-x-contain -mx-1 px-1">
                      {searchedMediaItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.type === "track" && item.track) {
                              onPlayTrack(item.track);
                              onClose();
                            } else if (item.type === "artist" && item.artist) {
                              onOpenArtist(item.artist);
                              onClose();
                            } else if (item.type === "album" && item.album) {
                              onOpenAlbum(item.album);
                              onClose();
                            } else {
                              submitQuery(item.query, false);
                            }
                          }}
                          className="group flex w-24 shrink-0 flex-col text-left transition-transform active:scale-95"
                        >
                          <div className="relative size-24 overflow-hidden rounded-xl bg-[#212121] shadow-md ring-1 ring-white/5">
                            <TrackArtwork
                              className={cn(
                                "size-full object-cover transition-transform duration-300 group-hover:scale-105",
                                item.type === "artist" && "rounded-full",
                              )}
                              size={96}
                              artworkUrl={item.artworkUrl}
                              iconSize={36}
                              loading="lazy"
                              variant={item.type === "artist" ? "artist" : "track"}
                            />
                          </div>
                          <span className="mt-1.5 w-full truncate text-[12px] font-medium text-white leading-tight">
                            {item.title || item.query}
                          </span>
                          <span className="w-full truncate text-[10px] text-white/50 leading-tight">
                            {item.subtitle || (item.type === "artist" ? "Artist" : item.type === "album" ? "Album" : "Song")}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Recent Search Queries List */}
                  {searchedQueries.length > 0 && (
                    <div className="flex flex-col divide-y divide-white/5 mt-1">
                      {searchedQueries.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-2.5 px-1 hover:bg-white/5 rounded-xl transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => submitQuery(item.query, false)}
                            className="flex flex-1 min-w-0 items-center gap-3.5 text-left focus:outline-none"
                          >
                            <ClockIcon size={18} className="shrink-0 text-white/50" />
                            <span className="truncate text-sm font-medium text-white">
                              {item.query}
                            </span>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRecentSearch(item.id);
                              }}
                              className="flex size-8 items-center justify-center text-white/40 hover:text-white active:scale-90"
                              aria-label={`Remove ${item.query}`}
                              title="Remove"
                            >
                              <CloseIcon size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFillQuery(item.query)}
                              className="flex size-8 shrink-0 items-center justify-center text-white/50 hover:text-white active:scale-90"
                              aria-label={`Insert ${item.query}`}
                              title="Insert query"
                            >
                              <ArrowUpRightIcon size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* SECTION: 2x2 Explore Category Cards (New releases, Charts, Moods & genres, Podcasts) */}
              <section className="grid grid-cols-2 gap-2.5 my-1">
                {EXPLORE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (onOpenBrowse) {
                        onOpenBrowse(cat.browseTab);
                        onClose();
                      } else {
                        submitQuery(cat.query, false);
                      }
                    }}
                    className={cn(
                      "flex flex-col justify-between h-20 rounded-2xl p-3 text-left transition-all active:scale-95 border border-white/5 hover:bg-[#282828] shadow-sm",
                      cat.bg,
                    )}
                  >
                    <cat.Icon size={20} className="text-white/80" />
                    <span className="text-[13px] font-bold text-white tracking-tight">
                      {cat.label}
                    </span>
                  </button>
                ))}
              </section>
            </div>
          )}
        </div>
      </motion.div>


      {/* ────────────── VOICE SEARCH OVERLAY MODAL ────────────── */}
      <AnimatePresence>
      {isVoiceModalOpen && (
        <motion.div
          key="voice-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-black/95 p-6 backdrop-blur-2xl"
          role="dialog"
          aria-label="Voice Search"
        >
          <div className="w-full flex justify-end">
            <button
              type="button"
              onClick={stopVoiceSearch}
              className="flex size-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close voice search"
            >
              <CloseIcon size={24} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-6 text-center max-w-sm">
            <div className="relative flex size-28 items-center justify-center">
              {voiceStatus === "listening" && (
                <>
                  <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping duration-1000" />
                  <span className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
                </>
              )}
              <div className="relative flex size-20 items-center justify-center rounded-full bg-primary text-white shadow-xl">
                <MicIcon size={36} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-bold text-white">
                {voiceStatus === "listening"
                  ? "Listening..."
                  : voiceStatus === "denied"
                    ? "Microphone access denied"
                    : voiceStatus === "unsupported"
                      ? "Voice search not available"
                      : "Tap microphone to speak"}
              </h3>
              <p className="text-sm text-white/60">
                {voiceTranscript
                  ? `"${voiceTranscript}"`
                  : voiceStatus === "listening"
                    ? "Say a song title, artist, or album"
                    : "Please check your microphone permissions"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={voiceStatus === "listening" ? stopVoiceSearch : startVoiceSearch}
            className="rounded-full bg-white/10 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
          >
            {voiceStatus === "listening" ? "Cancel" : "Try Again"}
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ────────────── SOUND SEARCH OVERLAY MODAL ────────────── */}
      <AnimatePresence>
      {isSoundModalOpen && (
        <motion.div
          key="sound-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-[80] flex flex-col items-center justify-between bg-black/95 p-6 backdrop-blur-2xl"
          role="dialog"
          aria-label="Sound Search"
        >
          <div className="w-full flex justify-end">
            <button
              type="button"
              onClick={() => setIsSoundModalOpen(false)}
              className="flex size-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close sound search"
            >
              <CloseIcon size={24} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-6 text-center max-w-sm">
            {/* Animated Waveform equalizer */}
            <div className="flex items-center justify-center gap-1.5 h-20">
              <span className="w-2 rounded-full bg-primary animate-pulse h-10" />
              <span className="w-2 rounded-full bg-primary animate-pulse h-16 [animation-delay:150ms]" />
              <span className="w-2 rounded-full bg-primary animate-pulse h-20 [animation-delay:300ms]" />
              <span className="w-2 rounded-full bg-primary animate-pulse h-12 [animation-delay:450ms]" />
              <span className="w-2 rounded-full bg-primary animate-pulse h-7 [animation-delay:600ms]" />
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-bold text-white">Listening for music...</h3>
              <p className="text-sm text-white/60">
                Hum, whistle, or play a song near your microphone to find it
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSoundModalOpen(false)}
            className="rounded-full bg-white/10 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
          >
            Cancel
          </button>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
