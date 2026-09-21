import { useState, memo } from "react";
import { motion } from "motion/react";
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

function MobileHeaderInner({
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
  const isConnecting =
    !isSignedIn &&
    (libraryState.status === "restoring" ||
      libraryState.status === "loading" ||
      libraryState.status === "authorizing");

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
    <header className="sticky top-0 z-20 w-full mb-2 flex h-13 items-center justify-between gap-2 bg-background/98 backdrop-blur-md px-2.5 py-1.5 transition-colors border-b border-white/10 overflow-hidden">
      {/* Brand Identity */}
      <motion.div
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex items-center gap-2 cursor-pointer select-none shrink-0"
      >
        <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card border border-white/10 shadow-xs">
          <img src={appIcon} alt="Neno" className="size-5.5 object-contain" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-extrabold tracking-tight text-foreground leading-none">
            Neno
          </span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary tracking-wide uppercase">
            Music
          </span>
        </div>
      </motion.div>

      {/* Right Actions: Refresh, Search & Account */}
      <div className="flex items-center gap-1 shrink-0">
        {onRefresh && (
          <motion.button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            whileTap={{ scale: 0.85 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-50"
            aria-label="Refresh recommendations"
            title="Refresh recommendations"
          >
            <RefreshIcon
              size={17}
              className={cn("transition-transform duration-500", isRefreshing && "animate-spin text-primary")}
            />
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={onOpenSearch}
          whileTap={{ scale: 0.85 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          aria-label="Search"
        >
          <SearchIcon size={18} />
        </motion.button>

        {isSignedIn ? (
          <motion.button
            type="button"
            onClick={onOpenSettings}
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="group relative flex size-7.5 shrink-0 items-center justify-center rounded-full ring-1.5 ring-primary/40 transition-transform hover:ring-primary"
            aria-label="Account profile"
          >
            <AccountAvatar
              artworkUrl={account?.artworkUrl}
              className="size-6.5"
              iconSize={14}
            />
            <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-1.5 ring-background animate-pulse" />
          </motion.button>
        ) : isConnecting ? (
          <div className="relative flex h-7.5 items-center gap-1.5 rounded-full border border-red-500/30 bg-gradient-to-r from-red-500/15 to-red-500/5 px-2.5 shadow-xs shrink-0 select-none overflow-hidden">
            <div className="relative flex size-3.5 shrink-0 items-center justify-center rounded-full bg-red-600 shadow-xs">
              <svg viewBox="0 0 24 24" className="size-2 fill-white" aria-hidden="true">
                <circle cx="12" cy="12" r="7.5" fill="none" stroke="white" strokeWidth="2.2" />
                <polygon points="10,8.5 15.5,12 10,15.5" fill="white" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-foreground/90 tracking-tight">
              Connecting
            </span>
            <span className="relative flex size-1.5 shrink-0 ml-0.5">
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            </span>
          </div>
        ) : (
          <GoogleSignInButton
            onClick={() => void handleSignIn()}
            isBusy={isSigningIn}
            size="sm"
            label="Sign In"
            className="h-7.5 px-2.5 text-xs font-semibold gap-1.5 shadow-xs"
          />
        )}
      </div>
    </header>
  );
}

/**
 * Memoized: sits at the top of every mobile page and had no guard against re-rendering
 * on every parent state change (recommendations loading, library updates, etc.).
 * Account / isSignedIn are the only values that actually change its output.
 */
export const MobileHeader = memo(MobileHeaderInner);
