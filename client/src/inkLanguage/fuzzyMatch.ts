import { distance } from "fastest-levenshtein";
import { isDivertTarget, type InkSymbol } from "./inkSymbols";

function normalize(value: string): string {
  return value.toLowerCase();
}

export function findClosestDivertTarget(
  targetName: string,
  symbols: InkSymbol[],
): InkSymbol | null {
  const normalizedTarget = normalize(targetName);
  if (!normalizedTarget) return null;

  const candidates = symbols
    .filter(isDivertTarget)
    .filter((symbol) => {
      const normalizedPath = normalize(symbol.path);
      return normalizedPath !== normalizedTarget
        && normalizedPath[0] === normalizedTarget[0]
        && Math.abs(normalizedPath.length - normalizedTarget.length) <= 2;
    })
    .map((symbol) => ({
      symbol,
      distance: distance(normalizedTarget, normalize(symbol.path)),
    }))
    .filter((candidate) => candidate.distance <= 2)
    .sort((a, b) => a.distance - b.distance);

  const best = candidates[0];
  if (!best) return null;

  const tiedBest = candidates.filter((candidate) => candidate.distance === best.distance);
  return tiedBest.length === 1 ? best.symbol : null;
}
