import { act, renderHook } from "@testing-library/react";
import { Compiler } from "inkjs/full";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInkStory } from "./use-ink-story";
import { compileInkScript, createCompilerRequestId } from "@/lib/ink-compiler";

vi.mock("@/lib/ink-compiler", () => ({
  compileInkScript: vi.fn(),
  createCompilerRequestId: vi.fn(() => "request-id"),
}));

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
});
