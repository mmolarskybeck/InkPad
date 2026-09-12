import * as React from "react"

/**
 * Measures an element's own width with a ResizeObserver. Returns a ref
 * callback (so the observer re-attaches whenever the element mounts or
 * unmounts) and the last measured width, or null before the first
 * measurement / where ResizeObserver is unavailable.
 */
export function useElementWidth<T extends HTMLElement>() {
  const [element, setElement] = React.useState<T | null>(null)
  const [width, setWidth] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    if (!element) {
      setWidth(null)
      return
    }

    if (typeof ResizeObserver === "undefined") {
      return
    }

    setWidth(element.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setWidth(entry.contentRect.width)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return { ref: setElement, width }
}
