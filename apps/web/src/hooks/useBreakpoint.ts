import { useState, useEffect, useMemo } from "react";

export function useBreakpoint() {
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia("(max-width: 767px)").matches,
  );
  const [isTablet, setIsTablet] = useState(() =>
    window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches,
  );

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const tabletQuery = window.matchMedia(
      "(min-width: 768px) and (max-width: 1023px)",
    );

    const handleMobile = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const handleTablet = (e: MediaQueryListEvent) => setIsTablet(e.matches);

    mobileQuery.addEventListener("change", handleMobile);
    tabletQuery.addEventListener("change", handleTablet);
    return () => {
      mobileQuery.removeEventListener("change", handleMobile);
      tabletQuery.removeEventListener("change", handleTablet);
    };
  }, []);

  return useMemo(
    () => ({
      isMobile,
      isTablet,
      isDesktop: !isMobile && !isTablet,
      isMobileOrTablet: isMobile || isTablet,
    }),
    [isMobile, isTablet],
  );
}
