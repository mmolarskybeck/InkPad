/**
 * Width tiers for the editor pane header. The header measures itself
 * (ResizeObserver) rather than the viewport, because the pane can be narrow
 * inside a wide window.
 */
export type EditorHeaderTier = "wide" | "compact" | "narrow";

/** Below this the "• Saved" text collapses into a status dot. */
export const EDITOR_HEADER_COMPACT_WIDTH = 520;
/** Below this Undo/Redo drop out too (both still have keyboard shortcuts). */
export const EDITOR_HEADER_NARROW_WIDTH = 380;

export function getEditorHeaderTier(width: number | null | undefined): EditorHeaderTier {
  // Before the first measurement, assume the roomiest tier so nothing flickers
  // away on mount in the common (wide) case.
  if (width == null) return "wide";
  if (width < EDITOR_HEADER_NARROW_WIDTH) return "narrow";
  if (width < EDITOR_HEADER_COMPACT_WIDTH) return "compact";
  return "wide";
}
