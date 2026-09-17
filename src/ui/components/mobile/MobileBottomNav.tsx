import { motion } from "motion/react";
import {
  HomeActiveIcon,
  HomeIcon,
  PlaylistActiveIcon,
  PlaylistIcon,
  SearchIcon,
  SettingsActiveIcon,
  SettingsIcon,
} from "@/ui/icons";
import { cn } from "@/lib/utils";
import type { TabView } from "../../types/tab";

interface MobileBottomNavProps {
  activeView: TabView;
  onNavigateHome: () => void;
  onOpenSearch: () => void;
  onNavigateLibrary: () => void;
  onOpenSettings: () => void;
  className?: string;
}

export function MobileBottomNav({
  activeView,
  onNavigateHome,
  onOpenSearch,
  onNavigateLibrary,
  onOpenSettings,
  className,
}: MobileBottomNavProps) {
  const isHome = activeView === "home";
  const isSearch = activeView === "search";
  const isLibrary = activeView === "library";
  const isSettings = activeView === "settings";

  const navItems = [
    {
      id: "home",
      label: "Home",
      isActive: isHome,
      onClick: onNavigateHome,
      ActiveIcon: HomeActiveIcon,
      InactiveIcon: HomeIcon,
    },
    {
      id: "search",
      label: "Search",
      isActive: isSearch,
      onClick: onOpenSearch,
      ActiveIcon: SearchIcon,
      InactiveIcon: SearchIcon,
    },
    {
      id: "library",
      label: "Library",
      isActive: isLibrary,
      onClick: onNavigateLibrary,
      ActiveIcon: PlaylistActiveIcon,
      InactiveIcon: PlaylistIcon,
    },
    {
      id: "settings",
      label: "Settings",
      isActive: isSettings,
      onClick: onOpenSettings,
      ActiveIcon: SettingsActiveIcon,
      InactiveIcon: SettingsIcon,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className={cn(
        "w-full flex items-center justify-around border-t border-white/10 bg-background/90 backdrop-blur-2xl px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom,0px),8px)] shadow-[0_-8px_24px_rgba(0,0,0,0.4)] select-none",
        className,
      )}
    >
      {navItems.map((item) => (
        <motion.button
          key={item.id}
          type="button"
          onClick={item.onClick}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-1 py-1.5 transition-colors rounded-xl",
            item.isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={item.label}
        >
          {/* Sliding glowing active background pill */}
          {item.isActive && (
            <motion.div
              layoutId="mobileNavActivePill"
              transition={{ type: "spring", stiffness: 450, damping: 32 }}
              className="absolute inset-0 bg-primary/10 rounded-xl -z-10 shadow-[0_0_16px_rgba(255,0,51,0.15)]"
            />
          )}

          <motion.div
            animate={{
              scale: item.isActive ? 1.08 : 1,
              y: item.isActive ? -1 : 0,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="relative"
          >
            {item.isActive ? (
              <item.ActiveIcon size={22} className="text-primary drop-shadow-[0_2px_8px_rgba(255,0,51,0.4)]" />
            ) : (
              <item.InactiveIcon size={22} className="text-muted-foreground" />
            )}
          </motion.div>
          <span
            className={cn(
              "text-[10px] tracking-tight leading-tight transition-all",
              item.isActive ? "font-bold text-primary" : "font-medium text-muted-foreground",
            )}
          >
            {item.label}
          </span>
        </motion.button>
      ))}
    </nav>
  );
}
