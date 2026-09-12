import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMediaQueryMatches, useMediaQuery } from "@/hooks/use-media-query";

type Listener = () => void;

function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  let matches = initialMatches;

  const matchMedia = vi.fn((query: string) => ({
    media: query,
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, listener: Listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: Listener) => {
      listeners.delete(listener);
    },
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    dispatchEvent: () => false,
    onchange: null,
  }));

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    matchMedia,
    listeners,
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <span data-testid="result">{String(matches)}</span>;
}

afterEach(() => {
  // @ts-expect-error -- jsdom has no matchMedia by default; restore that.
  delete window.matchMedia;
});

describe("useMediaQuery", () => {
  it("reports the initial match", () => {
    installMatchMedia(true);
    render(<Probe query="(min-width: 1120px)" />);
    expect(screen.getByTestId("result")).toHaveTextContent("true");
  });

  it("updates when the query flips", () => {
    const media = installMatchMedia(false);
    render(<Probe query="(min-width: 1120px)" />);
    expect(screen.getByTestId("result")).toHaveTextContent("false");

    act(() => media.setMatches(true));
    expect(screen.getByTestId("result")).toHaveTextContent("true");
  });

  it("unsubscribes on unmount", () => {
    const media = installMatchMedia(true);
    const view = render(<Probe query="(min-width: 1120px)" />);
    expect(media.listeners.size).toBe(1);
    view.unmount();
    expect(media.listeners.size).toBe(0);
  });

  it("falls back to false without matchMedia", () => {
    expect(getMediaQueryMatches("(min-width: 1120px)")).toBe(false);
    render(<Probe query="(min-width: 1120px)" />);
    expect(screen.getByTestId("result")).toHaveTextContent("false");
  });
});
