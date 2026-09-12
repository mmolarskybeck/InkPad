import { track, type BeforeSendEvent } from "@vercel/analytics/react";

export type PlatformBucket = "desktop" | "mobile" | "tablet" | "unknown";
export type StoryLengthBucket = "0_1k" | "1k_10k" | "10k_50k" | "50k_plus" | "unknown";
export type ErrorCountBucket = "0" | "1" | "2_5" | "6_20" | "20_plus" | "unknown";
export type CompileTimeBucket = "0_100ms" | "100_500ms" | "500ms_2s" | "2s_plus" | "unknown";
export type ProjectCreatedSource = "blank" | "example" | "import" | "unknown";
export type StorageType = "local_storage" | "indexed_db" | "unknown";
export type StoryRunResult = "success" | "compiler_error" | "runtime_error" | "unknown";
export type ExportFormat = "ink" | "json" | "html" | "txt" | "unknown";
export type ImportSource = "file_picker" | "drag_drop" | "paste" | "unknown";
export type NavigatorTargetType = "knot" | "stitch" | "function" | "unknown";
export type SnippetType =
  | "knot"
  | "stitch"
  | "choice"
  | "conditional"
  | "variable"
  | "list"
  | "function"
  | "divert"
  | "custom"
  | "unknown";
export type PanelLayout = "split" | "editor_focus" | "preview_focus" | "unknown";
export type AnalyticsMobileTab = "editor" | "preview" | "errors" | "variables" | "unknown";
export type SnapshotExpiration = "none" | "24h" | "7d" | "30d" | "unknown";

export const ANALYTICS_ENABLED_STORAGE_KEY = "inkpad_analytics_enabled";

