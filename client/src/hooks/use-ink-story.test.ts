import { act, renderHook } from "@testing-library/react";
import { Compiler } from "inkjs/full";
import type { Story } from "inkjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInkStory } from "./use-ink-story";
import { compileInkScript, createCompilerRequestId } from "@/lib/ink-compiler";
import { replayPath } from "@/lib/choice-replay";

vi.mock("@/lib/ink-compiler", () => ({
  compileInkScript: vi.fn(),
  createCompilerRequestId: vi.fn(() => "request-id"),
}));

vi.mock("@/lib/choice-replay", async (importOriginal) => {
  const m = await importOriginal<typeof import("@/lib/choice-replay")>();
  return { ...m, replayPath: vi.fn(m.replayPath) };
});

function compile(source: string) {
  return new Compiler(source).Compile();
}

describe("useInkStory runtime session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts without rewind history and captures opening passage tags", () => {
    const story = compile(`
Opening line # opening-tag
* [Continue]
  Done
  -> END
`);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));

    expect(result.current.runtimeState?.canStepBack).toBe(false);
    expect(result.current.runtimeState?.transcript).toHaveLength(1);
    expect(result.current.runtimeState?.currentPassage?.text).toBe("Opening line");
    expect(result.current.runtimeState?.currentPassage?.tags).toContain("opening-tag");
  });

  it("decodes HTML character references in runtime text and choices", () => {
    const story = compile(`
&nbsp; &\\#9617;&\\#9608;
* [Use &amp; continue]
  Done
  -> END
`);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));

    expect(result.current.runtimeState?.currentPassage?.text).toBe("\u00a0 ░█");
    expect(result.current.runtimeState?.choices[0]?.text).toBe("Use & continue");
  });

  it("does not create rewind history for an immediate DONE", () => {
    const story = compile(`-> DONE`);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));

    expect(result.current.runtimeState).toMatchObject({
      canStepBack: false,
      isComplete: true,
      choices: [],
    });
  });

  it("restores choices, variables, and transcript at the previous choice", () => {
    const story = compile(`
VAR score = 0
Opening
* [Left]
  ~ score = 1
  Left passage
  -> second
* [Right]
  Right passage
  -> END

=== second ===
Second passage
* [Finish]
  ~ score = 2
  Finished
  -> END
`);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));

    expect(result.current.runtimeState?.canStepBack).toBe(true);
    expect(result.current.runtimeState?.transcript.map((entry) => entry.type)).toEqual([
      "passage",
      "choice",
      "passage",
    ]);

    act(() => result.current.makeChoice(0));
    expect(result.current.runtimeState?.isComplete).toBe(true);

    act(() => result.current.stepBack());
    expect(result.current.runtimeState?.choices[0]?.text).toBe("Finish");
    expect(result.current.runtimeState?.canStepBack).toBe(true);

    act(() => result.current.stepBack());
    expect(result.current.runtimeState?.choices.map((choice) => choice.text)).toEqual([
      "Left",
      "Right",
    ]);
    expect(result.current.runtimeState?.transcript).toHaveLength(1);
    expect(result.current.runtimeState?.canStepBack).toBe(false);
  });

  it("reports Ink runtime choice errors without the onError handler suggestion", () => {
    const story = compile(`
Opening
* [Broken]
  -> broken

=== broken ===
  Missing an end marker.
`);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));

    expect(result.current.errors).toContainEqual(expect.objectContaining({
      message: expect.stringContaining("ran out of content. Do you need a '-> DONE' or '-> END'?"),
      type: "error",
    }));
    expect(result.current.errors[0]?.message).toContain("Error processing choice: RUNTIME ERROR:");
    expect(result.current.errors[0]?.message).not.toContain("story.onError");
    expect(result.current.runtimeState?.choices[0]?.text).toBe("Broken");
    expect(result.current.runtimeState?.transcript.map((entry) => entry.type)).toEqual(["passage"]);
    expect(result.current.runtimeState?.canStepBack).toBe(false);
  });

  it("clears rewind history when restarting or jumping to a knot", () => {
    const story = compile(`
Start
* [Go]
  End
  -> END

=== elsewhere ===
Elsewhere
* [Stay]
  -> END
`);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));
    expect(result.current.runtimeState?.canStepBack).toBe(true);

    act(() => result.current.restartStory());
    expect(result.current.runtimeState?.canStepBack).toBe(false);

    act(() => result.current.makeChoice(0));
    act(() => result.current.jumpToKnot("elsewhere"));
    expect(result.current.runtimeState?.currentPassage?.text).toBe("Elsewhere");
    expect(result.current.runtimeState?.canStepBack).toBe(false);
  });

  it("restarts completed stories from a fresh runtime instance", () => {
    const story = compile(`
Start
* [Finish]
  Done
  -> END
`);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));
    expect(result.current.runtimeState?.isComplete).toBe(true);

    const resetSpy = vi.spyOn(story, "ResetState").mockImplementation(() => {});

    act(() => result.current.restartStory());

    expect(resetSpy).not.toHaveBeenCalled();
    expect(result.current.runtimeState?.currentPassage?.text).toBe("Start");
    expect(result.current.runtimeState?.choices.map((choice) => choice.text)).toEqual(["Finish"]);
    expect(result.current.runtimeState?.isComplete).toBe(false);
    expect(result.current.runtimeState?.canStepBack).toBe(false);
  });

  it("ignores an older compilation that resolves after a newer one", async () => {
    const resolvers = new Map<string, (value: any) => void>();
    vi.mocked(createCompilerRequestId)
      .mockReturnValueOnce("old-request")
      .mockReturnValueOnce("new-request");
    vi.mocked(compileInkScript).mockImplementation((_source, requestId) => (
      new Promise((resolve) => resolvers.set(requestId, resolve))
    ));
    const { result } = renderHook(() => useInkStory());

    let oldCompile!: Promise<unknown>;
    let newCompile!: Promise<unknown>;
    act(() => {
      oldCompile = result.current.compileNow("old");
      newCompile = result.current.compileNow("new");
    });

    await act(async () => {
      resolvers.get("new-request")?.({
        requestId: "new-request",
        runtimeStory: null,
        errors: [],
        knots: ["new-knot"],
      });
      await newCompile;
    });
    expect(result.current.knots).toEqual(["new-knot"]);

    await act(async () => {
      resolvers.get("old-request")?.({
        requestId: "old-request",
        runtimeStory: null,
        errors: [],
        knots: ["old-knot"],
      });
      await oldCompile;
    });
    expect(result.current.knots).toEqual(["new-knot"]);
  });

  it("exposes parsed global metadata and source-positioned warnings", async () => {
    const story = compile("# title: Moonrise\n# theme: neon\nOpening\n-> END");
    vi.mocked(compileInkScript).mockResolvedValue({
      requestId: "request-id",
      runtimeStory: story,
      compiledJson: story.ToJson(),
      errors: [],
      knots: [],
    });
    const { result } = renderHook(() => useInkStory());

    await act(async () => {
      await result.current.compileNow("# title: Moonrise\n# theme: neon\nOpening\n-> END");
    });

    expect(result.current.parsedGlobalTags.metadata.title).toBe("Moonrise");
    expect(result.current.errors).toContainEqual(expect.objectContaining({
      line: 2,
      type: "warning",
    }));
    expect(result.current.compileStatus).toBe("warning");
  });

  it("passes multi-file project compile input through without flattening it", async () => {
    const story = compile("# title: Project\nOpening\n-> END");
    vi.mocked(compileInkScript).mockResolvedValue({
      requestId: "request-id",
      runtimeStory: story,
      compiledJson: story.ToJson(),
      errors: [],
      knots: [],
    });
    const { result } = renderHook(() => useInkStory());
    const input = {
      entryFile: "main.ink",
      files: {
        "main.ink": "# title: Project\nINCLUDE chapter.ink\nOpening\n-> END",
        "chapter.ink": "=== chapter ===\nIncluded\n-> END",
      },
    };

    await act(async () => {
      await result.current.compileNow(input);
    });

    expect(compileInkScript).toHaveBeenCalledWith(input, "request-id");
    expect(result.current.parsedGlobalTags.metadata.title).toBe("Project");
  });
});

