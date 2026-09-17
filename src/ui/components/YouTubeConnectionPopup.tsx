import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useLibraryState } from "../../player/playerStore";
import { AccountAvatar } from "./AccountSwitcher";
import { CheckActiveIcon } from "@/ui/icons";

export function YouTubeMusicIcon({ size = 24, className }: { size?: number | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="12" fill="#FF0000" />
      <circle cx="12" cy="12" r="7.5" fill="#FF0000" stroke="#FFFFFF" strokeWidth="1.7" />
      <polygon points="10,8.5 15.5,12 10,15.5" fill="#FFFFFF" />
    </svg>
  );
}

interface YouTubeConnectionPopupProps {
  onOpenSettings?: () => void;
  className?: string;
}

export function YouTubeConnectionPopup({ onOpenSettings, className }: YouTubeConnectionPopupProps) {
  const libraryState = useLibraryState();
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const account = libraryState.library?.account;
  const isRestoring = libraryState.status === "restoring";
  const isLoading = libraryState.status === "loading";
  const isAuthorizing = libraryState.status === "authorizing";
  const isError = libraryState.status === "error";
  const isReady = libraryState.status === "ready" || Boolean(libraryState.library);
  const isGuest = libraryState.status === "signed-out";

  const isConnecting = isRestoring || isAuthorizing || (isLoading && !libraryState.library);
  const isConnected = isReady || isGuest;

  // Auto-dismiss smoothly after 100% connected (unless expanded by user)
  useEffect(() => {
    if (!isConnected || isExpanded) return;
    const timer = window.setTimeout(() => {
      setIsVisible(false);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [isConnected, isExpanded]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="yt-connection-popup"
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.92, transition: { duration: 0.35, ease: "easeInOut" } }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
            "fixed top-3 inset-x-3 sm:inset-x-auto sm:right-5 sm:w-[380px] z-50 pointer-events-auto",
            className,
          )}
        >
        <div
          onClick={() => setIsExpanded((prev) => !prev)}
          className={cn(
            "relative overflow-hidden rounded-2xl p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] cursor-pointer select-none",
            "border border-white/15 backdrop-blur-2xl bg-gradient-to-b from-[#1c1c20]/95 via-[#141417]/95 to-[#0e0e11]/98",
            "transition-all duration-300 transform-gpu hover:border-white/25",
          )}
        >
          {/* Subtle Ambient Red Glow */}
          <div
            className="pointer-events-none absolute -top-10 -right-10 size-36 rounded-full bg-red-600/20 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-10 -left-10 size-28 rounded-full bg-primary/15 blur-xl"
            aria-hidden="true"
          />

          {/* Header Row */}
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Animated YT Icon Badge */}
              <div className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-black/40 border border-white/10 shadow-inner">
                <YouTubeMusicIcon size={24} />
                {isConnecting && (
                  <span className="absolute -inset-1 rounded-xl border border-red-500/40 animate-ping" />
                )}
                {isConnected && (
                  <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-500 ring-2 ring-[#141417] flex items-center justify-center">
                    <CheckActiveIcon size={9} className="text-black stroke-[3]" />
                  </span>
                )}
              </div>

              {/* Title & Live Status */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                    YouTube Music
                  </span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isConnecting && "bg-amber-400 animate-pulse",
                      isConnected && "bg-emerald-400",
                      isError && "bg-rose-500",
                    )}
                  />
                </div>
                <span className="truncate text-sm font-semibold tracking-tight text-white">
                  {isConnecting
                    ? "Connecting to Music Engine..."
                    : isError
                    ? "Connection Failed"
                    : isGuest
                    ? "Connected (Guest Stream)"
                    : `Connected as ${account?.name || "YouTube User"}`}
                </span>
              </div>
            </div>

            {/* Quick Action / Close Button */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVisible(false);
                }}
                className="flex size-7 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white active:scale-90 transition-all"
                aria-label="Close popup"
              >
                <span className="text-xs font-bold leading-none">✕</span>
              </button>
            </div>
          </div>

          {/* Connection Status Pipeline Bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: "15%" }}
                animate={{
                  width: isConnecting ? "60%" : isConnected ? "100%" : "30%",
                }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full transition-colors",
                  isConnecting && "bg-gradient-to-r from-amber-400 to-red-500 animate-pulse",
                  isConnected && "bg-gradient-to-r from-red-500 via-rose-500 to-emerald-400",
                  isError && "bg-rose-500",
                )}
              />
            </div>
            <span className="text-[10px] font-medium text-white/60 tabular-nums">
              {isConnecting ? "Syncing..." : isConnected ? "100% Ready" : "Error"}
            </span>
          </div>

          {/* Structured Details Badge Row */}
          <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-white/70">
            <div className="flex items-center gap-1.5 truncate">
              {account?.artworkUrl ? (
                <AccountAvatar artworkUrl={account.artworkUrl} className="size-4" iconSize={10} />
              ) : (
                <span className="size-2 rounded-full bg-red-500/80" />
              )}
              <span className="truncate font-medium">
                {account?.name ? account.name : "High-Fidelity Stream"}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 font-medium text-white/50">
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/80 uppercase">
                Opus 256k
              </span>
              <span>•</span>
              <span className="text-emerald-400">Online</span>
            </div>
          </div>

          {/* Expandable Technical Info Drawer */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden border-t border-white/10 pt-2.5 mt-2.5 space-y-1.5 text-xs text-white/80"
              >
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-white/50">Stream Protocol:</span>
                  <span className="font-mono text-[11px] text-white/90">YouTube Innertube v1</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-white/50">Audio Pipeline:</span>
                  <span className="text-emerald-400 font-medium">Hardware Accelerated</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-white/50">Session Status:</span>
                  <span className="text-white/90">{isGuest ? "Guest Access" : "Authenticated"}</span>
                </div>

                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsVisible(false);
                      onOpenSettings();
                    }}
                    className="w-full mt-2 rounded-xl bg-white/10 py-1.5 text-center text-xs font-semibold text-white hover:bg-white/20 active:scale-95 transition-all"
                  >
                    Open Account Settings
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
