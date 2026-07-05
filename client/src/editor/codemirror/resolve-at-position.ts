import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import { identifierWordAt } from "@/editor/codemirror/identifier-occurrences";
import { isDivertTarget, type InkSymbol } from "@/inkLanguage/inkSymbols";

export interface ResolvedInkSymbol {
  symbol: InkSymbol;
  /** The source/reference range that was resolved, usually the whole divert path. */
  from: number;
  to: number;
  text: string;
}

const RESOLVABLE_DECLARATION_NODE_NAMES = new Set(["KnotName", "StitchName"]);

function ancestorNamed(node: SyntaxNode | null, name: string): SyntaxNode | null {
  let current = node;
  while (current) {
    if (current.name === name) return current;
    current = current.parent;
  }

  return null;
}

function isInsideDivertTarget(node: SyntaxNode | null) {
  return Boolean(ancestorNamed(node, "DivertTarget"));
}

function getCurrentKnotPath(symbols: readonly InkSymbol[], lineNumber: number): string | null {
  let currentKnotPath: string | null = null;

  for (const symbol of symbols) {
    if (symbol.range.startLineNumber > lineNumber) break;
    if (symbol.kind === "knot") currentKnotPath = symbol.path;
    if (symbol.kind === "function") currentKnotPath = null;
  }

  return currentKnotPath;
}

function findUniqueByName(symbols: readonly InkSymbol[], target: string): InkSymbol | null {
  const matches = symbols.filter((symbol) => isDivertTarget(symbol) && symbol.name === target);
  return matches.length === 1 ? matches[0] : null;
}

function resolveDivertTarget(
  state: EditorState,
  target: string,
  pos: number,
  symbols: readonly InkSymbol[],
): InkSymbol | null {
  if (target === "END" || target === "DONE") return null;

  const divertTargets = symbols.filter(isDivertTarget);
  const exact = divertTargets.find((symbol) => symbol.path === target);
  if (exact) return exact;

  if (!target.includes(".")) {
    const lineNumber = state.doc.lineAt(pos).number;
    const currentKnotPath = getCurrentKnotPath(symbols, lineNumber);
    const local = currentKnotPath
      ? divertTargets.find((symbol) => symbol.path === `${currentKnotPath}.${target}`)
      : null;
    if (local) return local;

    return findUniqueByName(divertTargets, target);
  }

  return null;
}

function resolveDeclaration(
  state: EditorState,
  word: { text: string; from: number },
  nodeName: string,
  symbols: readonly InkSymbol[],
): InkSymbol | null {
  const lineNumber = state.doc.lineAt(word.from).number;
  const expectedKind = nodeName === "KnotName" ? "knot" : "stitch";

  return symbols.find((symbol) => (
    symbol.kind === expectedKind
    && symbol.name === word.text
    && symbol.range.startLineNumber === lineNumber
  )) ?? null;
}

export function resolveSymbolAtPosition(
  state: EditorState,
  pos: number,
  symbols: readonly InkSymbol[],
): ResolvedInkSymbol | null {
  const word = identifierWordAt(state, pos);
  if (!word) return null;

  const node = syntaxTree(state).resolveInner(word.from, 1);
  const pathNode = ancestorNamed(node, "Path");
  if (pathNode && isInsideDivertTarget(pathNode)) {
    const text = state.doc.sliceString(pathNode.from, pathNode.to);
    const target = text.replace(/\(.*/, "").trim();
    const symbol = resolveDivertTarget(state, target, word.from, symbols);
    return symbol ? { symbol, from: pathNode.from, to: pathNode.to, text } : null;
  }

  if (RESOLVABLE_DECLARATION_NODE_NAMES.has(node.name)) {
    const symbol = resolveDeclaration(state, word, node.name, symbols);
    return symbol ? { symbol, from: word.from, to: word.to, text: word.text } : null;
  }

  return null;
}
