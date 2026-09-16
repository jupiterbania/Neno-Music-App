import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { AlbumIcon, ClockIcon, CompassIcon, DownloadIcon } from "@/ui/icons";
import { useOfflineState } from "../../player/offlineStore";
import { usePlayHistory } from "../../player/playHistory";
import { useLibraryState } from "../../player/playerStore";

export interface HomeDestinationHandlers {
  onOpenLibrary: () => void;
  onOpenBrowse: () => void;
  onOpenHistory: () => void;
  onOpenDownloads: () => void;
}

/**
 * The app's four primary destinations, structured cleanly for both phone and desktop screens.
 */
export function HomeDestinations({
  onOpenLibrary,
  onOpenBrowse,
  onOpenHistory,
  onOpenDownloads,
}: HomeDestinationHandlers) {
  const libraryState = useLibraryState();
  const offline = useOfflineState();
  const history = usePlayHistory();

  const library = libraryState.library;
  const savedCount = (library?.playlists.length ?? 0) + (library?.albums.length ?? 0);
  const downloadCount = Object.keys(offline.entries).length;

  const cards = [
    {
      key: "library",
      label: "Library",
      hint: "Songs, albums, playlists",
      icon: AlbumIcon,
      onClick: onOpenLibrary,
      badge: savedCount > 0 ? `${savedCount} saved` : undefined,
      colorClass:
        "bg-violet-500/15 text-violet-600 dark:text-violet-400 group-hover/dest:bg-violet-600 group-hover/dest:text-white",
      badgeColor: "text-violet-600 dark:text-violet-400 font-semibold",
    },
    {
      key: "browse",
      label: "Browse",
      hint: "Charts, moods, genres",
      icon: CompassIcon,
      onClick: onOpenBrowse,
      colorClass:
        "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover/dest:bg-emerald-600 group-hover/dest:text-white",
      badgeColor: "",
    },
    {
      key: "history",
      label: "History",
      hint: "Recently played songs",
      icon: ClockIcon,
      onClick: onOpenHistory,
      badge: history.length > 0 ? `${history.length} plays` : undefined,
      colorClass:
        "bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover/dest:bg-amber-600 group-hover/dest:text-white",
      badgeColor: "text-amber-600 dark:text-amber-400 font-semibold",
    },
    {
      key: "downloads",
      label: "Downloads",
      hint: "Saved offline songs",
      icon: DownloadIcon,
      onClick: onOpenDownloads,
      badge: offline.downloadingId
        ? offline.progress !== null
          ? `${offline.progress}%`
          : "downloading"
        : downloadCount > 0
          ? `${downloadCount} offline`
          : undefined,
      colorClass:
        "bg-sky-500/15 text-sky-600 dark:text-sky-400 group-hover/dest:bg-sky-600 group-hover/dest:text-white",
      badgeColor: "text-sky-600 dark:text-sky-400 font-semibold",
    },
  ];

  return (
    <section className="flex flex-col gap-3" aria-label="Quick Destinations">
      <div className="grid grid-cols-2 gap-2.5 sm:[grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
        {cards.map((card) => (
          <motion.button
            key={card.key}
            type="button"
            onClick={card.onClick}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={cn(
              "group/dest flex items-center gap-3 overflow-hidden rounded-2xl bg-card/75 backdrop-blur-md p-3 text-left border border-border/50",
              "transition-all hover:bg-card hover:border-border/80 shadow-xs",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-200",
                card.colorClass,
              )}
            >
              <card.icon size={20} />
            </span>

            <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <span className="truncate text-sm font-semibold leading-tight text-foreground">
                {card.label}
              </span>
              <span
                className={cn(
                  "truncate text-[11px] leading-tight",
                  card.badge ? card.badgeColor : "text-muted-foreground",
                )}
              >
                {card.badge ?? card.hint}
              </span>
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
