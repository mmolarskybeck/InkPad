import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./use-autosave";

const originalBroadcastChannel = globalThis.BroadcastChannel;

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(globalThis, "BroadcastChannel", {
    configurable: true,
    writable: true,
    value: originalBroadcastChannel,
  });
});

describe("useAutosave", () => {
  it("falls back to single-tab leadership without BroadcastChannel", () => {
    Object.defineProperty(globalThis, "BroadcastChannel", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const { result } = renderHook(() => useAutosave({
      fileName: "story.ink",
      content: "Story",
      onSave: async () => {},
    }));

    expect(result.current.isLeader).toBe(true);
  });

  it("allows manual saves before a tab becomes leader", async () => {
    vi.useFakeTimers();
    class IsolatedChannel {
      onmessage = null;
      postMessage() {}
      close() {}
    }
    Object.defineProperty(globalThis, "BroadcastChannel", {
      configurable: true,
      writable: true,
      value: IsolatedChannel,
    });
    const onSave = vi.fn(async () => {});
    const { result } = renderHook(() => useAutosave({
      fileName: "story.ink",
      content: "Changed",
      onSave,
    }));

    expect(result.current.isLeader).toBe(false);
    await act(() => result.current.saveNow());
    expect(onSave).toHaveBeenCalledWith("story.ink", "Changed");
  });

  it("marks content modified immediately and clean again when it matches the saved hash", () => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "BroadcastChannel", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const onSave = vi.fn(async () => {});
    const { result, rerender } = renderHook(
      ({ content }) => useAutosave({
        fileName: "story.ink",
        content,
        debounceMs: 1000,
        onSave,
      }),
      { initialProps: { content: "Story" } },
    );

    expect(result.current.saveState).toBe("saved");

    rerender({ content: "Story changed" });
    expect(result.current.saveState).toBe("dirty");

    rerender({ content: "Story" });
    expect(result.current.saveState).toBe("saved");

    act(() => vi.advanceTimersByTime(1000));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows modified state in a follower tab even though autosave is not scheduled there", () => {
    vi.useFakeTimers();
    class IsolatedChannel {
      onmessage = null;
      postMessage() {}
      close() {}
    }
    Object.defineProperty(globalThis, "BroadcastChannel", {
      configurable: true,
      writable: true,
      value: IsolatedChannel,
    });
    const onSave = vi.fn(async () => {});
    const { result, rerender } = renderHook(
      ({ content }) => useAutosave({
        fileName: "story.ink",
        content,
        debounceMs: 1000,
        onSave,
      }),
      { initialProps: { content: "Story" } },
    );

    expect(result.current.isLeader).toBe(false);

    rerender({ content: "Story changed" });
    expect(result.current.saveState).toBe("dirty");

    act(() => vi.advanceTimersByTime(1000));
    expect(onSave).not.toHaveBeenCalled();
  });
});
