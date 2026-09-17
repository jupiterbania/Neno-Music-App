import { useState } from "react";
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
    <header className="sticky top-0 z-20 -mx-2 -mt-2 mb-2 flex h-14 items-center justify-between gap-2.5 bg-background/95 backdrop-blur-2xl px-3.5 py-2 transition-colors border-b border-white/10">
      {/* Brand Identity */}
      <motion.div
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="flex items-center gap-2.5 cursor-pointer select-none"
      >
        <div className="relative flex size-8.5 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card border border-white/10 shadow-xs">
          <img src={appIcon} alt="Neno" className="size-6 object-contain" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base font-extrabold tracking-tight text-foreground leading-none">
            Neno
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary tracking-wide uppercase">
            Music
          </span>
        </div>
      </motion.div>

      {/* Right Actions: Refresh, Search & Account */}
      <div className="flex items-center gap-1.5">
        {onRefresh && (
          <motion.button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            whileTap={{ scale: 0.85 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-50"
            aria-label="Refresh recommendations"
            title="Refresh recommendations"
          >
            <RefreshIcon
              size={19}
              className={cn("transition-transform duration-500", isRefreshing && "animate-spin text-primary")}
            />
          </motion.button>
        )}

        <motion.button
          type="button"
          onClick={onOpenSearch}
          whileTap={{ scale: 0.85 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          aria-label="Search"
        >
          <SearchIcon size={20} />
        </motion.button>

        {isSignedIn ? (
          <motion.button
            type="button"
            onClick={onOpenSettings}
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            className="group relative flex size-8 shrink-0 items-center justify-center rounded-full ring-2 ring-primary/40 transition-transform hover:ring-primary"
            aria-label="Account profile"
          >
            <AccountAvatar
              artworkUrl={account?.artworkUrl}
              className="size-7"
              iconSize={15}
            />
            <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-1.5 ring-background animate-pulse" />
          </motion.button>
        ) : (
          <GoogleSignInButton
            onClick={() => void handleSignIn()}
            isBusy={isSigningIn}
            size="sm"
            className="h-8 px-3 py-0 text-xs font-semibold gap-1.5 shadow-xs"
          />
        )}
      </div>
    </header>
  );
}
