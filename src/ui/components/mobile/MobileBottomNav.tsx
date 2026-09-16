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
        "w-full flex items-center justify-around border-t border-border/40 bg-background/90 backdrop-blur-2xl px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom,0px),8px)] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] select-none",
        className,
      )}
    >
      {navItems.map((item) => (
        <motion.button
          key={item.id}
          type="button"
          onClick={item.onClick}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-1 py-1 transition-colors",
            item.isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={item.label}
        >
          <div className="relative">
            {item.isActive ? (
              <item.ActiveIcon size={22} className="transition-transform duration-200" />
            ) : (
              <item.InactiveIcon size={22} className="transition-transform duration-200" />
            )}
          </div>
          <span
            className={cn(
              "text-[10px] tracking-tight leading-tight",
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
