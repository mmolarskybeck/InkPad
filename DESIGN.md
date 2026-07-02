---
name: InkPad
description: A sleek web-based IDE for Ink story development. Precise, responsive, tactile feedback without distraction.
colors:
  # Default theme (dark, "Tokyo Night"-inspired) — see Section 2 for light,
  # high-contrast, and the preview-only sepia theme.
  editor-bg: "#1b1c27"
  panel-bg: "#1e2233"
  border-color: "#292e42"
  accent-blue: "#7692f9"
  secondary-blue: "#80d4ff"
  text-primary: "#a6b0d8"
  text-emphasis: "#cbd5f6"
  text-secondary: "#868fb6"
  success: "#5ed9a6"
  error: "#f7788f"
  warning: "#ffbf66"
  syntax-keyword: "#d49bf8"
  syntax-string: "#9ece6a"
  syntax-number: "#ffab66"
typography:
  display:
    fontFamily: "var(--font-sans, Inter), sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-sans, Inter), sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "var(--font-sans, Inter), sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "var(--font-sans, Inter), sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  label:
    fontFamily: "var(--font-sans, Inter), sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.05em"
  code:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    fontVariantLigatures: "none"
rounded:
  lg: "8px"
  md: "6px"
  sm: "4px"
  xs: "2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-blue}"
    textColor: "var(--primary-foreground)"
    rounded: "{rounded.md}"
    padding: "8px 16px (h-10)"
  button-secondary:
    backgroundColor: "var(--secondary)"
    textColor: "var(--secondary-foreground)"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "var(--destructive)"
    textColor: "var(--destructive-foreground)"
  input-default:
    backgroundColor: "{colors.editor-bg}"
    borderColor: "{colors.border-color}"
    textColor: "{colors.text-emphasis}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card-default:
    backgroundColor: "{colors.panel-bg}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: InkPad

## 1. Overview

**Creative North Star: "The Clean Desk"**

InkPad's design philosophy centers on the writer's workspace: a clean, minimal desk where focus is paramount and every element earns its place. The default dark theme is a **Tokyo Night**-inspired indigo-navy (editor `#1b1c27`, panel `#1e2233`) rather than a neutral VS Code gray — it reads as intentional and slightly nocturnal without tipping into novelty. The accent palette is restrained: a periwinkle-blue for primary actions, a paler sky-blue for secondary emphasis (brackets, operators, punctuation), and a mint green reserved for success/forward-motion states. All interactions feel precise and responsive — buttons scale down slightly on press (`active:scale-[0.98]`) for tactile feedback, but there is no gratuitous motion.

This system rejects: cluttered UIs with competing affordances, overly "designed" or flashy interfaces, clunky or sluggish interactions, and corporate-heavy aesthetics. It embraces the restraint of Obsidian's sidebar layout, VS Code's clarity, and Scrivener's respect for the writer's workflow.

**Key Characteristics:**
- **Dark ("Tokyo Night") is the default theme.** Light and high-contrast are user-selectable alternatives, plus a system-follows-OS option. All four apply app-wide (editor chrome, panels, dialogs).
- A separate **story preview theme** can be pinned independently of the app theme — `light`, `dark`, `high-contrast`, or a warm **sepia** reading theme — or left on "Match InkPad theme" (the default) to inherit whatever the app theme is.
- One primary accent-blue, one secondary sky-blue, one success green — no additional decorative colors.
- Precise, minimal components with clear, defined shadows used sparingly.
- Monospace (JetBrains Mono) for code; Inter for UI text.
- Instant feedback and responsive state transitions; a subtle press-scale on buttons is the primary tactile cue.
- No extraneous motion; transitions respect `prefers-reduced-motion`.

## 2. Colors

All color tokens are CSS custom properties (`--editor-bg`, `--accent-blue`, etc., defined in [index.css](client/src/index.css)) so every theme — including the CodeMirror syntax highlighter (see [ink-highlight-style.ts](client/src/editor/codemirror/ink-highlight-style.ts)) — recolors automatically when the theme class changes. Themes are applied as a class on the root element: `.dark` (default), `.high-contrast`, or no class for light.

### Dark — "Tokyo Night" (default)
| Token | Value |
|---|---|
| `--editor-bg` | `#1b1c27` — primary background, editor viewport |
| `--panel-bg` | `#1e2233` — sidebars, panels, dialogs |
| `--border-color` | `#292e42` — dividers, borders |
| `--accent-blue` | `#7692f9` — primary interactive color, knot/function headers |
| `--secondary-blue` | `#80d4ff` — brackets, operators, punctuation |
| `--text-primary` | `#a6b0d8` — body/content text |
| `--text-emphasis` | `#cbd5f6` — headings, high-emphasis text |
| `--text-secondary` | `#868fb6` — muted text, comments, placeholders |
| `--success` | `#5ed9a6` — lists, confirmation, forward actions |
| `--error` | `#f7788f` — errors, labels/stitches, destructive actions |
| `--warning` | `#ffbf66` — diverts/gathers/choices, numeric literals |
| `--syntax-keyword` | `#d49bf8` — Ink keywords (declarations, END/DONE, etc.) |
| `--syntax-string` | `#9ece6a` — string literals |

