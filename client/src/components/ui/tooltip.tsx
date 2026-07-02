"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

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

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-[#7aa2f7]/30 bg-[#c0caf5] px-3 py-1.5 text-sm font-medium text-[#1a1b26] shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 duration-200 ease-out origin-[--radix-tooltip-content-transform-origin]",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
