import {
  DEFAULT_USER_PREFERENCES,
  USER_PREFERENCES_SCHEMA_VERSION,
  type AppTheme,
  type EditorFontSize,
  type PreviewFontSize,
  type PreviewThemePreference,
  type UserPreferences,
} from "@/types/user-preferences";

export const USER_PREFERENCES_STORAGE_KEY = "inkpad:preferences";
const LEGACY_THEME_STORAGE_KEY = "inkpad-theme";

const THEMES = new Set<AppTheme>(["dark", "light", "high-contrast", "system"]);
const PREVIEW_THEMES = new Set<PreviewThemePreference>(["inkpad", "light", "dark", "high-contrast", "sepia"]);
const EDITOR_FONT_SIZES = new Set<EditorFontSize>([12, 14, 16, 18, 20]);
const PREVIEW_FONT_SIZES = new Set<PreviewFontSize>([14, 16, 18, 20, 22]);

function migrateLegacySchema(candidate: Record<string, unknown>): UserPreferences {
  const theme = THEMES.has(candidate.theme as AppTheme)
    ? (candidate.theme as AppTheme)
    : DEFAULT_USER_PREFERENCES.theme;
  const editorFontSize = EDITOR_FONT_SIZES.has(candidate.editorFontSize as EditorFontSize)
    ? (candidate.editorFontSize as EditorFontSize)
    : DEFAULT_USER_PREFERENCES.editorFontSize;
  const previewFontSize = PREVIEW_FONT_SIZES.has(candidate.previewFontSize as PreviewFontSize)
    ? (candidate.previewFontSize as PreviewFontSize)
    : DEFAULT_USER_PREFERENCES.previewFontSize;
  const previewTheme = PREVIEW_THEMES.has(candidate.previewTheme as PreviewThemePreference)
    ? (candidate.previewTheme as PreviewThemePreference)
    : DEFAULT_USER_PREFERENCES.previewTheme;
  const wordWrap =
    typeof candidate.wordWrap === "boolean"
      ? candidate.wordWrap
      : DEFAULT_USER_PREFERENCES.wordWrap;
  const showVariablesInspector =
    typeof candidate.showVariablesInspector === "boolean"
      ? candidate.showVariablesInspector
      : DEFAULT_USER_PREFERENCES.showVariablesInspector;
  return {
    ...DEFAULT_USER_PREFERENCES,
    schemaVersion: USER_PREFERENCES_SCHEMA_VERSION,
    theme,
    editorFontSize,
    previewFontSize,
    previewTheme,
    wordWrap,
    showVariablesInspector,
  };
}

function parsePreferences(value: unknown): UserPreferences | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;

  if (
    candidate.schemaVersion === 1
    || candidate.schemaVersion === 2
    || candidate.schemaVersion === 3
    || candidate.schemaVersion === 4
  ) {
    return migrateLegacySchema(candidate);
  }

  if (
    candidate.schemaVersion !== USER_PREFERENCES_SCHEMA_VERSION
    || !THEMES.has(candidate.theme as AppTheme)
    || !EDITOR_FONT_SIZES.has(candidate.editorFontSize as EditorFontSize)
    || !PREVIEW_FONT_SIZES.has(candidate.previewFontSize as PreviewFontSize)
    || !PREVIEW_THEMES.has(candidate.previewTheme as PreviewThemePreference)
    || typeof candidate.wordWrap !== "boolean"
    || typeof candidate.showVariablesInspector !== "boolean"
  ) {
    return null;
  }

  return candidate as unknown as UserPreferences;
}

export function loadUserPreferences(storage: Storage = localStorage): UserPreferences {
  try {
    const storedValue = storage.getItem(USER_PREFERENCES_STORAGE_KEY);
    if (storedValue) {
      const raw = JSON.parse(storedValue) as Record<string, unknown>;
      const parsed = parsePreferences(raw);
      if (parsed) {
        if (raw.schemaVersion !== USER_PREFERENCES_SCHEMA_VERSION) {
          storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }

    const legacyTheme = storage.getItem(LEGACY_THEME_STORAGE_KEY);
    const migratedTheme = THEMES.has(legacyTheme as AppTheme)
      ? (legacyTheme as AppTheme)
      : DEFAULT_USER_PREFERENCES.theme;
    const preferences = { ...DEFAULT_USER_PREFERENCES, theme: migratedTheme };
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    storage.removeItem(LEGACY_THEME_STORAGE_KEY);
    return preferences;
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

export function saveUserPreferences(
  preferences: UserPreferences,
  storage: Storage = localStorage,
): boolean {
  try {
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}
