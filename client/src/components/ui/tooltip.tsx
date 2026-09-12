"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"
import { Shortcut } from "@/components/ui/kbd"
import type { ShortcutKey } from "@/lib/keyboard-shortcuts"

let hadKeyboardNavigation = false

function isKeyboardNavigationKey(event: KeyboardEvent) {
  return event.key === "Tab"
}

const TooltipProvider = ({
  delayDuration = 850,
  skipDelayDuration = 200,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      hadKeyboardNavigation = isKeyboardNavigationKey(event)
    }

    const handlePointerDown = () => {
      hadKeyboardNavigation = false
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        hadKeyboardNavigation = false
      }
    }

    const handleWindowFocus = () => {
      hadKeyboardNavigation = false
    }

    window.addEventListener("keydown", handleKeyDown, true)
    window.addEventListener("pointerdown", handlePointerDown, true)
    window.addEventListener("focus", handleWindowFocus)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true)
      window.removeEventListener("pointerdown", handlePointerDown, true)
      window.removeEventListener("focus", handleWindowFocus)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    >
      {children}
    </TooltipPrimitive.Provider>
  )
}

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onFocus, ...props }, ref) => (
  <TooltipPrimitive.Trigger
    {...props}
    ref={ref}
    onFocus={(event) => {
      onFocus?.(event)
      const shouldOpenOnFocus = hadKeyboardNavigation
      hadKeyboardNavigation = false

      if (!shouldOpenOnFocus) {
        event.preventDefault()
      }
    }}
  />
))
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName

interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {
  /**
   * Optional keyboard shortcut rendered as keycaps after the label, e.g.
   * `shortcut={["mod", "z"]}`. Uses platform glyphs on Apple devices.
   */
  shortcut?: readonly ShortcutKey[]
}

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 6, shortcut, children, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 flex max-w-72 items-center gap-2 overflow-hidden rounded-md border border-border-color bg-panel-bg px-2.5 py-1.5 text-[0.75rem] font-medium leading-4 text-text-emphasis shadow-md",
      "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 duration-150 ease-out origin-[--radix-tooltip-content-transform-origin] motion-reduce:animate-none",
      className
    )}
    {...props}
  >
    <span className="min-w-0">{children}</span>
    {shortcut && shortcut.length > 0 && (
      <Shortcut keys={shortcut} className="shrink-0 text-text-secondary" />
    )}
  </TooltipPrimitive.Content>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
