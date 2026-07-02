import { useEffect, useRef, useState } from "react";

/**
 * Tracks how many pixels of the layout viewport are covered by the on-screen
 * keyboard, via the visualViewport API. iOS Safari does not shrink `dvh`
 * for the keyboard, so callers use this to shrink layout/position fixed UI
 * above it explicitly.
 */
export function useMobileKeyboardInset(isMobile: boolean, onChange?: () => void) {
  const [inset, setInset] = useState(0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!isMobile || typeof window === "undefined" || !window.visualViewport) {
      setInset(0);
      return;
    }

    const viewport = window.visualViewport;
    let frame = 0;

    const updateInset = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = Math.max(
          0,
          Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
        );
        setInset(next > 24 ? next : 0);
        onChangeRef.current?.();
      });
    };

    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    window.addEventListener("orientationchange", updateInset);

    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
      window.removeEventListener("orientationchange", updateInset);
    };
  }, [isMobile]);

  return inset;
}