describe("useInkStory live restore", () => {
  const S1 = `Start
* [One]
  After one
  * * [Two]
      After two
      * * * [Three]
            After three
            -> END`;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockCompile(source: string): Story {
    const story = compile(source);
    const json = story.ToJson();
    vi.mocked(compileInkScript).mockResolvedValue({
      requestId: "request-id",
      runtimeStory: story,
      errors: [],
      knots: [],
      compiledJson: json,
    });
    return story;
  }

  async function liveCompile(
    result: { current: ReturnType<typeof useInkStory> },
    source: string
  ) {
    act(() => {
      result.current.compileLive(source);
    });
    await act(async () => {
      vi.advanceTimersByTime(1600);
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("keeps the transcript prefix and lands on the current choices for a full restore", async () => {
    const story = compile(S1);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));
    act(() => result.current.makeChoice(0));

    const editedSource = `Start
* [One]
  After one
  * * [Two]
      After two edited
      * * * [Three]
            After three
            -> END`;
    mockCompile(editedSource);
    await liveCompile(result, editedSource);

    expect(result.current.runtimeState?.transcript).toHaveLength(5);
    const last = result.current.runtimeState?.transcript[4];
    expect(last).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "After two edited" }),
    });
    expect(result.current.runtimeState?.choices[0]?.text).toBe("Three");
    expect(result.current.restoreNotice).toBeNull();
    expect(result.current.runtimeState?.canStepBack).toBe(true);

    act(() => result.current.stepBack());
    expect(result.current.runtimeState?.transcript).toHaveLength(3);
    expect(result.current.runtimeState?.choices[0]?.text).toBe("Two");
  });

  it("truncates the stale tail and reports a partial restore when a later choice changes", async () => {
    const story = compile(S1);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));
    act(() => result.current.makeChoice(0));
    act(() => result.current.makeChoice(0));
    expect(result.current.runtimeState?.isComplete).toBe(true);

    const editedSource = `Start
* [One]
  After one
  * * [Other]
      Elsewhere
      -> END`;
    mockCompile(editedSource);
    await liveCompile(result, editedSource);

    expect(result.current.restoreNotice).toBe("choice-changed");
    expect(result.current.runtimeState?.transcript.at(-1)).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "After one" }),
    });
    expect(result.current.runtimeState?.choices[0]?.text).toBe("Other");

    act(() => result.current.makeChoice(0));
    expect(result.current.restoreNotice).toBeNull();
    expect(result.current.runtimeState?.transcript.at(-1)).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "Elsewhere" }),
    });

    const lengthAfterChoice = result.current.runtimeState?.transcript.length;
    mockCompile(editedSource);
    await liveCompile(result, editedSource);

    expect(result.current.runtimeState?.transcript).toHaveLength(lengthAfterChoice!);
    expect(result.current.runtimeState?.transcript.at(-1)).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "Elsewhere" }),
    });
  });

  it("restores a choice that moved position via its unique text", async () => {
    const story = compile(S1);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));

    const editedSource = `Start
* [Brand new]
  New branch
  -> END
* [One]
  After one
  * * [Two]
      After two
      * * * [Three]
            After three
            -> END`;
    mockCompile(editedSource);
    await liveCompile(result, editedSource);

    expect(result.current.restoreNotice).toBeNull();
    expect(result.current.runtimeState?.transcript.at(-1)).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "After one" }),
    });
  });

  it("trusts the recorded index for a duplicate label that still matches there", async () => {
    const original = `Start
* [Go]
  A
  -> END
* [Stay]
  B
  -> END`;
    const story = compile(original);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(1));

    const editedSource = `Start
* [Stay]
  C
  -> END
* [Stay]
  D
  -> END
* [Go]
  A
  -> END`;
    mockCompile(editedSource);
    await liveCompile(result, editedSource);

    expect(result.current.restoreNotice).toBeNull();
    expect(result.current.runtimeState?.transcript.at(-1)).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "D" }),
    });
  });

  it("reports ambiguous-text when a duplicate label no longer matches the recorded index", async () => {
    const original = `Start
* [Go]
  A
  -> END
* [Stay]
  B
  -> END`;
    const story = compile(original);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));

    const editedSource = `Start
* [X]
  x
  -> END
* [Go]
  A
  -> END
* [Go]
  A
  -> END`;
    mockCompile(editedSource);
    await liveCompile(result, editedSource);

    expect(result.current.restoreNotice).toBe("ambiguous-text");
    expect(result.current.runtimeState?.transcript).toHaveLength(1);
  });

  it("leaves the running preview untouched on a compile error, then restores once fixed", async () => {
    const story = compile(S1);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));
    expect(result.current.runtimeState?.transcript).toHaveLength(3);

    vi.mocked(compileInkScript).mockResolvedValue({
      requestId: "request-id",
      runtimeStory: null,
      errors: [{ line: 1, message: "boom", type: "error" }],
      knots: [],
    });
    await liveCompile(result, S1);

    expect(result.current.runtimeState?.transcript).toHaveLength(3);
    expect(result.current.compileStatus).toBe("error");

    const fixedSource = `Start
* [One]
  After one fixed
  * * [Two]
      After two
      * * * [Three]
            After three
            -> END`;
    mockCompile(fixedSource);
    await liveCompile(result, fixedSource);

    expect(result.current.runtimeState?.transcript[2]).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "After one fixed" }),
    });
  });

  it("bypasses replay for an explicit Run, restarting from the top", async () => {
    const story = compile(S1);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));

    mockCompile(S1);
    await act(async () => {
      await result.current.compileNow(S1);
    });
    expect(replayPath).not.toHaveBeenCalled();

    act(() => result.current.runStory());
    expect(result.current.runtimeState?.transcript).toHaveLength(1);
  });

  it("does nothing when no session is running", async () => {
    const { result } = renderHook(() => useInkStory());

    mockCompile(S1);
    await liveCompile(result, S1);

    expect(result.current.runtimeState).toBeNull();
  });

  it("stopStory clears the running session and blocks a subsequent restore", async () => {
    const story = compile(S1);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));
    act(() => result.current.stopStory());

    expect(result.current.runtimeState).toBeNull();
    expect(result.current.isRunning).toBe(false);

    mockCompile(S1);
    await liveCompile(result, S1);

    expect(result.current.runtimeState).toBeNull();
  });

  it("restores a route rooted at a knot jump without emitting an opening passage", async () => {
    const jumpSource = `Opening
* [Go]
  gone
  -> END
== place ==
In place
* [P]
  after p
  -> END`;
    const story = compile(jumpSource);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.jumpToKnot("place"));
    act(() => result.current.makeChoice(0));

    const editedJumpSource = `Opening
* [Go]
  gone
  -> END
== place ==
In place
* [P]
  after p edited
  -> END`;
    mockCompile(editedJumpSource);
    await liveCompile(result, editedJumpSource);

    expect(result.current.runtimeState?.transcript[0]).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "In place" }),
    });
    expect(result.current.runtimeState?.transcript.at(-1)).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "after p edited" }),
    });
    expect(result.current.runtimeState?.transcript).toHaveLength(3);
  });

  const midJumpSource = `VAR score = 1
Opening
* [Raise]
  ~ score = 5
  raised
  * * [Leave]
      left
      -> END
== place ==
score is {score}
* [P]
  after p
  -> END`;

  it("restores a mid-route jump with earlier variables intact and only post-jump transcript and history", async () => {
    const story = compile(midJumpSource);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));
    act(() => result.current.jumpToKnot("place"));
    act(() => result.current.makeChoice(0));

    const edited = midJumpSource.replace("after p", "after p edited");
    mockCompile(edited);
    await liveCompile(result, edited);

    expect(result.current.restoreNotice).toBeNull();
    expect(result.current.variables).toContainEqual(expect.objectContaining({ name: "score", value: 5 }));
    expect(result.current.runtimeState?.transcript.map((entry) => entry.type)).toEqual([
      "passage",
      "choice",
      "passage",
    ]);
    expect(result.current.runtimeState?.transcript[0]).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "score is 5" }),
    });
    expect(result.current.runtimeState?.transcript.at(-1)).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "after p edited" }),
    });

    // Back returns to the knot's choices, then stops: it cannot cross the jump.
    expect(result.current.runtimeState?.canStepBack).toBe(true);
    act(() => result.current.stepBack());
    expect(result.current.runtimeState?.transcript).toHaveLength(1);
    expect(result.current.runtimeState?.choices[0]?.text).toBe("P");
    expect(result.current.runtimeState?.canStepBack).toBe(false);
  });

  it("restarts cleanly when the root jump's knot no longer exists", async () => {
    const story = compile(midJumpSource);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.jumpToKnot("place"));

    const renamed = midJumpSource.replace("== place ==", "== elsewhere ==");
    mockCompile(renamed);
    await liveCompile(result, renamed);

    expect(result.current.restoreNotice).toBe("jump-missing");
    expect(result.current.restoreNoticeKnot).toBe("place");
    expect(result.current.runtimeState?.transcript).toHaveLength(1);
    expect(result.current.runtimeState?.transcript[0]).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "Opening" }),
    });
    expect(result.current.runtimeState?.choices[0]?.text).toBe("Raise");
    expect(result.current.runtimeState?.canStepBack).toBe(false);
  });

  it("restarts with initial variable values when a mid-route jump's knot no longer exists", async () => {
    const story = compile(midJumpSource);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));
    act(() => result.current.jumpToKnot("place"));

    const renamed = midJumpSource.replace("== place ==", "== elsewhere ==");
    mockCompile(renamed);
    await liveCompile(result, renamed);

    expect(result.current.restoreNotice).toBe("jump-missing");
    expect(result.current.variables).toContainEqual(expect.objectContaining({ name: "score", value: 1 }));
    expect(result.current.runtimeState?.transcript[0]).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "Opening" }),
    });
    expect(result.current.errors.some((e) => e.type === "error")).toBe(false);
  });

  it("discards the obsolete route when the writer chooses after a jump-missing restart", async () => {
    const story = compile(midJumpSource);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));
    act(() => result.current.jumpToKnot("place"));

    const renamed = midJumpSource.replace("== place ==", "== elsewhere ==");
    mockCompile(renamed);
    await liveCompile(result, renamed);
    expect(result.current.restoreNotice).toBe("jump-missing");

    act(() => result.current.makeChoice(0));
    expect(result.current.restoreNotice).toBeNull();
    expect(result.current.restoreNoticeKnot).toBeNull();

    mockCompile(renamed);
    await liveCompile(result, renamed);

    const lastReplay = vi.mocked(replayPath).mock.calls.at(-1);
    expect(lastReplay?.[1]).toEqual([{ kind: "choice", index: 0, text: "Raise" }]);
    expect(result.current.restoreNotice).toBeNull();
    expect(result.current.runtimeState?.transcript.at(-1)).toMatchObject({
      type: "passage",
      passage: expect.objectContaining({ text: "raised" }),
    });
  });

  it("reflects variables from the newly compiled story after a restore", async () => {
    const varSource = `VAR score = 1
Start
* [Go]
  ~ score = 5
  done
  -> END`;
    const story = compile(varSource);
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.runStory(story));
    act(() => result.current.makeChoice(0));

    const editedVarSource = `VAR mood = "ok"
VAR score = 1
Start
* [Go]
  ~ score = 5
  done
  -> END`;
    mockCompile(editedVarSource);
    await liveCompile(result, editedVarSource);

    expect(result.current.variables).toContainEqual(
      expect.objectContaining({ name: "mood" })
    );
    expect(result.current.variables).toContainEqual(
      expect.objectContaining({ name: "score", value: 5 })
    );
  });
});