### Light
| Token | Value |
|---|---|
| `--editor-bg` | `#f2f3f8` |
| `--panel-bg` | `#e8eaf3` |
| `--border-color` | `#d1d4e0` |
| `--accent-blue` | `#5555f6` — vibrant indigo |
| `--secondary-blue` | `#0db9f2` — sky blue |
| `--text-primary` | `#434a70` |
| `--text-emphasis` | `#1f2547` |
| `--text-secondary` | `#7b819d` |
| `--success` | `#24a868` |
| `--error` | `#e8306e` |
| `--warning` | `#f48c25` |
| `--syntax-keyword` | `#b152e0` |
| `--syntax-string` | `#178c7b` |

### High Contrast
Pure black/white/yellow, designed to exceed WCAG AAA and remove all mid-tone ambiguity. Applies to both the app chrome (`.high-contrast`) and the story preview.
| Token | Value |
|---|---|
| `--editor-bg` / `--panel-bg` | `#000000` / `#0a0a0a` |
| `--border-color` / text | `#ffffff` |
| `--accent-blue` (primary) | `#ffff00` |
| `--secondary-blue` | `#00ffff` |
| `--success` | `#72ff72` |
| `--error` | `#ff6b6b` |
| `--warning` | `#ffff00` |

### Sepia (story preview only)
A warm, paper-like reading theme available exclusively for the **story preview** pane (not an app chrome option) — for readers who want a book-like feel while playtesting.
| Token | Value |
|---|---|
| `background` | `#f1ebe0` |
| `foreground` | `#554334` |
| `border` | `#c7baa8` |
| `panel` | `#e6ddd1` |
| `accent` (links) | `#944e33` |
| `success` / `error` / `warning` | `#267850` / `#9f2d31` / `#bc6b1a` |

### Named Rules
**The One Blue Rule.** Accent Blue is used sparingly — never more than ~10% of any screen. Its rarity is the point: when you see it, you know something is interactive and important.

**The Green Is Action Rule.** Success green is reserved for forward movement and confirmation (compile success, list values, positive state). Never use it for passive UI.

**Preview themes are independent of the app theme.** A writer can work in the dark app theme while pinning the story preview to sepia for readability testing, or to high-contrast to test accessibility. The default preview setting, "Match InkPad theme," simply mirrors whatever the app theme currently is.

## 3. Typography

**UI Font:** Inter (`var(--font-sans, Inter), sans-serif`)
**Code Font:** JetBrains Mono, monospace, ligatures disabled (`liga 0, calt 0`) so `->` and `==` render as literal characters rather than glyphs — important for reading Ink syntax precisely.

**Character:** Restrained and precise. Inter is the sole UI typeface — it doesn't demand attention and renders consistently across platforms. Monospace is reserved for the code editor and technical labels — places where precision and clarity are critical. No serif; no decorative fonts. The hierarchy is earned through size, weight, and spacing, not novelty.

### Hierarchy
- **Display** (600 weight, clamp 2rem–3.5rem, 1.1 line-height): Hero headlines, main page titles. Rare; used only at the top level.
- **Headline** (600 weight, clamp 1.5rem–2rem, 1.2 line-height): Section heads, significant features. Occasional emphasis.
- **Title** (600 weight, 1.125rem, 1.4 line-height): Component headings, labels for major UI sections.
- **Body** (400 weight, 0.9375rem, 1.6 line-height): Primary text, descriptions, instructions. Max 70ch line length for readability.
- **Label** (500 weight, 0.75rem, 1.2 line-height, 0.05em tracking): UI captions, small callouts, form labels.
- **Code** (400 weight, 0.875rem monospace, 1.55 line-height, ligatures off): The Ink editor and any inline code/identifiers.

### Named Rules
**The Clarity Rule.** Every text element serves a function; size and weight are never decorative. If two pieces of text have the same visual weight, they must have the same semantic role.

**The Monospace Rule.** Monospace is for the editor and technical/code labels only. Avoid mixing sans and monospace on the same line unless the monospace element is a distinct token or identifier.

## 4. Elevation

InkPad uses **structural shadows** sparingly — not atmospheric glow. Depth is conveyed primarily through explicit borders (`--border-color`) and background layering (`--editor-bg` vs `--panel-bg`). Shadows appear mainly on cards and floating/overlay surfaces (dialogs, dropdowns, the font-test widget), not as a general-purpose depth signal.

### Named Rules
**The Flat-By-Default Rule.** Most surfaces are flat at rest, distinguished by background tone and a 1px border rather than a shadow. Shadows are reserved for genuinely elevated/floating content (modals, popovers, sheets).

**The Border-First Rule.** Borders and background color define most hierarchy. Shadows are the accent, not the primary depth signal.

## 5. Components

