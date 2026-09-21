import { cn } from "@/lib/utils";
import type { Album, Artist, BrowseLink, BrowseShelf, Playlist, Track } from "../../datasource/types";
import type { PlayerControllerActions } from "../../player/playerStore";
import { MenuDotsIcon, PlayActiveIcon } from "../icons";
import { AlbumCard } from "./AlbumCard";
import { TrackArtwork } from "./TrackArtwork";
import { usePlaylistContextMenu } from "./PlaylistContextMenu";
import { useTrackContextMenu } from "./TrackContextMenu";

/** Horizontal, scrollable, and clipped at the edge so there is a hint of more. */
const SHELF_ROW = "flex gap-2.5 sm:gap-3 overflow-x-auto pb-1.5 snap-x no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function chunkArray<T>(arr: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function QuickPickItem({
  track,
  onSelect,
  onContextMenu,
  onWarm,
}: {
  track: Track;
  onSelect: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  onWarm?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onMouseEnter={onWarm}
      onTouchStart={onWarm}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      onContextMenu={onContextMenu}
      className={cn(
        "group relative flex items-center gap-3 p-2 rounded-2xl select-none cursor-pointer text-left",
        "border border-white/5 bg-card/75 transition-colors duration-150",
        "hover:bg-card hover:border-white/15 hover:shadow-md active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="relative size-12 sm:size-13 shrink-0 rounded-xl overflow-hidden bg-muted/40 shadow-xs">
        <TrackArtwork
          artworkUrl={track.artworkUrl}
          size={56}
          iconSize={22}
          variant="album"
          className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
        />
        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md scale-90 group-hover:scale-100 transition-transform">
            <PlayActiveIcon size={14} className="translate-x-0.5" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-w-0 flex-col justify-center gap-0.5">
        <span className="truncate text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
          {track.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {track.artist || "Unknown Artist"}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu(e);
        }}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground active:scale-90 transition-all opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="More options"
      >
        <MenuDotsIcon size={16} />
      </button>
    </div>
  );
}

function ArtistTile({ artist, onOpen }: { artist: Artist; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-28 sm:w-32 shrink-0 snap-start flex-col items-center gap-2 rounded-xl p-1.5 sm:p-2 text-center transition-all hover:bg-card active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <TrackArtwork
        className="size-20 sm:size-24 rounded-full shadow-sm"
        size={96}
        artworkUrl={artist.artworkUrl}
        iconSize={28}
        variant="artist"
      />
      <span className="line-clamp-2 text-xs font-semibold text-foreground">{artist.name}</span>
    </button>
  );
}

function PlaylistTile({ playlist, onOpen }: { playlist: Playlist; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-32 sm:w-36 shrink-0 snap-start flex-col gap-2 rounded-xl p-1.5 sm:p-2 text-left transition-all hover:bg-card active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <TrackArtwork
        className="size-28 sm:size-32 rounded-xl object-cover shadow-sm border border-white/10"
        size={128}
        artworkUrl={playlist.artworkUrl}
        iconSize={28}
        variant="playlist"
      />
      <span className="line-clamp-2 text-xs font-semibold text-foreground leading-snug">{playlist.title}</span>
      <span className="truncate text-[11px] text-muted-foreground">{playlist.owner}</span>
    </button>
  );
}

/**
 * Renders browse shelves: song rows, then chips, then artwork rails.
 *
 * Shared by the Browse surfaces and the Related page, which receive the same shelf shape from
 * different endpoints. The ordering inside a shelf is fixed rather than following the response,
 * because songs read as a list and everything else reads as artwork, and interleaving the two
 * produced a column that changed rhythm every few rows.
 */
