---
name: InkPad
description: A sleek web-based IDE for Ink story development. Precise, responsive, tactile feedback without distraction.
colors:
  focus-blue: "#2E8FD0"
  calm-cyan: "#1EBCC3"
  start-green: "#48D597"
  error-red: "#F87171"
  error-dark: "#7F1D1D"
  warning-gold: "#FFFF00"
  editor-dark: "#1E1E1E"
  panel-dark: "#2D2D30"
  surface-light: "#FAFAFA"
  text-light: "#F0F0F0"
  text-muted: "#858585"
  border-neutral: "#3E3E42"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0em"
  label:
    fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  lg: "8px"
  md: "6px"
  sm: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.focus-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#2576B8"
  button-action:
    backgroundColor: "{colors.start-green}"
    textColor: "{colors.editor-dark}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-light}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  input-default:
    backgroundColor: "{colors.panel-dark}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card-default:
    backgroundColor: "{colors.panel-dark}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: InkPad

## 1. Overview

**Creative North Star: "The Clean Desk"**

InkPad's design philosophy centers on the writer's workspace: a clean, minimal desk where focus is paramount and every element earns its place. The dark theme (editor gray #1E1E1E, panel gray #2D2D30) echoes VS Code and professional text editors—familiar, distraction-free, purposeful. The accent palette is restrained: a calm, focused blue for primary actions, a muted cyan for secondary emphasis, and a vibrant start-green for completion and activation states. All interactions feel precise and responsive, with tactile feedback but never gratuitous motion. Elevation is structural, not atmospheric: shadows and borders define depth and hierarchy, not decoration.

This system rejects: cluttered UIs with competing affordances, overly "designed" or flashy interfaces, clunky or sluggish interactions, and corporate-heavy aesthetics. It embraces the restraint of Obsidian's sidebar layout, VS Code's clarity, and Scrivener's respect for the writer's workflow.

**Key Characteristics:**
- Dark theme as default; light and high-contrast modes available.
- One primary blue accent, one secondary cyan, one action green.
- Precise, minimal components with clear, defined shadows.
- Monospace labels and syntax-aware typography.
- Instant feedback and responsive state transitions.
- No extraneous motion; all transitions are functional.

## 2. Colors

A restrained, semantically clear palette anchored in dark neutrals and one calm blue accent. The green is reserved for actions that move the story forward (restart, compile, play).

### Primary
- **Focus Blue** (#2E8FD0, oklch(56% 0.18 255)): Primary interactive elements, buttons, links, active states. The color of clarity and the writer's focus.
- **Calm Cyan** (#1EBCC3, oklch(62% 0.23 233)): Secondary emphasis, supportive accents, hover states. A cooler, more subtle sibling to blue.

### Action
- **Start Green** (#48D597, oklch(70% 0.19 159)): Confirmation, action completion, forward movement (restart story, play). The color that says "go."

### Semantic
- **Error Red** (#F87171 light / #7F1D1D dark, oklch(62% 0.22 27)): Errors, destructive actions, warnings in the live context.
- **Warning Gold** (#FFFF00, oklch(97% 0.30 103)): Alerts, deprecations, things that need attention but aren't critical.

### Neutral
- **Editor Dark** (#1E1E1E, oklch(10% 0.01 270)): Primary background, editor viewport.
- **Panel Dark** (#2D2D30, oklch(15% 0.02 280)): Secondary surface, sidebars, panels, raised containers.
- **Surface Light** (#FAFAFA, oklch(98% 0 0)): Light mode background, white surfaces.
- **Text Light** (#F0F0F0, oklch(93% 0 0)): Body text, light mode foreground.
- **Text Muted** (#858585, oklch(50% 0 0)): Secondary text, disabled states, helper text.
- **Border Neutral** (#3E3E42, oklch(21% 0 0)): Dividers, borders, subtle separation.

### Named Rules
**The One Blue Rule.** The focus blue is used sparingly—never more than 10% of any screen. Its rarity is the point: when you see it, you know something is interactive and important.

**The Green Is Action Rule.** Green is reserved exclusively for forward movement: restart, play, compile, submit. Never use it for passive states.

## 3. Typography

**Display Font:** -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial (system sans-serif)
**Body Font:** Same system stack
**Label/Mono Font:** ui-monospace, "Cascadia Code", "Source Code Pro", monospace

**Character:** Restrained and precise. The system font stack ensures performance and familiarity; it doesn't demand attention. Monospace is reserved for code snippets, variable names, and technical labels—places where precision and clarity are critical. No serif; no decorative fonts. The hierarchy is earned through size, weight, and spacing, not novelty.

### Hierarchy
- **Display** (600 weight, clamp 2rem–3.5rem, 1.1 line-height): Hero headlines, main page titles. Rare; used only at the top level.
- **Headline** (600 weight, clamp 1.5rem–2rem, 1.2 line-height): Section heads, significant features. Occasional emphasis.
- **Title** (600 weight, 1.125rem, 1.4 line-height): Component headings, labels for major UI sections.
- **Body** (400 weight, 0.9375rem, 1.6 line-height): Primary text, descriptions, instructions. Max 70ch line length for readability.
- **Label** (500 weight monospace, 0.75rem, 1.2 line-height, 0.05em tracking): Code snippets, variable names, technical identifiers, small UI callouts.

### Named Rules
**The Clarity Rule.** Every text element serves a function; size and weight are never decorative. If two pieces of text have the same visual weight, they must have the same semantic role.

**The Monospace Rule.** Monospace is for code and technical language only. Avoid mixing serif, sans-serif, and monospace on the same line unless the monospace element is a distinct token or identifier.

## 4. Elevation

InkPad uses **structural shadows**—not atmospheric glow. Depth is conveyed through explicit borders and defined shadows. Shadows appear in response to state change (hover, focus, active) or to define containers (panels, cards, modals). At rest, surfaces may be subtle or flat; on interaction, the shadow says "this lifted."

### Shadow Vocabulary
- **Subtle** (`box-shadow: 0 2px 8px rgba(0,0,0,0.25)`): Thin separation between nested panels, internal hover states.
- **Defined** (`box-shadow: 0 8px 24px rgba(0,0,0,0.35)`): Primary surface elevation, active modals, focus states.
- **Strong** (`box-shadow: 0 16px 40px rgba(0,0,0,0.45)`): Top-level modals, overlays, floating panels.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only in response to state (hover, focus, active) or to define semantic depth (modal over backdrop). Never gratuitous elevation.

**The Border-First Rule.** Borders and background color define most hierarchy. Shadows are the accent, not the primary depth signal.

## 5. Components

All components are built on the token system above and implement the "precise and responsive, not distracting but with tactile clear feedback" philosophy.

### Buttons
- **Shape:** 6px border-radius (md) for primary, 4px (sm) for compact buttons.
- **Primary:** Focus Blue (#2E8FD0) background, white text, 10px/16px padding. Hover: darker blue #2576B8. No outline; subtle shadow on hover.
- **Action:** Start Green (#48D597) background, dark text (#1E1E1E), same padding. Signals forward movement.
- **Ghost/Secondary:** Transparent background, light text (#F0F0F0), subtle border or transparent. Hover: 10% tint of Focus Blue.
- **Disabled:** Text Muted (#858585), no interaction, no shadow.

### Inputs & Fields
- **Style:** Panel Dark (#2D2D30) background, 8px/12px padding, 4px radius. Text Light (#F0F0F0) text, Text Muted (#858585) placeholder.
- **Focus:** Focus Blue border (2px), no outline ring; smooth transition.
- **Error:** Error Red (#F87171) border, no fill change.
- **Disabled:** Border Neutral (#3E3E42), Text Muted text, cursor: not-allowed.

### Cards & Containers
- **Corner Style:** 6px radius (md) for primary cards, 4px (sm) for compact.
- **Background:** Panel Dark (#2D2D30) default.
- **Shadow Strategy:** None at rest; subtle shadow (0 2px 8px) on hover or focus.
- **Border:** Border Neutral (#3E3E42) at 1px, or none if shadow conveys depth.
- **Internal Padding:** 16px (md) for primary cards, 8px (sm) for compact.

### Chips / Pills
- **Style:** Panel Dark background, Text Light text, Border Neutral border (1px), 4px radius.
- **Selected / Active:** Focus Blue background, white text, no border.
- **Disabled:** Text Muted text, Border Neutral border.

### Navigation & Menus
- **Typography:** Title weight (600, 1.125rem) for primary nav, Label weight (500, 0.75rem) for secondary.
- **Active State:** Focus Blue text or Focus Blue left border (2px), bold weight.
- **Hover:** Subtle background tint (Panel Dark + 1–2% lighter) or Text Muted (20% opacity) background.
- **Disabled:** Text Muted text, no interaction.

### Editor & Code Areas
- **Background:** Editor Dark (#1E1E1E).
- **Text:** Text Light (#F0F0F0) for body, syntax colors for keywords/strings/numbers (as defined in index.css).
- **Selection:** Focus Blue (20% opacity) or darker blue background.
- **Line Numbers / Gutters:** Text Muted (#858585) text, Editor Dark background.

## 6. Do's and Don'ts

### Do:
- **Do** use Focus Blue sparingly—≤10% of any screen. Its rarity is the point.
- **Do** reserve Start Green exclusively for actions that move the story forward (restart, play, submit).
- **Do** define depth with borders and shadows, not tints or gradients.
- **Do** use system fonts (Helvetica, Arial, San Francisco) for body text; preserve monospace for code and technical labels only.
- **Do** ensure all text meets ≥4.5:1 contrast ratio (body), ≥3:1 for large text.
- **Do** make focus states visible and explicit: Focus Blue border or thick outline, never rely on color alone.
- **Do** keep interactions instant and responsive; avoid motion for show.
- **Do** respect reduced motion: every transition must have a no-motion alternative (@media prefers-reduced-motion).

### Don't:
- **Don't** use gradient text or gradient backgrounds as a design accent; use solid colors.
- **Don't** add shadows without a reason (hover, elevation, depth). Flat at rest is intentional.
- **Don't** use side-stripe borders (`border-left`) as colored accents on cards or alerts.
- **Don't** pair similar fonts (two sans-serifs, two monospace families). Use the system stack; consistency wins over novelty.
- **Don't** create cluttered layouts with competing affordances. Every element must earn its place.
- **Don't** use cyan or secondary blue for primary CTAs; reserve Focus Blue for the main action.
- **Don't** animate layout properties (width, height, left/right) unless absolutely necessary; animate transform, opacity, and color instead.
- **Don't** gate content visibility on a CSS animation; ensure content is always visible by default, with animation as enhancement.
- **Don't** assume dark mode. Light mode support (white backgrounds, dark text) is required for accessibility and user preference.
- **Don't** exceed 70ch line length for body text; readability suffers above that.