const ANALYTICS_EVENT_KEYS = {
  app_loaded: ["app_version", "platform"],
  project_created: ["source", "platform"],
  project_saved_local: ["storage", "story_length_bucket"],
  story_run: ["result", "story_length_bucket", "compile_time_bucket"],
  export_clicked: ["format", "story_length_bucket"],
  import_clicked: ["source"],
  error_panel_opened: ["error_count_bucket"],
  navigator_used: ["target_type"],
  snippet_inserted: ["snippet_type"],
  panel_layout_changed: ["layout"],
  mobile_tab_changed: ["tab"],
  snapshot_created: ["story_length_bucket", "includes_title", "expiration"],
  snapshot_viewed: ["story_length_bucket"],
  privacy_settings_opened: [],
  analytics_opt_out_changed: ["enabled"],
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_KEYS;
type AnalyticsPayloadValue = string | number | boolean | null;
type AnalyticsPayload = Record<string, AnalyticsPayloadValue>;

const SENSITIVE_QUERY_KEYS = [
  "auth",
  "code",
  "delete",
  "delete_token",
  "import",
  "key",
  "secret",
  "snapshot",
  "snapshot_id",
  "token",
] as const;

const SENSITIVE_PATH_PARTS = [
  "auth",
  "delete",
  "delete-token",
  "secret",
  "token",
] as const;

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function isAnalyticsEnabled(): boolean {
  if (!canUseBrowserStorage()) return false;

  try {
    return window.localStorage.getItem(ANALYTICS_ENABLED_STORAGE_KEY) !== "false";
  } catch {
    return false;
  }
}

export function setAnalyticsEnabled(enabled: boolean): void {
  if (!canUseBrowserStorage()) return;

  try {
    if (enabled) {
      window.localStorage.setItem(ANALYTICS_ENABLED_STORAGE_KEY, "true");
      trackSafeEvent("analytics_opt_out_changed", { enabled });
    } else {
      trackSafeEvent("analytics_opt_out_changed", { enabled });
      window.localStorage.setItem(ANALYTICS_ENABLED_STORAGE_KEY, "false");
    }
    window.dispatchEvent(new Event("inkpad:analytics-preference-change"));
  } catch {
    // Ignore storage failures; analytics preferences should never break editing.
  }
}

export function getStoryLengthBucket(text?: string): StoryLengthBucket {
  const length = text?.length ?? 0;

  if (length <= 0) return "unknown";
  if (length < 1000) return "0_1k";
  if (length < 10000) return "1k_10k";
  if (length < 50000) return "10k_50k";
  return "50k_plus";
}

export function getErrorCountBucket(count: number): ErrorCountBucket {
  if (!Number.isFinite(count)) return "unknown";
  if (count <= 0) return "0";
  if (count === 1) return "1";
  if (count <= 5) return "2_5";
  if (count <= 20) return "6_20";
  return "20_plus";
}

export function getCompileTimeBucket(ms?: number): CompileTimeBucket {
  if (typeof ms !== "number" || Number.isNaN(ms)) return "unknown";
  if (ms < 100) return "0_100ms";
  if (ms < 500) return "100_500ms";
  if (ms < 2000) return "500ms_2s";
  return "2s_plus";
}

export function getPlatformBucket(): PlatformBucket {
  if (typeof window === "undefined") return "unknown";

  const width = window.innerWidth;

  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

function sanitizePayload(
  eventName: AnalyticsEventName,
  payload: AnalyticsPayload = {},
): AnalyticsPayload {
  const allowedKeys = new Set<string>(ANALYTICS_EVENT_KEYS[eventName]);
  const sanitized: AnalyticsPayload = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!allowedKeys.has(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function trackSafeEvent(eventName: AnalyticsEventName, payload?: AnalyticsPayload): void {
  if (!isAnalyticsEnabled()) return;
  if (!Object.prototype.hasOwnProperty.call(ANALYTICS_EVENT_KEYS, eventName)) return;

  try {
    track(eventName, sanitizePayload(eventName, payload));
  } catch {
    // Analytics must never interrupt local-first writing.
  }
}

function hasSensitiveQueryParam(searchParams: URLSearchParams): boolean {
  for (const key of Array.from(searchParams.keys())) {
    const normalizedKey = key.toLowerCase();
    if (SENSITIVE_QUERY_KEYS.some((sensitive) => normalizedKey.includes(sensitive))) {
      return true;
    }
  }

  return false;
}

function hasSensitivePathPart(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase();
  return SENSITIVE_PATH_PARTS.some((part) => normalizedPath.includes(part));
}

function sanitizeUrlForTelemetry(url: string): string | null {
  try {
    const base = typeof window === "undefined" ? "https://inkpad.local" : window.location.origin;
    const parsedUrl = new URL(url, base);

    if (hasSensitiveQueryParam(parsedUrl.searchParams) || hasSensitivePathPart(parsedUrl.pathname)) {
      return null;
    }

    if (/^\/share\/[^/]+\/?$/.test(parsedUrl.pathname)) {
      parsedUrl.pathname = "/share/[snapshot]";
    }

    parsedUrl.search = "";
    parsedUrl.hash = "";

    return url.startsWith("/")
      ? `${parsedUrl.pathname}`
      : parsedUrl.toString();
  } catch {
    return null;
  }
}

export function sanitizeVercelAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  const sanitizedUrl = sanitizeUrlForTelemetry(event.url);
  if (!sanitizedUrl) return null;

  return { ...event, url: sanitizedUrl };
}

export function sanitizeVercelSpeedInsightsEvent<T extends { url: string }>(event: T): T | null {
  const sanitizedUrl = sanitizeUrlForTelemetry(event.url);
  if (!sanitizedUrl) return null;

  return { ...event, url: sanitizedUrl };
}

export function trackAppLoaded(): void {
  trackSafeEvent("app_loaded", {
    app_version: __APP_VERSION__,
    platform: getPlatformBucket(),
  });
}

export function trackProjectCreated(source: ProjectCreatedSource): void {
  trackSafeEvent("project_created", {
    source,
    platform: getPlatformBucket(),
  });
}

export function trackProjectSavedLocal(args: { storage: StorageType; storyText?: string }): void {
  trackSafeEvent("project_saved_local", {
    storage: args.storage,
    story_length_bucket: getStoryLengthBucket(args.storyText),
  });
}

export function trackStoryRun(args: {
  result: StoryRunResult;
  storyText?: string;
  compileTimeMs?: number;
}): void {
  trackSafeEvent("story_run", {
    result: args.result,
    story_length_bucket: getStoryLengthBucket(args.storyText),
    compile_time_bucket: getCompileTimeBucket(args.compileTimeMs),
  });
}

export function trackExportClicked(args: { format: ExportFormat; storyText?: string }): void {
  trackSafeEvent("export_clicked", {
    format: args.format,
    story_length_bucket: getStoryLengthBucket(args.storyText),
  });
}

export function trackImportClicked(source: ImportSource): void {
  trackSafeEvent("import_clicked", { source });
}

export function trackErrorPanelOpened(errorCount: number): void {
  trackSafeEvent("error_panel_opened", {
    error_count_bucket: getErrorCountBucket(errorCount),
  });
}

export function trackNavigatorUsed(targetType: NavigatorTargetType): void {
  trackSafeEvent("navigator_used", { target_type: targetType });
}

export function trackSnippetInserted(snippetType: SnippetType): void {
  trackSafeEvent("snippet_inserted", { snippet_type: snippetType });
}

export function trackPanelLayoutChanged(layout: PanelLayout): void {
  trackSafeEvent("panel_layout_changed", { layout });
}

export function trackMobileTabChanged(tab: AnalyticsMobileTab): void {
  trackSafeEvent("mobile_tab_changed", { tab });
}

export function trackSnapshotCreated(args: {
  storyText?: string;
  includesTitle: boolean;
  expiration: SnapshotExpiration;
}): void {
  trackSafeEvent("snapshot_created", {
    story_length_bucket: getStoryLengthBucket(args.storyText),
    includes_title: args.includesTitle,
    expiration: args.expiration,
  });
}

export function trackSnapshotViewed(args: { storyText?: string }): void {
  trackSafeEvent("snapshot_viewed", {
    story_length_bucket: getStoryLengthBucket(args.storyText),
  });
}

export function trackPrivacySettingsOpened(): void {
  trackSafeEvent("privacy_settings_opened");
}
