import { Prec, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type { InkSymbol } from "@/inkLanguage/inkSymbols";
import { resolveSymbolAtPosition } from "./resolve-at-position";

type SymbolGetter = () => readonly InkSymbol[];
type DefinitionJump = (symbol: InkSymbol) => void;
type ActiveFileIdGetter = () => string;

function isDefinitionClick(event: MouseEvent) {
  return event.button === 0 && (event.metaKey || event.ctrlKey);
}

function goToDefinitionAt(
  view: EditorView,
  pos: number,
  getSymbols: SymbolGetter,
  jump: DefinitionJump,
  getActiveFileId: ActiveFileIdGetter,
) {
  const resolved = resolveSymbolAtPosition(view.state, pos, getSymbols(), getActiveFileId());
  if (!resolved) return false;

  jump(resolved.symbol);
  return true;
}

export function inkGoToDefinition(
  getSymbols: SymbolGetter,
  jump: DefinitionJump,
  getActiveFileId: ActiveFileIdGetter,
): Extension {
  return [
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (!isDefinitionClick(event)) return false;

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;

        const didJump = goToDefinitionAt(view, pos, getSymbols, jump, getActiveFileId);
        if (didJump) {
          event.preventDefault();
          return true;
        }

        return false;
      },
    }),
    Prec.highest(keymap.of([
      {
        key: "F12",
        run(view) {
          return goToDefinitionAt(view, view.state.selection.main.head, getSymbols, jump, getActiveFileId);
        },
      },
      {
        key: "Mod-Enter",
        run(view) {
          return goToDefinitionAt(view, view.state.selection.main.head, getSymbols, jump, getActiveFileId);
        },
      },
    ])),
  ];
}
