import { useState } from "react";
import { RefreshIcon, SearchIcon } from "@/ui/icons";
import { cn } from "@/lib/utils";
import appIcon from "../../../../assets/img/Logo.png";
import { useLibraryState } from "../../../player/playerStore";
import { AccountAvatar } from "../AccountSwitcher";
import { GoogleSignInButton } from "../GoogleSignInButton";

interface MobileHeaderProps {
  onOpenSearch: () => void;
  onSignIn: () => Promise<void>;
  onOpenSettings?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function MobileHeader({
  onOpenSearch,
  onSignIn,
  onOpenSettings,
  onRefresh,
  isRefreshing = false,
}: MobileHeaderProps) {
  const libraryState = useLibraryState();
  const account = libraryState.library?.account;
  const isSignedIn =
    (libraryState.status === "ready" || libraryState.status === "loading") &&
    Boolean(account);

  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await onSignIn();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 -mx-2 -mt-2 mb-1 flex h-11 items-center justify-between gap-2 bg-background/95 backdrop-blur-2xl px-3 py-1 transition-colors border-b border-border/25">
      {/* Brand Identity */}
      <div className="flex items-center gap-2">
        <div className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card border border-border/40 shadow-xs">
          <img src={appIcon} alt="Neno" className="size-5 object-contain" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-extrabold tracking-tight text-foreground leading-none">
            Neno
          </span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary tracking-wide uppercase">
            Music
          </span>
        </div>
      </div>

      {/* Right Actions: Refresh, Search & Account */}
      <div className="flex items-center gap-1">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-card hover:text-foreground active:scale-90 disabled:opacity-50"
            aria-label="Refresh recommendations"
            title="Refresh recommendations"
          >
            <RefreshIcon
              size={17}
              className={cn("transition-transform duration-500", isRefreshing && "animate-spin text-primary")}
            />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenSearch}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-card hover:text-foreground active:scale-90"
          aria-label="Search"
        >
          <SearchIcon size={18} />
        </button>

        {isSignedIn ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="group relative flex size-7 shrink-0 items-center justify-center rounded-full ring-1.5 ring-primary/40 transition-transform active:scale-90 hover:ring-primary"
            aria-label="Account profile"
          >
            <AccountAvatar
              artworkUrl={account?.artworkUrl}
              className="size-6"
              iconSize={14}
            />
            <span className="absolute bottom-0 right-0 size-1.5 rounded-full bg-emerald-500 ring-1 ring-background" />
          </button>
        ) : (
          <GoogleSignInButton
            onClick={() => void handleSignIn()}
            isBusy={isSigningIn}
            size="sm"
            className="h-7 px-2.5 py-0 text-xs gap-1 shadow-xs"
          />
        )}
      </div>
    </header>
  );
}
