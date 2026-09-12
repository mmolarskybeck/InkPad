import type { ThemeName } from "@/lib/tag-interpreter";

export const USER_PREFERENCES_SCHEMA_VERSION = 5 as const;

export type AppTheme = "dark" | "light" | "high-contrast" | "system";
export type EffectiveAppTheme = Exclude<AppTheme, "system">;
export type EditorFontSize = 12 | 14 | 16 | 18 | 20;
export type PreviewFontSize = 14 | 16 | 18 | 20 | 22;
export type PreviewThemePreference = ThemeName | "inkpad";

export interface UserPreferences {
  schemaVersion: typeof USER_PREFERENCES_SCHEMA_VERSION;
  theme: AppTheme;
  editorFontSize: EditorFontSize;
  previewFontSize: PreviewFontSize;
  previewTheme: PreviewThemePreference;
  wordWrap: boolean;
  showVariablesInspector: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  schemaVersion: USER_PREFERENCES_SCHEMA_VERSION,
  theme: "dark",
  editorFontSize: 14,
  previewFontSize: 16,
  previewTheme: "inkpad",
  wordWrap: true,
  showVariablesInspector: true,
};
