import { Compiler } from "inkjs/full";
import { describe, expect, it } from "vitest";
import {
  advanceStory,
  cloneDraft,
  createDraft,
  recordChoice,
  toRuntimeState,
} from "./story-session";

function compile(source: string) {
  return new Compiler(source).Compile();
}

describe("advanceStory", () => {
  it("collects passage text and merges tags from every continued line", () => {
    const story = compile(`Line # t1\nMore # t2\n-> END`);
    const draft = createDraft();

    const issues = advanceStory(story, draft);

    expect(draft.transcript).toHaveLength(1);
    expect(draft.transcript[0].type).toBe("passage");
    expect(draft.currentPassage?.text).toBe("Line\n\nMore");
    expect(draft.currentPassage?.tags).toEqual(expect.arrayContaining(["t1", "t2"]));
    expect(issues).toEqual([]);
  });

  it("reuses the latest passage when a subsequent advance produces no output", () => {
    const story = compile(`Line # t1\nMore # t2\n-> END`);
    const draft = createDraft();
    advanceStory(story, draft);
    const previousPassage = draft.currentPassage;

    advanceStory(story, draft);

    expect(draft.transcript).toHaveLength(1);
    expect(draft.currentPassage).toBe(previousPassage);
  });
});

describe("recordChoice", () => {
  it("snapshots state and echoes a decoded choice into the transcript", () => {
    const story = compile(`Options\n* [Use &amp; go]\n  Done\n  -> END`);
    const draft = createDraft();
    advanceStory(story, draft);
    const transcriptLengthBeforeChoice = draft.transcript.length;

    const choice = recordChoice(story, draft, 0);

    expect(choice).toEqual({ index: 0, text: "Use & go", tags: [] });
    expect(draft.history).toHaveLength(1);
    expect(draft.history[0].transcriptLength).toBe(transcriptLengthBeforeChoice);
    expect(draft.transcript.at(-1)?.type).toBe("choice");
  });

  it("returns null for an out-of-range choice index", () => {
    const story = compile(`Options\n* [Use &amp; go]\n  Done\n  -> END`);
    const draft = createDraft();
    advanceStory(story, draft);

    expect(recordChoice(story, draft, 5)).toBeNull();
  });
});

describe("cloneDraft", () => {
  it("copies arrays so mutating the clone does not affect the original", () => {
    const draft = createDraft();
    draft.transcript.push({
      id: "p1",
      type: "passage",
      passage: { id: "p1", text: "hi", tags: [] },
    });

    const clone = cloneDraft(draft);
    clone.transcript.push({
      id: "p2",
      type: "passage",
      passage: { id: "p2", text: "bye", tags: [] },
    });

    expect(draft.transcript).toHaveLength(1);
    expect(clone.transcript).toHaveLength(2);
  });
});

describe("toRuntimeState", () => {
  it("reports isComplete once the story ends with no choices, and canStepBack from history length", () => {
    const story = compile(`Just text\n-> END`);
    const draft = createDraft();
    advanceStory(story, draft);

    const state = toRuntimeState(story, draft);
    expect(state.isComplete).toBe(true);
    expect(state.canStepBack).toBe(false);

    draft.history.push({ storyStateJson: "{}", transcriptLength: 0 });
    const stateWithHistory = toRuntimeState(story, draft);
    expect(stateWithHistory.canStepBack).toBe(true);
  });
});
