import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  HomeActiveIcon,
  SearchIcon,
  LyricsActiveIcon,
  DownloadIcon,
  SettingsActiveIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckIcon,
  CloseIcon,
  PlayActiveIcon,
} from "@/ui/icons";
import { cn } from "@/lib/utils";

interface MobileOnboardingProps {
  onFinish: () => void;
  onSkip: () => void;
}

interface StepData {
  id: string;
  badge: string;
  title: string;
  description: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  gradient: string;
  iconBg: string;
  highlightText: string;
}

const MOBILE_TOUR_STEPS: StepData[] = [
  {
    id: "home",
    badge: "Home & Explore",
    title: "Discover Trending Music",
    description:
      "Explore top charts, personalized mixes, new releases, and mood stations curated specially for you on the Home screen.",
    Icon: HomeActiveIcon,
    gradient: "from-red-500/25 via-red-600/10 to-transparent",
    iconBg: "bg-red-500/15 text-red-500 border-red-500/30",
    highlightText: "Ad-free streaming with no interruptions",
  },
  {
    id: "search",
    badge: "Instant Search",
    title: "Millions of Songs",
    description:
      "Search for your favourite artists, tracks, albums, or playlists. You can also paste direct YouTube music links to play instantly.",
    Icon: SearchIcon,
    gradient: "from-blue-500/25 via-indigo-600/10 to-transparent",
    iconBg: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    highlightText: "Quick auto-suggestions & lightning search",
  },
  {
    id: "player",
    badge: "Mini Player & Lyrics",
    title: "Full Player & Live Lyrics",
    description:
      "Tap the bottom floating player bar to expand into full-screen with real-time synchronized karaoke lyrics, queue, and equalizer.",
    Icon: LyricsActiveIcon,
    gradient: "from-emerald-500/25 via-teal-600/10 to-transparent",
    iconBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    highlightText: "Real-time synchronized lyric scrolls",
  },
  {
    id: "downloads",
    badge: "Zero-Latency Offline",
    title: "Download & Play Offline",
    description:
      "Save your favourite songs and albums directly to your device storage. Play anytime without internet, buffering, or data usage.",
    Icon: DownloadIcon,
    gradient: "from-purple-500/25 via-violet-600/10 to-transparent",
    iconBg: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    highlightText: "Instant 0ms latency playback from local storage",
  },
  {
    id: "settings",
    badge: "Personalization",
    title: "Customize & Connect",
    description:
      "Sign in with your YouTube account to access your personal library, tune audio quality, adjust equalizer, and switch themes.",
    Icon: SettingsActiveIcon,
    gradient: "from-amber-500/25 via-orange-600/10 to-transparent",
    iconBg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    highlightText: "Full library sync & high-res audio controls",
  },
];

export function MobileOnboarding({ onFinish, onSkip }: MobileOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchStartXRef = useRef<number | null>(null);

  const step = MOBILE_TOUR_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === MOBILE_TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onFinish();
    } else {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    touchStartXRef.current = null;

    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md px-4 select-none animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 15 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-popover/95 border border-white/10 p-6 shadow-2xl backdrop-blur-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Glow ambient background based on active slide */}
        <div
          className={cn(
            "pointer-events-none absolute -top-24 -left-24 size-64 rounded-full bg-gradient-to-br blur-3xl opacity-60 transition-all duration-500",
            step.gradient,
          )}
        />

        {/* Top bar: Step progress & Skip */}
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Step {currentStep + 1} of {MOBILE_TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="flex items-center gap-1 rounded-full bg-card/80 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95 border border-border/40"
            aria-label="Skip tour"
          >
            <span>Skip</span>
            <CloseIcon size={13} />
          </button>
        </div>

        {/* Animated Slide Content */}
        <div className="relative z-10 my-6 min-h-[250px] flex flex-col items-center text-center justify-center">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step.id}
              custom={direction}
              initial={{ x: direction * 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -direction * 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="flex flex-col items-center"
            >
              {/* Feature Icon with Pulsing Halo */}
              <div className="relative my-2">
                <div
                  className={cn(
                    "flex size-18 items-center justify-center rounded-2xl border shadow-xl backdrop-blur-xl transition-all",
                    step.iconBg,
                  )}
                >
                  <step.Icon size={36} />
                </div>
              </div>

              {/* Badge */}
              <span className="mt-3 inline-block rounded-full bg-primary/10 border border-primary/20 px-3 py-0.5 text-[11px] font-semibold text-primary">
                {step.badge}
              </span>

              {/* Title & Description */}
              <h2 className="mt-2.5 text-lg font-bold text-foreground tracking-tight leading-snug">
                {step.title}
              </h2>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-[280px]">
                {step.description}
              </p>

              {/* Feature highlight pill */}
              <div className="mt-3.5 flex items-center gap-1.5 rounded-xl bg-card/60 border border-border/30 px-3 py-1.5 text-[11px] font-medium text-foreground/90">
                <PlayActiveIcon size={12} className="text-primary shrink-0" />
                <span>{step.highlightText}</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Stepper Dots Indicator */}
        <div className="relative z-10 flex justify-center items-center gap-1.5 mb-6" aria-hidden="true">
          {MOBILE_TOUR_STEPS.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setDirection(idx > currentStep ? 1 : -1);
                setCurrentStep(idx);
              }}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                idx === currentStep
                  ? "w-7 bg-primary shadow-[0_0_8px_rgba(255,0,51,0.5)]"
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
              aria-label={`Go to step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex items-center gap-2.5">
          {!isFirst && (
            <button
              type="button"
              onClick={handlePrev}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card/80 py-3 text-xs font-semibold text-foreground transition-all hover:bg-card active:scale-95"
            >
              <ArrowLeftIcon size={15} />
              <span>Back</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleNext}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95",
              isFirst && "w-full",
            )}
          >
            <span>{isLast ? "Start Listening" : "Next"}</span>
            {isLast ? <CheckIcon size={15} /> : <ArrowRightIcon size={15} />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