describe("useInkStory live compile scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function deferredCompile() {
    const pending: Array<{ requestId: string; resolve: () => void }> = [];
    vi.mocked(compileInkScript).mockImplementation((_source, requestId) =>
      new Promise((resolve) => {
        pending.push({
          requestId,
          resolve: () => resolve({ requestId, runtimeStory: null, errors: [], knots: [], compiledJson: null }),
        });
      })
    );
    return pending;
  }

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("compiles at once on a commit signal, otherwise after the idle wait", async () => {
    const pending = deferredCompile();
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.compileLive("Hello wor"));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(compileInkScript).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(compileInkScript).toHaveBeenCalledTimes(1);
    act(() => pending[0].resolve());
    await flush();

    act(() => result.current.compileLive("Hello world "));
    act(() => result.current.commitLiveCompile("space"));
    expect(compileInkScript).toHaveBeenCalledTimes(2);
    expect(vi.mocked(compileInkScript).mock.calls[1][0]).toBe("Hello world ");
    act(() => pending[1].resolve());
    await flush();

    // A signal with nothing pending is a no-op.
    act(() => result.current.commitLiveCompile("newline"));
    expect(compileInkScript).toHaveBeenCalledTimes(2);
  });

  it("ignores commit signals while the preview is hidden and flushes when it is revealed", async () => {
    const pending = deferredCompile();
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.setPreviewVisible(false));
    act(() => result.current.compileLive("Hidden edit "));
    act(() => result.current.commitLiveCompile("space"));
    act(() => result.current.commitLiveCompile("blur"));
    expect(compileInkScript).not.toHaveBeenCalled();

    act(() => result.current.setPreviewVisible(true));
    expect(compileInkScript).toHaveBeenCalledTimes(1);
    expect(vi.mocked(compileInkScript).mock.calls[0][0]).toBe("Hidden edit ");
    act(() => pending[0].resolve());
    await flush();

    // Revealing again with nothing pending does nothing; the idle timer still works while hidden.
    act(() => result.current.setPreviewVisible(false));
    act(() => result.current.setPreviewVisible(true));
    expect(compileInkScript).toHaveBeenCalledTimes(1);
    act(() => result.current.setPreviewVisible(false));
    act(() => result.current.compileLive("Hidden edit 2"));
    await act(async () => { vi.advanceTimersByTime(1600); });
    expect(compileInkScript).toHaveBeenCalledTimes(2);
  });

  it("keeps one compile in flight and only the newest source waiting behind it", async () => {
    const pending = deferredCompile();
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.compileLive("A"));
    await act(async () => { vi.advanceTimersByTime(1520); });
    expect(pending).toHaveLength(1);

    act(() => result.current.compileLive("A "));
    await act(async () => { vi.advanceTimersByTime(1520); });
    act(() => result.current.compileLive("A B"));
    await act(async () => { vi.advanceTimersByTime(1600); });
    // Still only the first request has reached the worker.
    expect(pending).toHaveLength(1);

    act(() => pending[0].resolve());
    await flush();
    expect(pending).toHaveLength(2);
    expect(vi.mocked(compileInkScript).mock.calls[1][0]).toBe("A B");

    act(() => pending[1].resolve());
    await flush();
    expect(pending).toHaveLength(2);
    expect(result.current.isCompiling).toBe(false);
  });

  it("never shows Compiling for a quick compile, and shows it once for a slow one", async () => {
    const pending = deferredCompile();
    const { result } = renderHook(() => useInkStory());
    const seen: string[] = [];

    act(() => result.current.compileLive("Quick"));
    await act(async () => { vi.advanceTimersByTime(1520); });
    seen.push(result.current.compileStatus);
    await act(async () => { vi.advanceTimersByTime(50); });
    act(() => pending[0].resolve());
    await flush();
    seen.push(result.current.compileStatus);
    await act(async () => { vi.advanceTimersByTime(300); });
    seen.push(result.current.compileStatus);
    expect(seen).toEqual(["idle", "success", "success"]);
    expect(seen).not.toContain("compiling");

    act(() => result.current.compileLive("Slow "));
    await act(async () => { vi.advanceTimersByTime(1520); });
    expect(result.current.compileStatus).toBe("success");
    await act(async () => { vi.advanceTimersByTime(160); });
    expect(result.current.compileStatus).toBe("compiling");
    act(() => pending[1].resolve());
    await flush();
    expect(result.current.compileStatus).toBe("success");
  });

  it("does not let a superseded request's status timer overwrite a newer result", async () => {
    const pending = deferredCompile();
    const { result } = renderHook(() => useInkStory());

    act(() => result.current.compileLive("Old"));
    await act(async () => { vi.advanceTimersByTime(1520); });
    expect(pending).toHaveLength(1);

    // Explicit Run supersedes the live request and resolves first.
    let runPromise: Promise<unknown> | null = null;
    act(() => { runPromise = result.current.compileNow("New"); });
    expect(pending).toHaveLength(2);
    act(() => pending[1].resolve());
    await flush();
    await runPromise;
    expect(result.current.compileStatus).toBe("success");

    await act(async () => { vi.advanceTimersByTime(300); });
    expect(result.current.compileStatus).toBe("success");

    act(() => pending[0].resolve());
    await flush();
    expect(result.current.compileStatus).toBe("success");
    expect(result.current.isCompiling).toBe(false);
  });
});
