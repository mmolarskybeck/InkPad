import type { Story } from 'inkjs';
import type { StoryChoice } from '@/types/story-runtime';
import {
  advanceStory,
  clearDraftOutput,
  hasRuntimeError,
  readChoices,
  recordChoice,
  type SessionDraft,
} from '@/lib/story-session';

/**
 * Choice-path replay: the mechanism behind "fast-forward on recompile".
 *
 * Rather than restoring a serialized ink state (which breaks whenever the
 * source changes shape), we remember the route the writer took as a list of
 * steps and replay it against a freshly compiled Story. Replay stops at the
 * deepest point that still matches; the caller reports a partial restore.
 */

export type ChoiceStep = { kind: 'choice'; index: number; text: string };
/**
 * A jump can sit anywhere in a route. Steps before it are replayed purely to
 * rebuild story state (variables, visit counts); like the live jump, it wipes
 * the visible transcript and rewind history so only post-jump output remains.
 */
export type JumpStep = { kind: 'jump'; knot: string };
export type ReplayStep = ChoiceStep | JumpStep;

export type ReplayFailure =
  | 'choice-missing'
  | 'choice-changed'
  | 'ambiguous-text'
  | 'runtime-error'
  | 'jump-missing';

export interface ReplayResult {
  /** Steps successfully applied (a jump counts as one). */
  replayedCount: number;
  outcome: 'full' | 'partial';
  failure?: ReplayFailure;
  /** Set with `jump-missing`: the knot (or knot.stitch) that no longer exists. */
  missingKnot?: string;
}

/** True when `ChoosePathString(path)` would land somewhere. Accepts `knot` or `knot.stitch`. */
export function hasKnotPath(story: Story, path: string): boolean {
  const [knot, stitch, ...rest] = path.split('.');
  if (!knot || rest.length > 0) return false;
  const container = story.KnotContainerWithName(knot);
  if (!container) return false;
  return stitch === undefined || container.namedContent.has(stitch);
}

/**
 * Every jump in a route must resolve before replay starts. Validating up
 * front means a missing knot never leaves a half-replayed Story behind.
 */
export function findMissingJump(story: Story, path: ReplayStep[]): JumpStep | null {
  for (const step of path) {
    if (step.kind === 'jump' && !hasKnotPath(story, step.knot)) return step;
  }
  return null;
}

/** Unicode-normalize, trim, collapse whitespace, lowercase. Punctuation is preserved on purpose. */
export function normalizeChoiceText(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Locate the choice a recorded step refers to in the current choice list.
 *
 * Contract:
 * 1. If the choice at the recorded index still has the same normalized text,
 *    trust the index, even if another choice has identical text. The index
 *    disambiguates duplicates in that case.
 * 2. Otherwise scan for a unique choice with the same normalized text (the
 *    writer inserted/removed a sibling choice above it). Exactly one hit wins.
 * 3. Zero or several hits return null. Several is intentional: identical labels
 *    are valid ink, and once the recorded index no longer matches we have no
 *    safe way to pick between them, so we stop rather than guess.
 */
export function findReplayChoice(choices: StoryChoice[], step: ChoiceStep): number | null {
  const wanted = normalizeChoiceText(step.text);
  const atIndex = choices[step.index];
  if (atIndex && normalizeChoiceText(atIndex.text) === wanted) return atIndex.index;

  const matches = choices.filter((choice) => normalizeChoiceText(choice.text) === wanted);
  return matches.length === 1 ? matches[0].index : null;
}

export function classifyMiss(choices: StoryChoice[], step: ChoiceStep): ReplayFailure {
  const wanted = normalizeChoiceText(step.text);
  const matches = choices.filter((choice) => normalizeChoiceText(choice.text) === wanted).length;
  if (matches > 1) return 'ambiguous-text';
  return choices[step.index] ? 'choice-changed' : 'choice-missing';
}

/**
 * Replay `path` against `story`, collecting output into `draft`.
 * The caller must have bound the draft as the story's issue sink and owns the
 * decision to commit or discard the draft afterwards.
 */
export function replayPath(story: Story, path: ReplayStep[], draft: SessionDraft): ReplayResult {
  const missingJump = findMissingJump(story, path);
  if (missingJump) {
    return { replayedCount: 0, outcome: 'partial', failure: 'jump-missing', missingKnot: missingJump.knot };
  }

  let replayedCount = 0;
  let i = 0;

  try {
    for (;;) {
      // Always advance before a jump, exactly as the live session did: the
      // passage the writer was reading ran its side effects before they jumped.
      const issues = advanceStory(story, draft);
      if (hasRuntimeError(issues)) {
        return { replayedCount, outcome: 'partial', failure: 'runtime-error' };
      }
      if (i >= path.length) {
        return { replayedCount, outcome: 'full' };
      }

      const step = path[i];
      if (step.kind === 'jump') {
        story.ChoosePathString(step.knot);
        clearDraftOutput(draft);
        replayedCount += 1;
        i += 1;
        continue;
      }

      const choices = readChoices(story);
      const index = findReplayChoice(choices, step);
      if (index === null) {
        return { replayedCount, outcome: 'partial', failure: classifyMiss(choices, step) };
      }

      recordChoice(story, draft, index);
      story.ChooseChoiceIndex(index);
      replayedCount += 1;
      i += 1;
    }
  } catch {
    return { replayedCount, outcome: 'partial', failure: 'runtime-error' };
  }
}
