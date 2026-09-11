import { Compiler } from "inkjs/full";
import { describe, expect, it } from "vitest";
import {
  classifyMiss,
  findReplayChoice,
  normalizeChoiceText,
  replayPath,
  type ChoiceStep,
} from "./choice-replay";
import { bindIssueSink, createDraft } from "./story-session";
import type { StoryChoice } from "@/types/story-runtime";

function compile(source: string) {
  return new Compiler(source).Compile();
}

describe("normalizeChoiceText", () => {
  it("collapses internal whitespace, trims, and lowercases", () => {
    expect(normalizeChoiceText("  Ask   About\tit ")).toBe("ask about it");
  });

  it("preserves punctuation", () => {
    expect(normalizeChoiceText("Wait, what?")).toBe("wait, what?");
  });

  it("NFKC-normalizes compatibility characters like the fi ligature", () => {
    expect(normalizeChoiceText("ﬁne")).toBe("fine");
  });
});

describe("findReplayChoice", () => {
  it("trusts the recorded index when its text matches, even with an identical sibling", () => {
    const choices: StoryChoice[] = [
      { index: 0, text: "Go", tags: [] },
      { index: 1, text: "Go", tags: [] },
    ];
    const step: ChoiceStep = { kind: "choice", index: 1, text: "Go" };
    expect(findReplayChoice(choices, step)).toBe(1);
  });

  it("finds a moved choice by unique normalized text", () => {
    const choices: StoryChoice[] = [
      { index: 0, text: "New", tags: [] },
      { index: 1, text: "Old A", tags: [] },
      { index: 2, text: "Old B", tags: [] },
    ];
    const step: ChoiceStep = { kind: "choice", index: 0, text: "Old A" };
    expect(findReplayChoice(choices, step)).toBe(1);
  });

  it("returns null when a moved choice's text is ambiguous, and classifies it as ambiguous-text", () => {
    const choices: StoryChoice[] = [
      { index: 0, text: "New", tags: [] },
      { index: 1, text: "Old A", tags: [] },
      { index: 2, text: "Old A", tags: [] },
    ];
    const step: ChoiceStep = { kind: "choice", index: 0, text: "Old A" };
    expect(findReplayChoice(choices, step)).toBeNull();
    expect(classifyMiss(choices, step)).toBe("ambiguous-text");
  });

  it("returns null when the choice is missing entirely, and classifies it as choice-missing", () => {
    const choices: StoryChoice[] = [{ index: 0, text: "A", tags: [] }];
    const step: ChoiceStep = { kind: "choice", index: 3, text: "Z" };
    expect(findReplayChoice(choices, step)).toBeNull();
    expect(classifyMiss(choices, step)).toBe("choice-missing");
  });

  it("classifies a changed choice at a still-valid index as choice-changed", () => {
    const choices: StoryChoice[] = [
      { index: 0, text: "A", tags: [] },
      { index: 1, text: "B", tags: [] },
    ];
    const step: ChoiceStep = { kind: "choice", index: 1, text: "Z" };
    expect(classifyMiss(choices, step)).toBe("choice-changed");
  });
});

describe("replayPath", () => {
  const nestedStory = `Start
* [One]
  After one
  * * [Two]
      After two
      -> END`;

  it("fully replays a matching choice path", () => {
    const story = compile(nestedStory);
    const draft = createDraft();
    bindIssueSink(story, draft);

    const result = replayPath(
      story,
      [
        { kind: "choice", index: 0, text: "One" },
        { kind: "choice", index: 0, text: "Two" },
      ],
      draft
    );

    expect(result.outcome).toBe("full");
    expect(result.replayedCount).toBe(2);
    expect(draft.transcript).toHaveLength(5);
    expect(draft.transcript.map((entry) => entry.type)).toEqual([
      "passage",
      "choice",
      "passage",
      "choice",
      "passage",
    ]);
    const last = draft.transcript.at(-1);
    expect(last?.type).toBe("passage");
    expect(last?.type === "passage" && last.passage.text).toBe("After two");
  });

  it("stops partway when a step's choice text no longer matches", () => {
    const story = compile(nestedStory);
    const draft = createDraft();
    bindIssueSink(story, draft);

    const result = replayPath(
      story,
      [
        { kind: "choice", index: 0, text: "One" },
        { kind: "choice", index: 0, text: "Missing" },
      ],
      draft
    );

    expect(result.outcome).toBe("partial");
    expect(result.replayedCount).toBe(1);
    expect(result.failure).toBe("choice-changed");
  });

  it("replays a root jump without emitting the opening passage", () => {
    const story = compile(`Opening
-> END
== place ==
In place
-> END`);
    const draft = createDraft();
    bindIssueSink(story, draft);

    const result = replayPath(story, [{ kind: "jump", knot: "place" }], draft);

    expect(result.outcome).toBe("full");
    expect(result.replayedCount).toBe(1);
    expect(draft.transcript).toHaveLength(1);
    const first = draft.transcript[0];
    expect(first.type).toBe("passage");
    expect(first.type === "passage" && first.passage.text).toBe("In place");
  });

  it("reports a partial runtime-error outcome when advancing raises a runtime error", () => {
    // A tunnel-return (->->) with no tunnel on the stack raises a genuine ink
    // RUNTIME ERROR through story.onError without throwing.
    const story = compile(`-> knot
=== knot ===
->->
-> END`);
    const draft = createDraft();
    bindIssueSink(story, draft);

    const result = replayPath(story, [], draft);

    expect(result.outcome).toBe("partial");
    expect(result.failure).toBe("runtime-error");
    expect(draft.issues.length).toBeGreaterThanOrEqual(1);
  });
});
