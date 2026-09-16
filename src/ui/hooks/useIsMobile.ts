import { useEffect, useState } from "react";
import { isMobileDevice } from "../platform";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return isMobileDevice || window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => {
      setIsMobile(isMobileDevice || mediaQuery.matches);
    };

    update();
    mediaQuery.addEventListener("change", update);
    window.addEventListener("resize", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return isMobile;
}
