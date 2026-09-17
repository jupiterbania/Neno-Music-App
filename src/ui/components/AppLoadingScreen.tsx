import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { YouTubeMusicIcon } from "./YouTubeConnectionPopup";

/*
 * The accent bloom, as a gradient rather than a blurred circle.
 */
const LOADING_GLOW =
  "radial-gradient(circle, color-mix(in oklab, var(--color-primary) 14%, transparent) 0%, color-mix(in oklab, #ff0000 8%, transparent) 40%, transparent 70%)";

const LOADING_LINES = [
  "Connecting to YouTube Music...",
  "Tuning the soundstage...",
  "Syncing your music engine...",
  "Loading high-fidelity audio...",
  "Building today's vibe...",
];

interface AppLoadingScreenProps {
  isLeaving: boolean;
}

export function AppLoadingScreen({ isLeaving }: AppLoadingScreenProps) {
  const loadingLine = LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] grid place-items-center bg-background transition-all duration-300",
        isLeaving ? "pointer-events-none opacity-0 scale-105" : "opacity-100 scale-100",
      )}
      role="status"
      aria-label="Loading"
      aria-live="polite"
    >
      {/* Accent bloom behind the mark */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 size-[660px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse"
        style={{ background: LOADING_GLOW }}
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* Glowing emblem container with pulsating ring */}
        <div className="relative flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.95, 1.2, 0.95] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            className="absolute size-28 rounded-full bg-red-600/30 blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-b from-[#222]/90 to-[#111]/95 border border-white/15 shadow-[0_10px_35px_rgba(255,0,0,0.25)] backdrop-blur-xl"
          >
            <YouTubeMusicIcon size={44} className="drop-shadow-lg" />
            <span className="absolute -inset-1 rounded-3xl border border-red-500/30 animate-pulse pointer-events-none" />
          </motion.div>
        </div>

        {/* Live Loading Badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3.5 py-1 backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-foreground tracking-tight">
              {loadingLine}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">
            <span>Neno</span>
            <span>•</span>
            <span className="text-red-500">YouTube Engine</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
