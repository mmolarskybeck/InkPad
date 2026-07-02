import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "@vercel/analytics/react";
import {
  ANALYTICS_ENABLED_STORAGE_KEY,
  getCompileTimeBucket,
  getErrorCountBucket,
  getStoryLengthBucket,
  sanitizeVercelAnalyticsEvent,
  setAnalyticsEnabled,
  trackExportClicked,
  trackStoryRun,
} from "./analytics";

vi.mock("@vercel/analytics/react", () => ({
  track: vi.fn(),
}));

const trackMock = vi.mocked(track);

function createStorageMock(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("analytics", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createStorageMock(),
    });
    window.localStorage.clear();
    trackMock.mockClear();
  });

  it("buckets story length without exposing exact text or counts", () => {
    expect(getStoryLengthBucket("")).toBe("unknown");
    expect(getStoryLengthBucket("a".repeat(999))).toBe("0_1k");
    expect(getStoryLengthBucket("a".repeat(1_000))).toBe("1k_10k");
    expect(getStoryLengthBucket("a".repeat(10_000))).toBe("10k_50k");
    expect(getStoryLengthBucket("a".repeat(50_000))).toBe("50k_plus");
  });

  it("buckets error counts and compile times", () => {
    expect(getErrorCountBucket(0)).toBe("0");
    expect(getErrorCountBucket(1)).toBe("1");
    expect(getErrorCountBucket(5)).toBe("2_5");
    expect(getErrorCountBucket(20)).toBe("6_20");
    expect(getErrorCountBucket(21)).toBe("20_plus");

    expect(getCompileTimeBucket(undefined)).toBe("unknown");
    expect(getCompileTimeBucket(99)).toBe("0_100ms");
    expect(getCompileTimeBucket(499)).toBe("100_500ms");
    expect(getCompileTimeBucket(1_999)).toBe("500ms_2s");
    expect(getCompileTimeBucket(2_000)).toBe("2s_plus");
  });

  it("sends only allowlisted, bucketed custom-event payloads", () => {
    const storyText = "Secret story text".repeat(100);

    trackStoryRun({
      result: "success",
      storyText,
      compileTimeMs: 125,
    });
    trackExportClicked({
      format: "ink",
      storyText,
    });

    expect(trackMock).toHaveBeenNthCalledWith(1, "story_run", {
      result: "success",
      story_length_bucket: "1k_10k",
      compile_time_bucket: "100_500ms",
    });
    expect(trackMock).toHaveBeenNthCalledWith(2, "export_clicked", {
      format: "ink",
      story_length_bucket: "1k_10k",
    });
    expect(JSON.stringify(trackMock.mock.calls)).not.toContain("Secret story text");
  });

  it("suppresses custom events after local opt-out", () => {
    window.localStorage.setItem(ANALYTICS_ENABLED_STORAGE_KEY, "false");

    trackExportClicked({ format: "json", storyText: "hello" });

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("tracks opt-out changes before disabling future custom events", () => {
    setAnalyticsEnabled(false);
    trackExportClicked({ format: "json", storyText: "hello" });

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith("analytics_opt_out_changed", {
      enabled: false,
    });
  });

  it("strips query strings and rewrites snapshot-like share paths", () => {
    const sanitized = sanitizeVercelAnalyticsEvent({
      type: "pageview",
      url: "https://inkpad.test/share/abc123?utm_source=newsletter#section",
    });

    expect(sanitized).toEqual({
      type: "pageview",
      url: "https://inkpad.test/share/[snapshot]",
    });
  });

  it("drops telemetry events with sensitive query params", () => {
    expect(sanitizeVercelAnalyticsEvent({
      type: "pageview",
      url: "https://inkpad.test/?token=secret",
    })).toBeNull();
  });
});
