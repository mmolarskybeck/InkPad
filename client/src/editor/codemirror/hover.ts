import type { Extension } from "@codemirror/state";
import {
  hoverTooltip,
  type EditorView,
  type HoverTooltipSource,
  type Tooltip,
} from "@codemirror/view";
import type { InkSymbol } from "@/inkLanguage/inkSymbols";
import { resolveSymbolAtPosition, type ResolvedInkSymbol } from "./resolve-at-position";

type SymbolGetter = () => readonly InkSymbol[];
type DefinitionJump = (symbol: InkSymbol) => void;

function formatSymbolKind(symbol: InkSymbol) {
  return symbol.kind === "knot" ? "knot" : "stitch";
}

function formatTooltipLabel(resolved: ResolvedInkSymbol) {
  const { symbol } = resolved;
  const kind = formatSymbolKind(symbol);

  if (resolved.context === "divert") {
    return `Divert to ${kind}`;
  }

  if (symbol.kind === "stitch" && symbol.parentPath) {
    return `Stitch in ${symbol.parentPath}`;
  }

  return `${kind[0].toUpperCase()}${kind.slice(1)} declaration`;
}

function createTextElement(className: string, text: string) {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = text;
  return element;
}

export function createInkInfoTooltipDom(
  resolved: ResolvedInkSymbol,
  jump: DefinitionJump,
): HTMLElement {
  const { symbol } = resolved;
  const dom = document.createElement("div");
  dom.className = "cm-inkInfoTooltip";

  const label = createTextElement("cm-inkInfoTooltip-label", formatTooltipLabel(resolved));
  const path = createTextElement("cm-inkInfoTooltip-path", symbol.path);

  const location = createTextElement(
    "cm-inkInfoTooltip-location",
    `${symbol.fileId}:${symbol.range.startLineNumber}`,
  );

  const action = document.createElement("button");
  action.type = "button";
  action.className = "cm-inkInfoTooltip-action";
  action.textContent = "Go to definition";
  action.addEventListener("mousedown", (event) => event.preventDefault());
  action.addEventListener("click", (event) => {
    event.preventDefault();
    jump(symbol);
  });

  const footer = document.createElement("div");
  footer.className = "cm-inkInfoTooltip-footer";
  footer.append(location, action);

  dom.append(label, path, footer);
  return dom;
}

export function createInkInfoTooltipSource(
  getSymbols: SymbolGetter,
  jump: DefinitionJump,
): HoverTooltipSource {
  return (view: EditorView, pos: number): Tooltip | null => {
    const resolved = resolveSymbolAtPosition(view.state, pos, getSymbols());
    if (!resolved) return null;

    return {
      pos: resolved.from,
      end: resolved.to,
      above: true,
      arrow: true,
      create() {
        return {
          dom: createInkInfoTooltipDom(resolved, jump),
          offset: { x: 0, y: 6 },
        };
      },
    };
  };
}

export function inkInfoHover(getSymbols: SymbolGetter, jump: DefinitionJump): Extension {
  return hoverTooltip(createInkInfoTooltipSource(getSymbols, jump), {
    hoverTime: 250,
    hideOnChange: "touch",
  });
}
