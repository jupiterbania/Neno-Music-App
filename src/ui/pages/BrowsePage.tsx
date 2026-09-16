import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SpinnerSteps } from "@/components/motion/loader";
import { ArrowLeftIcon } from "@/ui/icons";
import type {
  Album,
  Artist,
  BrowsePage as BrowsePageData,
  BrowseSurface,
  BrowseTarget,
  Playlist,
} from "../../datasource/types";
import type { LibraryController } from "../../player/LibraryController";
import type { PlayerControllerActions } from "../../player/playerStore";
import { logInternalError } from "../../internal/logging";
import { BrowseShelves } from "../components/BrowseShelves";
import { DownloadsPage } from "./DownloadsPage";

export type BrowseTab = BrowseSurface | "downloads";

const SURFACES: Array<{ value: BrowseSurface; label: string }> = [
  { value: "explore", label: "Explore" },
  { value: "charts", label: "Charts" },
  { value: "moods", label: "Moods & genres" },
  { value: "podcasts", label: "Podcasts" },
];

/**
 * YouTube Music's browse feeds — explore, charts, moods and podcasts.
 *
 * All four are the same shape (titled shelves of mixed content), so they share one page with
 * a surface switcher rather than becoming four near-identical files.
 * If "downloads" is passed as initial tab, it seamlessly renders the dedicated DownloadsPage.
 */
export function BrowsePage({
  initialTab = "explore",
  playerController,
  libraryController,
  onOpenAlbum,
  onOpenArtist,
  onOpenPlaylist,
}: {
  /** Which tab to open on. Downloads is reached this way from the home page. */
  initialTab?: BrowseTab;
  playerController: PlayerControllerActions;
  libraryController: LibraryController;
  onOpenAlbum: (album: Album) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
}) {
  const [surface, setSurface] = useState<BrowseTab>(initialTab);
  const [drillDown, setDrillDown] = useState<
    Array<{ browseId: string; title: string; params?: string }>
  >([]);

  const isDownloads = surface === "downloads" && drillDown.length === 0;

  // If viewing downloads, render the dedicated, systematic Downloads screen with no browse tabs
  if (isDownloads) {
    return (
      <DownloadsPage
        playerController={playerController}
        libraryController={libraryController}
        onOpenAlbum={onOpenAlbum}
        onOpenArtist={onOpenArtist}
        onOpenPlaylist={onOpenPlaylist}
        onOpenBrowse={() => {
          setSurface("explore");
          setDrillDown([]);
        }}
      />
    );
  }

  const target: BrowseTarget = drillDown[drillDown.length - 1] ?? (surface === "downloads" ? "explore" : surface);
  const [page, setPage] = useState<BrowsePageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setError(null);

    libraryController
      .getBrowsePage(target)
      .then((loaded) => {
        if (!cancelled) setPage(loaded);
      })
      .catch((cause: unknown) => {
        logInternalError("BrowsePage.load failed", cause, { surface });
        if (!cancelled) setError("Could not load this feed.");
      });

    return () => {
      cancelled = true;
    };
  }, [libraryController, surface, target]);

  return (
    <div className="flex flex-col gap-6 pb-40 md:pb-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {drillDown.length > 0 && (
            <button
              type="button"
              onClick={() => setDrillDown((stack) => stack.slice(0, -1))}
              aria-label="Back"
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeftIcon size={18} aria-hidden="true" />
            </button>
          )}
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-foreground">
            {drillDown[drillDown.length - 1]?.title ?? "Browse"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Browse feed">
          {SURFACES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={surface === item.value && drillDown.length === 0}
              onClick={() => {
                setSurface(item.value);
                setDrillDown([]);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                surface === item.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p className="px-2 py-10 text-center text-sm text-muted-foreground">{error}</p>
      ) : page === null ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <SpinnerSteps size={18} color="currentColor" />
          Loading {SURFACES.find((item) => item.value === surface)?.label}...
        </div>
      ) : page.shelves.length === 0 ? (
        <p className="px-2 py-10 text-center text-sm text-muted-foreground">
          YouTube Music returned nothing for this feed.
        </p>
      ) : (
        <BrowseShelves
          shelves={page.shelves}
          playerController={playerController}
          onOpenAlbum={onOpenAlbum}
          onOpenArtist={onOpenArtist}
          onOpenPlaylist={onOpenPlaylist}
          onFollowLink={(link) =>
            setDrillDown((stack) => [
              ...stack,
              { browseId: link.browseId, title: link.title, params: link.params },
            ])}
        />
      )}
    </div>
  );
}
