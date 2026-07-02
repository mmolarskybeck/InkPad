import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`

function getIsMobile() {
  if (typeof window === "undefined") {
    return false
  }

  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(getIsMobile)

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
    const onChange = () => {
      setIsMobile(mql.matches)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