All components are built on the token system above (via shadcn/ui + Tailwind, see [tailwind.config.ts](tailwind.config.ts)) and implement the "precise and responsive, not distracting but with tactile clear feedback" philosophy — every interactive element has a `transition-all duration-200` and buttons apply `active:scale-[0.98]` on press.

### Buttons
- **Shape:** `rounded-md` (6px) by default.
- **Default/Primary:** `--primary` background (theme accent), hover at 90% opacity. No outline; focus uses a 2px ring (`--ring`) with offset.
- **Secondary:** `--secondary` background/foreground pairing, hover at 80% opacity.
- **Ghost:** Transparent background; hover fills with `--accent`.
- **Destructive:** `--destructive` background, for delete/irreversible actions.
- **Disabled:** 50% opacity, pointer-events disabled.

### Inputs & Fields
- **Style:** `--editor-bg`/`--background` background, `--border-color`/`--input` border, `rounded-sm`–`rounded-md`.
- **Focus:** Accent-blue border with a soft `color-mix` glow (see the Ink search panel's `.inkpad-search-field:focus-within`), no default browser outline.
- **Mobile:** Inputs force `font-size: 16px` to prevent iOS Safari auto-zoom on focus.

### Cards & Containers
- **Corner Style:** `rounded-lg` (8px), matching the global `--radius: 0.5rem` token.
- **Background:** `--panel-bg` / `--card`.
- **Shadow Strategy:** `shadow-sm` at rest for cards; panels and sidebars typically rely on borders instead.
- **Border:** `--border-color` at 1px.

### Editor & Code Areas
- **Background:** `--editor-bg`.
- **Text:** `--text-primary` for prose/content; syntax colors are mapped through [ink-highlight-style.ts](client/src/editor/codemirror/ink-highlight-style.ts):
  - Knot/function/stitch headers → `--secondary-blue`, bold
  - Keywords, declarations, END/DONE → `--syntax-keyword`, bold
  - Diverts, gathers, choice markers → `--warning`, bold
  - Labels/stitch names → `--error`, bold
  - Strings → `--syntax-string`; numbers/bools → `--syntax-number`; lists → `--success`
  - Brackets/operators → `--secondary-blue`
  - Comments → `--text-secondary`, italic; TODO/author-warning comments → `--error`, bold (louder than a normal comment, intentionally)
- **Selection:** `#bb9af7` (Tokyo Night purple) at 40% opacity, theme-independent.
- **Search panel:** a custom overlay (`.cm-ink-search`) replaces CodeMirror's default search UI, themed with the same panel/border/accent tokens and responsive down to narrow container widths.

### Story Preview
- Renders in an iframe/isolated surface styled by one of four `.story-preview-theme-*` classes (`light`, `dark`, `high-contrast`, `sepia`) or `.story-preview-theme-system` (follows OS `prefers-color-scheme`), independent of the app's own theme class.
- Font size is independently adjustable (`--preview-font-size`), separate from the editor's font size.

## 6. Do's and Don'ts

### Do:
- **Do** use Accent Blue sparingly — ≤10% of any screen. Its rarity is the point.
- **Do** reserve Success Green for actions that move the story forward or confirm success.
- **Do** define depth with borders and background layering first; use shadows only for genuinely floating surfaces.
- **Do** use Inter for UI text; reserve JetBrains Mono for the editor and technical labels only.
- **Do** ensure all four app themes (dark, light, high-contrast, system) and all four preview themes stay in sync when adding new color tokens — add the variable to every `.theme-*`/`.story-preview-theme-*` block in [index.css](client/src/index.css).
- **Do** make focus states visible and explicit via the `--ring` token; never rely on color alone (high-contrast users depend on this).
- **Do** keep interactions instant and responsive; the `active:scale-[0.98]` press-feedback is the standard tactile cue — don't invent new motion patterns.
- **Do** respect `prefers-reduced-motion`; the app already disables mobile-keyboard-offset transitions under it, and any new animation should follow the same pattern.

### Don't:
- **Don't** use gradient text or gradient backgrounds as a design accent; use solid theme tokens.
- **Don't** add shadows without a reason (hover, elevation, overlay). Flat-with-borders is the default.
- **Don't** hardcode hex colors in components — always reference the CSS custom properties so theming (including sepia and high-contrast) keeps working.
- **Don't** pair additional font families into the UI beyond Inter (sans) and JetBrains Mono (code); the dev-only [font-switcher.tsx](client/src/components/font-switcher.tsx) is an experimentation tool, not a shipped option.
- **Don't** create cluttered layouts with competing affordances. Every element must earn its place.
- **Don't** use secondary-blue for primary CTAs; reserve accent-blue for the main action.
- **Don't** animate layout properties (width, height, left/right) unless absolutely necessary; animate transform, opacity, and color instead.
- **Don't** gate content visibility on a CSS animation; ensure content is always visible by default, with animation as enhancement.
- **Don't** assume dark mode elsewhere in the app just because it's the default — light, high-contrast, and system-follow-OS must all keep working.
- **Don't** exceed 70ch line length for body text; readability suffers above that.
