import * as React from "react"

import { cn } from "@/lib/utils"
import {
  formatShortcutKey,
  isApplePlatform,
  toAriaKeyShortcuts,
  type ShortcutKey,
} from "@/lib/keyboard-shortcuts"

/**
 * A single keycap. Inherits the surrounding text colour so it reads
 * correctly inside tooltips, menus, and the command palette alike.
 */
const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded border border-border-color bg-editor-bg px-1 font-sans text-[0.6875rem] font-medium leading-none text-text-primary shadow-[inset_0_-1px_0_0_var(--border-color)]",
        className
      )}
      {...props}
    />
  )
)
Kbd.displayName = "Kbd"

/** Lays out a chord of keycaps. */
const KbdGroup = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn("inline-flex items-center gap-0.5 font-sans", className)}
      {...props}
    />
  )
)
KbdGroup.displayName = "KbdGroup"

interface ShortcutProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** Keys in press order, e.g. `["mod", "shift", "z"]`. `mod` renders as ⌘ or Ctrl. */
  keys: readonly ShortcutKey[]
}

/**
 * Renders a keyboard shortcut as a group of keycaps, choosing platform
 * glyphs (⌘ ⇧) or words (Ctrl Shift) to match the viewer's OS. The group
 * carries an `aria-keyshortcuts`-style label so screen readers announce a
 * readable chord rather than the individual glyphs.
 */
const Shortcut = React.forwardRef<HTMLElement, ShortcutProps>(
  ({ keys, className, ...props }, ref) => {
    const apple = isApplePlatform()
    return (
      <KbdGroup
        ref={ref}
        aria-label={toAriaKeyShortcuts(keys, apple).replace(/\+/g, " ")}
        className={className}
        {...props}
      >
        {keys.map((key, index) => (
          <Kbd key={`${key}-${index}`} aria-hidden="true">
            {formatShortcutKey(key, apple)}
          </Kbd>
        ))}
      </KbdGroup>
    )
  }
)
Shortcut.displayName = "Shortcut"

export { Kbd, KbdGroup, Shortcut }
