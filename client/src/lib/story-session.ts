import type { Story } from 'inkjs';
import type { ErrorType } from 'inkjs/engine/Error';
import type { InkCompilerError } from '@/lib/ink-compiler';
import { decodeHtmlCharacterReferences } from '@/lib/ink-text';
import type {
  StoryChoice,
  StoryPassage,
  StoryRuntimeState,
  StoryTranscriptEntry,
} from '@/types/story-runtime';

/**
 * Transactional story-session bookkeeping.
 *
 * Nothing in this module touches React. A `SessionDraft` collects transcript,
 * choice history, and runtime issues while a `Story` is advanced; the caller
 * decides when (or whether) to commit the draft to visible state. This lets the
 * live-recompile replay build a whole restored session off-screen and publish
 * it once, and lets `makeChoice` roll back cleanly on runtime errors.
 */

export interface ChoiceSnapshot {
  storyStateJson: string;
  transcriptLength: number;
}

export type RuntimeIssue = InkCompilerError;

export interface SessionDraft {
  transcript: StoryTranscriptEntry[];
  history: ChoiceSnapshot[];
  entryId: number;
  /** Runtime issues raised via story.onError since the draft was bound. */
  issues: RuntimeIssue[];
  currentPassage: StoryPassage | null;
}

const INK_RUNTIME_ERROR_TYPE = 2;

export function runtimeIssueFromInkError(message: string, type: ErrorType): RuntimeIssue {
  const lineMatch = message.match(/line\s+(\d+)/i);
  return {
    line: lineMatch ? Number(lineMatch[1]) : 1,
    message,
    type: type === INK_RUNTIME_ERROR_TYPE ? 'error' : 'warning',
  };
}

export function hasRuntimeError(issues: RuntimeIssue[]): boolean {
  return issues.some((issue) => issue.type === 'error');
}

export function prefixRuntimeIssues(prefix: string, issues: RuntimeIssue[]): RuntimeIssue[] {
  return issues.map((issue) => ({ ...issue, message: `${prefix}: ${issue.message}` }));
}

export function createDraft(): SessionDraft {
  return { transcript: [], history: [], entryId: 0, issues: [], currentPassage: null };
}

/**
 * Drop everything visible in a draft (transcript, rewind history, passage,
 * entry counter) while keeping the issue sink intact. This is what a knot
 * jump does to the live session, so replay must do the same.
 */
export function clearDraftOutput(draft: SessionDraft): void {
  draft.transcript = [];
  draft.history = [];
  draft.entryId = 0;
  draft.currentPassage = null;
}

export function cloneDraft(draft: SessionDraft): SessionDraft {
  return {
    transcript: [...draft.transcript],
    history: [...draft.history],
    entryId: draft.entryId,
    issues: [...draft.issues],
    currentPassage: draft.currentPassage,
  };
}

function nextEntryId(draft: SessionDraft, prefix: string): string {
  draft.entryId += 1;
  return `${prefix}-${draft.entryId}`;
}

/** Route the story's runtime errors into the draft. Rebind after cloning. */
export function bindIssueSink(story: Story, draft: SessionDraft): void {
  story.onError = (message, type) => {
    draft.issues.push(runtimeIssueFromInkError(message, type));
  };
}

export function readChoices(story: Story): StoryChoice[] {
  return story.currentChoices.map((choice, index) => ({
    text: decodeHtmlCharacterReferences(choice.text),
    index,
    tags: choice.tags ?? [],
  }));
}

/**
 * Drain `Continue()` until the story stops, appending one passage entry to the
 * draft (or reusing the latest passage when nothing new was produced).
 * Returns only the issues raised during this advance.
 */
export function advanceStory(story: Story, draft: SessionDraft): RuntimeIssue[] {
  const issuesBefore = draft.issues.length;
  let text = '';
  const tags = new Set<string>();
  while (story.canContinue) {
    const nextText = story.Continue();
    text += (nextText || '') + '\n';
    story.currentTags?.forEach((tag) => tags.add(tag));
  }

  const trimmedText = decodeHtmlCharacterReferences(text.trim());
  if (trimmedText || tags.size > 0) {
    const passage: StoryPassage = {
      id: nextEntryId(draft, 'passage'),
      text: trimmedText,
      tags: Array.from(tags),
    };
    draft.transcript.push({ id: passage.id, type: 'passage', passage });
    draft.currentPassage = passage;
  } else {
    const latestPassage = [...draft.transcript].reverse().find((entry) => entry.type === 'passage');
    draft.currentPassage = latestPassage?.type === 'passage' ? latestPassage.passage : null;
  }

  return draft.issues.slice(issuesBefore);
}

/**
 * Record a choice about to be taken: snapshot the state (for step-back) and
 * echo the choice into the transcript. Does NOT call `ChooseChoiceIndex`.
 */
export function recordChoice(story: Story, draft: SessionDraft, choiceIndex: number): StoryChoice | null {
  const selected = story.currentChoices[choiceIndex];
  if (!selected) return null;

  draft.history.push({
    storyStateJson: story.state.ToJson(),
    transcriptLength: draft.transcript.length,
  });
  const choice: StoryChoice = {
    index: choiceIndex,
    text: decodeHtmlCharacterReferences(selected.text),
    tags: selected.tags ?? [],
  };
  draft.transcript.push({ id: nextEntryId(draft, 'choice'), type: 'choice', choice });
  return choice;
}

export function toRuntimeState(story: Story, draft: SessionDraft): StoryRuntimeState {
  const choices = readChoices(story);
  return {
    transcript: draft.transcript,
    currentPassage: draft.currentPassage,
    choices,
    canContinue: story.canContinue,
    isComplete: !story.canContinue && choices.length === 0,
    canStepBack: draft.history.length > 0,
  };
}
