import { useMediaQuery } from "@/hooks/use-media-query"

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`

export function useIsMobile() {
  return useMediaQuery(MOBILE_MEDIA_QUERY)
}
