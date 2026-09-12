import * as React from "react"

/**
 * Reads a media query once, safely. Returns false where `matchMedia` is
 * unavailable (SSR, jsdom without a polyfill) so callers get the "narrow"
 * branch instead of throwing.
 */
export function getMediaQueryMatches(query: string) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }

  return window.matchMedia(query).matches
}

/** Subscribes to a CSS media query and re-renders when it flips. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(() => getMediaQueryMatches(query))

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mediaQueryList = window.matchMedia(query)
    const onChange = () => {
      setMatches(mediaQueryList.matches)
    }

    // Older Safari only has the deprecated listener API.
    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", onChange)
    } else {
      mediaQueryList.addListener(onChange)
    }

    setMatches(mediaQueryList.matches)

    return () => {
      if (typeof mediaQueryList.removeEventListener === "function") {
        mediaQueryList.removeEventListener("change", onChange)
      } else {
        mediaQueryList.removeListener(onChange)
      }
    }
  }, [query])

  return matches
}