export function BrowseShelves({
  shelves,
  playerController,
  onOpenAlbum,
  onOpenArtist,
  onOpenPlaylist,
  onFollowLink,
  className,
}: {
  shelves: readonly BrowseShelf[];
  playerController: PlayerControllerActions;
  onOpenAlbum: (album: Album) => void;
  onOpenArtist: (artist: Artist) => void;
  onOpenPlaylist: (playlist: Playlist) => void;
  /** Absent hides the chips: a surface with nowhere to drill into should not offer to. */
  onFollowLink?: (link: BrowseLink) => void;
  className?: string;
}) {
  const { openTrackMenu } = useTrackContextMenu();
  const { openPlaylistMenu, openAlbumMenu } = usePlaylistContextMenu();

  const playShelfTrack = (_shelfTracks: Track[], track: Track) => {
    void playerController.playTrackById(track.id);
  };

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {shelves.map((shelf, shelfIndex) => {
        const shelfTitle = shelf.title?.trim() || (
          shelf.albums.length > 0 ? "Recommended Albums" :
          shelf.playlists.length > 0 ? "Featured Playlists" :
          shelf.artists.length > 0 ? "Featured Artists" :
          shelf.tracks.length > 0 ? "Recommended Songs" : `Section ${shelfIndex + 1}`
        );

        const hasMultipleTypes = [
          shelf.tracks.length > 0,
          shelf.albums.length > 0,
          shelf.playlists.length > 0,
          shelf.artists.length > 0,
        ].filter(Boolean).length > 1;

        return (
          <section key={`${shelfTitle}:${shelfIndex}`} className="flex flex-col gap-3.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">{shelfTitle}</h2>

            {shelf.tracks.length > 0 && (
              <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 snap-x snap-mandatory no-scrollbar [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {chunkArray(shelf.tracks, 4).map((chunk, colIndex) => (
                  <div
                    key={`col-${colIndex}`}
                    className="w-[85vw] max-w-[340px] sm:max-w-[370px] md:max-w-[400px] shrink-0 snap-start flex flex-col gap-1.5"
                  >
                    {chunk.map((track) => (
                      <QuickPickItem
                        key={track.id}
                        track={track}
                        onSelect={() => playShelfTrack(shelf.tracks, track)}
                        onContextMenu={(event) => openTrackMenu(event, track)}
                        onWarm={() => playerController.warmTrack(track)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {onFollowLink && shelf.links.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {shelf.links.map((link) => (
                  <button
                    key={link.browseId}
                    type="button"
                    onClick={() => onFollowLink(link)}
                    className="rounded-full bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {link.title}
                  </button>
                ))}
              </div>
            )}

            {shelf.albums.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {hasMultipleTypes && shelf.tracks.length > 0 && (
                  <h3 className="text-lg font-bold tracking-tight text-foreground pt-3">
                    Recommended Albums
                  </h3>
                )}
                <div className={SHELF_ROW}>
                  {shelf.albums.map((album) => (
                    <div
                      key={album.id}
                      className="w-32 sm:w-36 shrink-0 snap-start"
                      onContextMenu={(event) => openAlbumMenu(event, album)}
                    >
                      <AlbumCard
                        artworkUrl={album.artworkUrl}
                        title={album.title}
                        subtitle={album.artist}
                        onClick={() => onOpenAlbum(album)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {shelf.playlists.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {hasMultipleTypes && (shelf.tracks.length > 0 || shelf.albums.length > 0) && (
                  <h3 className="text-lg font-bold tracking-tight text-foreground pt-3">
                    Featured Playlists
                  </h3>
                )}
                <div className={SHELF_ROW}>
                  {shelf.playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onContextMenu={(event) => openPlaylistMenu(event, playlist)}
                    >
                      <PlaylistTile playlist={playlist} onOpen={() => onOpenPlaylist(playlist)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {shelf.artists.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {hasMultipleTypes && (shelf.tracks.length > 0 || shelf.albums.length > 0 || shelf.playlists.length > 0) && (
                  <h3 className="text-lg font-bold tracking-tight text-foreground pt-3">
                    Featured Artists
                  </h3>
                )}
                <div className={SHELF_ROW}>
                  {shelf.artists.map((artist) => (
                    <ArtistTile
                      key={artist.id}
                      artist={artist}
                      onOpen={() => onOpenArtist(artist)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
